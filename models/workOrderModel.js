const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get all work orders from tblAssetMaintSch with detailed information
// Supports super access users who can view all branches
const getAllWorkOrders = async (orgId, userBranchId, hasSuperAccess = false) => {
    let query = `
        SELECT 
            ams.*,
            a.asset_type_id,
            a.serial_number,
            a.description as asset_description,
            a.purchased_on,
            a.service_vendor_id,
            at.text as asset_type_name,
            at.assignment_type,
            at.inspection_required,
            at.group_required,
            at.is_child,
            at.parent_asset_type_id,
            at.maint_lead_type,
            at.depreciation_type,
            mt.text as maintenance_type_name,
            v.vendor_name,
            v.contact_person_name,
            COALESCE(
              NULLIF(BTRIM(v.contact_person_email), ''),
              NULLIF(BTRIM(v.company_email), '')
            ) as vendor_email,
            NULLIF(BTRIM(v.contact_person_number), '') as vendor_phone,
            -- Calculate days until due (if act_maint_st_date is in the future)
            CASE 
                WHEN ams.act_maint_st_date > CURRENT_DATE THEN 
                    EXTRACT(DAY FROM (ams.act_maint_st_date - CURRENT_DATE))
                ELSE 0
            END as days_until_due,
            -- Calculate days overdue (if act_maint_st_date is in the past and status is not completed)
            CASE 
                WHEN ams.act_maint_st_date < CURRENT_DATE AND ams.status NOT IN ('CO', 'CA') THEN 
                    EXTRACT(DAY FROM (CURRENT_DATE - ams.act_maint_st_date))
                ELSE 0
            END as days_overdue,
            -- Get checklist items for this asset type (adjusted for BF02/BF01 breakdowns)
            (
                WITH regular_checklist AS (
                    SELECT json_build_object(
                        'checklist_id', cl.at_main_checklist_id,
                        'text', cl.text,
                        'at_main_freq_id', cl.at_main_freq_id
                    ) as item
                    FROM "tblATMaintCheckList" cl
                    WHERE cl.asset_type_id = a.asset_type_id 
                    AND cl.org_id = ams.org_id
                ),
                breakdown_info AS (
                    SELECT brd.abr_id, brd.atbrrc_id, brd.description as breakdown_description, 
                           brc.text as breakdown_reason, brd.decision_code
                    FROM "tblAssetBRDet" brd
                    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
                    WHERE brd.asset_id = ams.asset_id
                      AND brd.org_id = ams.org_id
                      AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
                      AND (
                        (ams.wo_id IS NOT NULL AND ams.wo_id ILIKE '%' || brd.abr_id || '%')
                        OR
                        (ams.wfamsh_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM "tblWFAssetMaintSch_D" wfd
                            WHERE wfd.wfamsh_id = ams.wfamsh_id
                              AND wfd.org_id = ams.org_id
                              AND wfd.notes ILIKE '%' || brd.abr_id || '%'
                        ))
                        OR
                        (ams.maint_type_id = 'MT004')
                      )
                    ORDER BY brd.created_on DESC
                    LIMIT 1
                ),
                breakdown_checklist AS (
                    SELECT json_build_object(
                        'checklist_id', 'BREAKDOWN-' || bd.abr_id,
                        'text', bd.breakdown_reason,
                        'at_main_freq_id', NULL,
                        'is_breakdown', true,
                        'breakdown_description', bd.breakdown_description
                    ) as item
                    FROM breakdown_info bd
                )
                SELECT CASE 
                    WHEN EXISTS (SELECT 1 FROM breakdown_info WHERE decision_code = 'BF02') THEN
                        -- BF02: Only breakdown reason
                        (SELECT json_agg(item) FROM breakdown_checklist)
                    WHEN EXISTS (SELECT 1 FROM breakdown_info WHERE decision_code = 'BF01') THEN
                        -- BF01: Regular checklist + breakdown reason
                        (SELECT json_agg(item) FROM (
                            SELECT item FROM regular_checklist
                            UNION ALL
                            SELECT item FROM breakdown_checklist
                        ) combined)
                    ELSE
                        -- No breakdown or BF03: Regular checklist only
                        (SELECT json_agg(item) FROM regular_checklist)
                END
            ) as checklist_items,
            -- Last five activity records for this asset
            (
                SELECT COALESCE(json_agg(activity_row ORDER BY activity_row.created_on DESC), '[]'::json)
                FROM (
                    SELECT ams2.ams_id, ams2.wo_id, ams2.wfamsh_id, ams2.status, ams2.notes, ams2.act_maint_st_date, ams2.act_main_end_date, ams2.created_on, ams2.changed_on
                    FROM "tblAssetMaintSch" ams2
                    WHERE ams2.asset_id = ams.asset_id
                      AND ams2.org_id = ams.org_id
                    ORDER BY ams2.created_on DESC
                    LIMIT 5
                ) AS activity_row
            ) as recent_activities,
            -- Get final approver name from history (who performed last UA action; works for role-based flow where wfd.user_id may be NULL)
            COALESCE(
              (
                SELECT COALESCE(u.full_name, u_emp.full_name)
                FROM "tblWFAssetMaintHist" wh
                LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
                LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                  AND wh.action = 'UA'
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              (
                SELECT COALESCE(u.full_name, u_emp.full_name)
                FROM "tblWFAssetMaintHist" wh
                LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
                LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              )
            ) as final_approver_name,
            -- Final approval date: UA first, then any hist action, then AMS created/changed
            COALESCE(
              (
                SELECT wh.action_on
                FROM "tblWFAssetMaintHist" wh
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                  AND wh.action = 'UA'
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              (
                SELECT wh.action_on
                FROM "tblWFAssetMaintHist" wh
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              ams.created_on,
              ams.changed_on
            ) as approval_date,
            -- Get breakdown information if this is a breakdown maintenance
            (
                SELECT json_build_object(
                    'abr_id', brd.abr_id,
                    'breakdown_reason_code', brd.atbrrc_id,
                    'breakdown_reason', brc.text,
                    'breakdown_description', brd.description,
                    'decision_code', brd.decision_code,
                    'reported_by', brd.reported_by,
                    'reported_on', brd.created_on
                )
                FROM "tblAssetBRDet" brd
                LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
                WHERE brd.asset_id = ams.asset_id
                  AND brd.org_id = ams.org_id
                  AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
                  AND (
                    -- Method 1: Match by wo_id containing abr_id
                    (ams.wo_id IS NOT NULL AND ams.wo_id ILIKE '%' || brd.abr_id || '%')
                    OR
                    -- Method 2: Match by workflow notes containing abr_id
                    (ams.wfamsh_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM "tblWFAssetMaintSch_D" wfd
                        WHERE wfd.wfamsh_id = ams.wfamsh_id
                          AND wfd.org_id = ams.org_id
                          AND wfd.notes ILIKE '%' || brd.abr_id || '%'
                    ))
                    OR
                    -- Method 3: For breakdown maintenance (MT004), get most recent breakdown
                    (ams.maint_type_id = 'MT004')
                  )
                ORDER BY brd.created_on DESC
                LIMIT 1
            ) as breakdown_info
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        INNER JOIN "tblBranches" b ON a.branch_id = b.branch_id
        WHERE ams.org_id = $1 
          AND a.org_id = $1 
          AND b.org_id = $1
    `;
    
    // Apply branch filter only if user doesn't have super access
    const params = [orgId];
    if (!hasSuperAccess && userBranchId) {
        query += ` AND b.branch_id = $2`;
        params.push(userBranchId);
    }
    
    // Open work orders only — include both vendor AND in-house (Furnace etc.).
    // Previously this filtered to maintained_by ILIKE 'vendor', which hid in-house jobs
    // and made Upcoming Jobs / WO lists look vendor-only with blank technicians.
    query += ` AND (
            (COALESCE(ams.maint_type_id, '') = 'MT004' AND ams.status IN ('IN', 'IP')) 
            OR 
            (COALESCE(ams.maint_type_id, '') != 'MT004' AND ams.status = 'IN')
          )
          AND ams.wo_id IS NOT NULL
        ORDER BY ams.created_on DESC, ams.ams_id DESC
    `;
    
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    if (!result.rows.length) return result;

    for (const row of result.rows) {
      await enrichWorkOrderProviderFields(row, orgId, dbPool);
    }
    return result;
};

/**
 * Frequency (not service_vendor_id) decides in-house vs vendor.
 * Corrects stale AMS rows stamped Vendor because the asset had a service vendor.
 */
async function enrichWorkOrderProviderFields(row, orgId, dbPool) {
  if (!row) return row;
  const {
    isInhouseMaintainedBy,
    resolveMaintenanceProvider,
  } = require('../utils/inhouseVendorUtils');
  const { resolveTechnicianFromEmp } = require('../utils/technicianResolveUtils');

  const provider = await resolveMaintenanceProvider({
    orgId,
    atMainFreqId: row.at_main_freq_id || null,
    assetTypeId: row.asset_type_id || null,
    serviceVendorId: row.service_vendor_id || row.vendor_id || null,
    dbPool,
  });

  let headerEmpId = null;
  if (row.wfamsh_id) {
    try {
      const header = await dbPool.query(
        `SELECT emp_int_id FROM "tblWFAssetMaintSch_H" WHERE wfamsh_id = $1 AND org_id = $2 LIMIT 1`,
        [row.wfamsh_id, orgId],
      );
      headerEmpId = header.rows[0]?.emp_int_id || null;
    } catch (_) { /* optional */ }
  }

  // Frequency wins; fall back to stored AMS only when freq missing.
  const storedMaintainedBy = row.maintained_by || null;
  const storedEmpId = row.emp_int_id || null;
  const storedTechName = row.technician_name || null;
  const storedTechEmail = row.technician_email || null;
  const storedTechPhone = row.technician_phno || null;
  const blank = (v) => !v || !String(v).trim();
  const currentMaintainedBy = provider.maintainedBy || storedMaintainedBy || 'Inhouse';
  const isInhouse =
    isInhouseMaintainedBy(currentMaintainedBy) ||
    Boolean(
      (storedEmpId || headerEmpId || provider.empIntId) &&
        !String(currentMaintainedBy || '').toLowerCase().includes('vendor'),
    );

  row.maintained_by = currentMaintainedBy;
  row.is_inhouse = isInhouse;

  // Older vendor master rows often leave contact_person_email blank but have company_email.
  const applyVendorContactFallback = async (vendorId) => {
    if (!vendorId) return;
    const emailMissing = blank(row.vendor_email);
    const phoneMissing = blank(row.vendor_phone);
    const nameMissing = blank(row.contact_person_name);
    const vendorNameMissing = blank(row.vendor_name);
    if (!emailMissing && !phoneMissing && !nameMissing && !vendorNameMissing) {
      return;
    }
    try {
      const v = await dbPool.query(
        `SELECT vendor_name, contact_person_name,
                COALESCE(
                  NULLIF(BTRIM(contact_person_email), ''),
                  NULLIF(BTRIM(company_email), '')
                ) AS vendor_email,
                NULLIF(BTRIM(contact_person_number), '') AS vendor_phone
         FROM "tblVendors"
         WHERE vendor_id = $1
         LIMIT 1`,
        [vendorId],
      );
      if (!v.rows[0]) return;
      if (vendorNameMissing && v.rows[0].vendor_name) {
        row.vendor_name = v.rows[0].vendor_name;
      }
      if (nameMissing && v.rows[0].contact_person_name) {
        row.contact_person_name = v.rows[0].contact_person_name;
      }
      if (emailMissing && v.rows[0].vendor_email) {
        row.vendor_email = v.rows[0].vendor_email;
      }
      if (phoneMissing && v.rows[0].vendor_phone) {
        row.vendor_phone = v.rows[0].vendor_phone;
      }
    } catch (_) { /* optional */ }
  };

  if (!isInhouse) {
    await applyVendorContactFallback(row.vendor_id || row.service_vendor_id);
    if (blank(row.technician_email) && row.emp_int_id) {
      const tech = await resolveTechnicianFromEmp(row.emp_int_id, dbPool);
      if (tech.technician_email) row.technician_email = tech.technician_email;
      if (blank(row.technician_phno) && tech.technician_phno) {
        row.technician_phno = tech.technician_phno;
      }
      if (blank(row.technician_name) && tech.technician_name) {
        row.technician_name = tech.technician_name;
      }
    }
    if (!row.approval_date) {
      row.approval_date = row.created_on || row.changed_on || null;
    }
    return row;
  }

  const empId = storedEmpId || headerEmpId || provider.empIntId || null;
  let tech = {
    technician_name: null,
    technician_email: null,
    technician_phno: null,
  };
  if (empId) {
    tech = await resolveTechnicianFromEmp(empId, dbPool);
    row.emp_int_id = empId;
    if (blank(row.technician_name)) {
      row.technician_name = tech.technician_name || row.technician_name;
    } else if (tech.technician_name) {
      row.technician_name = tech.technician_name;
    }
    if (blank(row.technician_email)) {
      row.technician_email = tech.technician_email || row.technician_email;
    }
    if (blank(row.technician_phno)) {
      row.technician_phno = tech.technician_phno || row.technician_phno;
    }
  }

  // Fallback: user email linked to emp when employee email_id is empty
  if (empId && blank(row.technician_email)) {
    try {
      const u = await dbPool.query(
        `SELECT email, full_name, phone
         FROM "tblUsers"
         WHERE emp_int_id = $1 AND org_id = $2
         ORDER BY CASE WHEN COALESCE(int_status, 1) = 1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [empId, orgId],
      );
      if (u.rows[0]?.email) row.technician_email = u.rows[0].email;
      if (blank(row.technician_name) && u.rows[0]?.full_name) {
        row.technician_name = u.rows[0].full_name;
      }
      if (blank(row.technician_phno) && u.rows[0]?.phone) {
        row.technician_phno = u.rows[0].phone;
      }
    } catch (_) { /* optional */ }
  }

  const inhouseVendorId = provider.vendorId || null;
  const vendorNeedsRemap =
    Boolean(inhouseVendorId) &&
    String(row.vendor_id || '') !== String(inhouseVendorId);

  // Always surface in-house vendor on the response (JOIN may still have service vendor)
  if (vendorNeedsRemap) {
    row.vendor_id = inhouseVendorId;
  }
  await applyVendorContactFallback(row.vendor_id || inhouseVendorId);

  if (!row.approval_date) {
    row.approval_date = row.created_on || row.changed_on || null;
  }

  const needsPersist =
    String(storedMaintainedBy || '').toLowerCase() !==
      String(currentMaintainedBy || '').toLowerCase() ||
    (empId && !storedEmpId) ||
    (empId && blank(storedTechName) && !blank(row.technician_name)) ||
    (empId && blank(storedTechEmail) && !blank(row.technician_email)) ||
    (empId && blank(storedTechPhone) && !blank(row.technician_phno)) ||
    vendorNeedsRemap;

  if (needsPersist) {
    try {
      await dbPool.query(
        `UPDATE "tblAssetMaintSch"
         SET maintained_by = $1,
             emp_int_id = COALESCE(emp_int_id, $2),
             technician_name = COALESCE(NULLIF(BTRIM($3), ''), technician_name),
             technician_email = COALESCE(NULLIF(BTRIM($4), ''), technician_email),
             technician_phno = COALESCE(NULLIF(BTRIM($5), ''), technician_phno),
             vendor_id = COALESCE($6, vendor_id)
         WHERE ams_id = $7 AND org_id = $8`,
        [
          currentMaintainedBy,
          empId,
          row.technician_name || null,
          row.technician_email || null,
          row.technician_phno || null,
          inhouseVendorId,
          row.ams_id,
          orgId,
        ],
      );
    } catch (_) { /* best-effort */ }
  }

  return row;
}

// Get work order by ID with detailed information
// Supports super access users who can view all branches
const getWorkOrderById = async (amsId, orgId = 'ORG001', userBranchId = 'BR001', hasSuperAccess = false) => {
    let query = `
        SELECT 
            ams.*,
            a.asset_type_id,
            a.serial_number,
            a.description as asset_description,
            a.purchased_on,
            a.service_vendor_id,
            a.location,
            at.text as asset_type_name,
            at.assignment_type,
            at.inspection_required,
            at.group_required,
            at.is_child,
            at.parent_asset_type_id,
            at.maint_lead_type,
            at.depreciation_type,
            mt.text as maintenance_type_name,
            v.vendor_name,
            v.contact_person_name,
            COALESCE(
              NULLIF(BTRIM(v.contact_person_email), ''),
              NULLIF(BTRIM(v.company_email), '')
            ) as vendor_email,
            NULLIF(BTRIM(v.contact_person_number), '') as vendor_phone,
            -- Calculate days until due (if act_maint_st_date is in the future)
            CASE 
                WHEN ams.act_maint_st_date > CURRENT_DATE THEN 
                    EXTRACT(DAY FROM (ams.act_maint_st_date - CURRENT_DATE))
                ELSE 0
            END as days_until_due,
            -- Calculate days overdue (if act_maint_st_date is in the past and status is not completed)
            CASE 
                WHEN ams.act_maint_st_date < CURRENT_DATE AND ams.status NOT IN ('CO', 'CA') THEN 
                    EXTRACT(DAY FROM (CURRENT_DATE - ams.act_maint_st_date))
                ELSE 0
            END as days_overdue,
            -- Get checklist items for this asset type (adjusted for BF02/BF01 breakdowns)
            (
                WITH regular_checklist AS (
                    SELECT json_build_object(
                        'checklist_id', cl.at_main_checklist_id,
                        'text', cl.text,
                        'at_main_freq_id', cl.at_main_freq_id
                    ) as item
                    FROM "tblATMaintCheckList" cl
                    WHERE cl.asset_type_id = a.asset_type_id 
                    AND cl.org_id = ams.org_id
                ),
                breakdown_info AS (
                    SELECT brd.abr_id, brd.atbrrc_id, brd.description as breakdown_description, 
                           brc.text as breakdown_reason, brd.decision_code
                    FROM "tblAssetBRDet" brd
                    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
                    WHERE brd.asset_id = ams.asset_id
                      AND brd.org_id = ams.org_id
                      AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
                      AND (
                        (ams.wo_id IS NOT NULL AND ams.wo_id ILIKE '%' || brd.abr_id || '%')
                        OR
                        (ams.wfamsh_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM "tblWFAssetMaintSch_D" wfd
                            WHERE wfd.wfamsh_id = ams.wfamsh_id
                              AND wfd.org_id = ams.org_id
                              AND wfd.notes ILIKE '%' || brd.abr_id || '%'
                        ))
                        OR
                        (ams.maint_type_id = 'MT004')
                      )
                    ORDER BY brd.created_on DESC
                    LIMIT 1
                ),
                breakdown_checklist AS (
                    SELECT json_build_object(
                        'checklist_id', 'BREAKDOWN-' || bd.abr_id,
                        'text', bd.breakdown_reason,
                        'at_main_freq_id', NULL,
                        'is_breakdown', true,
                        'breakdown_description', bd.breakdown_description
                    ) as item
                    FROM breakdown_info bd
                )
                SELECT CASE 
                    WHEN EXISTS (SELECT 1 FROM breakdown_info WHERE decision_code = 'BF02') THEN
                        -- BF02: Only breakdown reason
                        (SELECT json_agg(item) FROM breakdown_checklist)
                    WHEN EXISTS (SELECT 1 FROM breakdown_info WHERE decision_code = 'BF01') THEN
                        -- BF01: Regular checklist + breakdown reason
                        (SELECT json_agg(item) FROM (
                            SELECT item FROM regular_checklist
                            UNION ALL
                            SELECT item FROM breakdown_checklist
                        ) combined)
                    ELSE
                        -- No breakdown or BF03: Regular checklist only
                        (SELECT json_agg(item) FROM regular_checklist)
                END
            ) as checklist_items,
            -- Last five activity records for this asset
            (
                SELECT COALESCE(json_agg(activity_row ORDER BY activity_row.created_on DESC), '[]'::json)
                FROM (
                    SELECT ams2.ams_id, ams2.wo_id, ams2.wfamsh_id, ams2.status, ams2.notes, ams2.act_maint_st_date, ams2.act_main_end_date, ams2.created_on, ams2.changed_on
                    FROM "tblAssetMaintSch" ams2
                    WHERE ams2.asset_id = ams.asset_id
                      AND ams2.org_id = ams.org_id
                    ORDER BY ams2.created_on DESC
                    LIMIT 5
                ) AS activity_row
            ) as recent_activities,
            -- Get final approver name from history (who performed last UA action; works for role-based flow where wfd.user_id may be NULL)
            COALESCE(
              (
                SELECT COALESCE(u.full_name, u_emp.full_name)
                FROM "tblWFAssetMaintHist" wh
                LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
                LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                  AND wh.action = 'UA'
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              (
                SELECT COALESCE(u.full_name, u_emp.full_name)
                FROM "tblWFAssetMaintHist" wh
                LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
                LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              )
            ) as final_approver_name,
            -- Final approval date: UA first, then any hist action, then AMS created/changed
            COALESCE(
              (
                SELECT wh.action_on
                FROM "tblWFAssetMaintHist" wh
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                  AND wh.action = 'UA'
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              (
                SELECT wh.action_on
                FROM "tblWFAssetMaintHist" wh
                WHERE wh.wfamsh_id = ams.wfamsh_id
                  AND wh.org_id = ams.org_id
                ORDER BY wh.action_on DESC NULLS LAST
                LIMIT 1
              ),
              ams.created_on,
              ams.changed_on
            ) as approval_date,
            -- Get breakdown information if this is a breakdown maintenance
            (
                SELECT json_build_object(
                    'abr_id', brd.abr_id,
                    'breakdown_reason_code', brd.atbrrc_id,
                    'breakdown_reason', brc.text,
                    'breakdown_description', brd.description,
                    'decision_code', brd.decision_code,
                    'reported_by', brd.reported_by,
                    'reported_on', brd.created_on
                )
                FROM "tblAssetBRDet" brd
                LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
                WHERE brd.asset_id = ams.asset_id
                  AND brd.org_id = ams.org_id
                  AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
                  AND (
                    -- Method 1: Match by wo_id containing abr_id
                    (ams.wo_id IS NOT NULL AND ams.wo_id ILIKE '%' || brd.abr_id || '%')
                    OR
                    -- Method 2: Match by workflow notes containing abr_id
                    (ams.wfamsh_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM "tblWFAssetMaintSch_D" wfd
                        WHERE wfd.wfamsh_id = ams.wfamsh_id
                          AND wfd.org_id = ams.org_id
                          AND wfd.notes ILIKE '%' || brd.abr_id || '%'
                    ))
                    OR
                    -- Method 3: For breakdown maintenance (MT004), get most recent breakdown
                    (ams.maint_type_id = 'MT004')
                  )
                ORDER BY brd.created_on DESC
                LIMIT 1
            ) as breakdown_info,
            -- Get group_id from workflow header if this is a group maintenance
            wfh.group_id,
            -- Get group name if this is a group maintenance
            ag.text as group_name
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        INNER JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblWFAssetMaintSch_H" wfh ON ams.wfamsh_id = wfh.wfamsh_id AND wfh.org_id = ams.org_id
        LEFT JOIN "tblAssetGroup_H" ag ON wfh.group_id = ag.assetgroup_h_id
        WHERE ams.ams_id = $1 
          AND ams.org_id = $2 
          AND a.org_id = $2 
          AND b.org_id = $2
    `;
    
    // Build parameters array dynamically
    const params = [amsId, orgId];
    if (!hasSuperAccess && userBranchId) {
        query += ` AND b.branch_id = $3`;
        params.push(userBranchId);
    }
    
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    
    // If this is a group maintenance, fetch all assets in the group
    if (result.rows.length > 0) {
        const workOrder = result.rows[0];
        await enrichWorkOrderProviderFields(workOrder, orgId, dbPool);
        const groupId = workOrder.group_id;
        
        // Check if this is a group maintenance by checking group_id from workflow header
        if (groupId) {
            console.log(`Detected group maintenance for work order ${amsId}, group_id: ${groupId}`);
            
            // Fetch all assets in the group
            const groupAssetsQuery = `
                SELECT 
                    a.asset_id,
                    a.text as asset_name,
                    a.serial_number,
                    a.description,
                    a.service_vendor_id,
                    a.branch_id,
                    b.branch_code,
                    a.location,
                    a.current_status
                FROM "tblAssets" a
                LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
                WHERE a.group_id = $1 AND a.org_id = $2
                ORDER BY a.text ASC
            `;
            
            const dbPool = getDb();

            
            const groupAssetsResult = await dbPool.query(groupAssetsQuery, [groupId, orgId]);
            workOrder.group_assets = groupAssetsResult.rows;
            workOrder.is_group_maintenance = true;
            workOrder.group_asset_count = groupAssetsResult.rows.length;
            
            console.log(`Found ${workOrder.group_asset_count} assets in group ${groupId}`);
        } else {
            workOrder.group_assets = [];
            workOrder.is_group_maintenance = false;
            workOrder.group_asset_count = 0;
        }
    }
    
    return result;
};

module.exports = {
    getAllWorkOrders,
    getWorkOrderById
};
