const db = require("../config/db");

/**
 * Inspection Schedule Model
 * Handles all database operations for inspection schedule generation
 */

/**
 * Get all asset types that require inspection
 * Uses maint_required flag (assuming inspection is required when maintenance is required)
 * TODO: Add separate insp_required column if needed
 */
const getAssetTypesRequiringInspection = async (org_id) => {
  const query = `
    SELECT 
      asset_type_id,
      text as asset_type_name,
      maint_required as insp_required,
      org_id
    FROM "tblAssetTypes"
    WHERE maint_required = true
      AND int_status = 1
      AND org_id = $1
    ORDER BY text
  `;
  
  return await db.query(query, [org_id]);
};

/**
 * Get inspection frequency configuration for an asset type
 */
const getInspectionFrequency = async (asset_type_id, org_id) => {
  const query = `
    SELECT 
      aif.aatif_id,
      aif.aatic_id,
      aaic.at_id as asset_type_id,
      aif.freq as frequency,
      COALESCE(uom.UOM, aif.uom) as uom,
      10 as insp_lead_time,
      aif.org_id,
      aif.int_status,
      aif.emp_int_id,
      aif.maintained_by
    FROM "tblAAT_Insp_Freq" aif
    INNER JOIN "tblAATInspCheckList" aaic ON aif.aatic_id = aaic.aatic_id
    LEFT JOIN "tblUom" uom ON aif.uom = uom.UOM_id
    WHERE aaic.at_id = $1
      AND aif.org_id = $2
      AND aif.int_status = 1
    LIMIT 1
  `;
  
  return await db.query(query, [asset_type_id, org_id]);
};

/**
 * Get a single asset by id for manual inspection (returns fields needed to create schedule)
 */
const getAssetByIdForInspection = async (asset_id, org_id) => {
  const query = `
    SELECT 
      a.asset_id,
      a.asset_type_id,
      b.branch_code,
      a.purchase_vendor_id as vendor_id
    FROM "tblAssets" a
    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
    WHERE a.asset_id = $1
      AND a.org_id = $2
      AND UPPER(COALESCE(a.current_status, '')) IN ('ACTIVE', 'IN_USE')
  `;
  return await db.query(query, [asset_id, org_id]);
};

/**
 * Get all individual assets for a specific asset type
 */
const getAssetsByAssetType = async (asset_type_id, org_id) => {
  const query = `
    SELECT 
      a.asset_id,
      a.asset_type_id,
      a.serial_number,
      a.purchased_on,
      a.group_id,
      b.branch_code,
      a.purchase_vendor_id as vendor_id,
      a.org_id,
      at.text as asset_type_name
    FROM "tblAssets" a
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
    WHERE a.asset_type_id = $1
      AND a.org_id = $2
      AND UPPER(a.current_status) IN ('ACTIVE', 'IN_USE')
      AND a.purchased_on IS NOT NULL
      AND (a.group_id IS NULL OR a.group_id = '')
    ORDER BY a.asset_id
  `;
  
  return await db.query(query, [asset_type_id, org_id]);
};

/**
 * Get all asset groups for a specific asset type
 */
const getGroupsByAssetType = async (asset_type_id, org_id) => {
  const query = `
    SELECT DISTINCT
      a.group_id,
      a.asset_type_id,
      a.branch_id,
      a.org_id,
      COUNT(*) as asset_count
    FROM "tblAssets" a
    WHERE a.asset_type_id = $1
      AND a.org_id = $2
      AND UPPER(a.current_status) IN ('ACTIVE', 'IN_USE')
      AND a.group_id IS NOT NULL
      AND a.group_id != ''
    GROUP BY a.group_id, a.asset_type_id, a.branch_id, a.org_id
    ORDER BY a.group_id
  `;
  
  return await db.query(query, [asset_type_id, org_id]);
};

/**
 * Get assets belonging to a specific group
 */
const getAssetsByGroupId = async (group_id, org_id) => {
  const query = `
    SELECT 
      asset_id,
      asset_type_id,
      serial_number,
      purchased_on,
      group_id,
      branch_id,
      org_id
    FROM "tblAssets"
    WHERE group_id = $1
      AND org_id = $2
      AND UPPER(current_status) IN ('ACTIVE', 'IN_USE')
      AND purchased_on IS NOT NULL
    ORDER BY asset_id
  `;
  
  return await db.query(query, [group_id, org_id]);
};

/**
 * Check if workflow configuration exists for asset type
 * This determines if we create workflow records or direct schedule
 */
const checkWorkflowExists = async (asset_type_id, org_id) => {
  const query = `
    SELECT 
      wfatis_id,
      at_id as asset_type_id,
      wf_steps_id,
      seqs_no,
      org_id
    FROM "tblWFATInspSeqs"
    WHERE at_id = $1
      AND org_id = $2
    ORDER BY seqs_no ASC
  `;
  
  return await db.query(query, [asset_type_id, org_id]);
};

/**
 * Get job role details for a workflow step
 */
const getInspectionJobRole = async (wf_steps_id, org_id) => {
  const query = `
    SELECT 
      wf_insp_job_role_id,
      wf_insp_steps_id,
      job_role_id,
      emp_int_id,
      dept_id,
      org_id
    FROM "tblWFInspJobRole"
    WHERE wf_insp_steps_id = $1
      AND org_id = $2
    LIMIT 1
  `;
  
  return await db.query(query, [wf_steps_id, org_id]);
};

/**
 * Check for existing in-progress workflow inspections
 */
const checkExistingWorkflowInspection = async (asset_id, org_id) => {
  const query = `
    SELECT 
      wfaiish_id,
      asset_id,
      status,
      pl_sch_date
    FROM "tblWFAATInspSch_H"
    WHERE asset_id = $1
      AND org_id = $2
      AND status IN ('IN', 'IP', 'PN', 'AP')
    ORDER BY created_on DESC
    LIMIT 1
  `;
  
  return await db.query(query, [asset_id, org_id]);
};

/**
 * Check for existing in-progress direct inspections
 */
const checkExistingDirectInspection = async (asset_id, org_id) => {
  const query = `
    SELECT 
      ais_id,
      asset_id,
      status,
      act_insp_st_date
    FROM "tblAAT_Insp_Sch"
    WHERE asset_id = $1
      AND org_id = $2
      AND status IN ('IN', 'IP', 'PN', 'AP')
    ORDER BY created_on DESC
    LIMIT 1
  `;
  
  return await db.query(query, [asset_id, org_id]);
};

/**
 * Get last completed inspection date for an asset
 * Checks both workflow and direct inspections
 */
const getLastCompletedInspectionDate = async (asset_id, org_id) => {
  // Check workflow inspections
  const workflowQuery = `
    SELECT 
      act_sch_date as completed_date
    FROM "tblWFAATInspSch_H"
    WHERE asset_id = $1
      AND org_id = $2
      AND status = 'CO'
      AND act_sch_date IS NOT NULL
    ORDER BY act_sch_date DESC
    LIMIT 1
  `;
  
  const workflowResult = await db.query(workflowQuery, [asset_id, org_id]);
  
  if (workflowResult.rows.length > 0) {
    return workflowResult.rows[0].completed_date;
  }
  
  // Check direct inspections
  const directQuery = `
    SELECT 
      act_insp_end_date as completed_date
    FROM "tblAAT_Insp_Sch"
    WHERE asset_id = $1
      AND org_id = $2
      AND status = 'CO'
      AND act_insp_end_date IS NOT NULL
    ORDER BY act_insp_end_date DESC
    LIMIT 1
  `;
  
  const directResult = await db.query(directQuery, [asset_id, org_id]);
  
  if (directResult.rows.length > 0) {
    return directResult.rows[0].completed_date;
  }
  
  return null;
};

/**
 * Create workflow inspection header record
 */
const createWorkflowInspectionHeader = async (data) => {
  const query = `
    INSERT INTO "tblWFAATInspSch_H" (
      wfaiish_id,
      aatif_id,
      asset_id,
      group_id,
      vendor_id,
      pl_sch_date,
      status,
      created_by,
      created_on,
      org_id,
      branch_code,
      emp_int_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
    RETURNING *
  `;
  
  return await db.query(query, [
    data.wfaiish_id,
    data.aatif_id,
    data.asset_id,
    data.group_id || null,
    data.vendor_id || null,
    data.pl_sch_date,
    data.status || 'IN', // IN = Initiated
    data.created_by || 'SYSTEM',
    data.org_id,
    data.branch_code,
    data.emp_int_id || null
  ]);
};

/**
 * Create workflow inspection detail record (approver)
 */
const createWorkflowInspectionDetail = async (data) => {
  const query = `
    INSERT INTO "tblWFAATInspSch_D" (
      wfaiisd_id,
      wfaiish_id,
      job_role_id,
      dept_id,
      sequence,
      status,
      created_by,
      created_on,
      org_id,
      user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
    RETURNING *
  `;
  
  return await db.query(query, [
    data.wfaiisd_id,
    data.wfaiish_id,
    data.job_role_id,
    data.dept_id || null,
    data.sequence,
    data.status, // PN = Pending, NA = Not Active
    data.created_by || 'SYSTEM',
    data.org_id,
    data.user_id || null
  ]);
};

/**
 * Create direct inspection schedule (no workflow)
 */
const createDirectInspectionSchedule = async (data) => {
  // If this inspection frequency indicates vendor maintenance, do not persist emp_int_id
  let empIntToSave = data.emp_int_id || null;
  try {
    if (data.aatif_id) {
      const aifRes = await db.query('SELECT maintained_by FROM "tblAAT_Insp_Freq" WHERE aatif_id = $1 LIMIT 1', [data.aatif_id]);
      const maintainedBy = aifRes.rows.length ? (aifRes.rows[0].maintained_by || '') : '';
      if (String(maintainedBy).toLowerCase() === 'vendor') {
        empIntToSave = null;
      }
    }
  } catch (err) {
    // if lookup fails, fallback to provided emp_int_id
    empIntToSave = data.emp_int_id || null;
  }

  const query = `
    INSERT INTO "tblAAT_Insp_Sch" (
      ais_id,
      aatif_id,
      asset_id,
      vendor_id,
      emp_int_id,
      act_insp_st_date,
      status,
      created_by,
      created_on,
      org_id,
      branch_code
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
    RETURNING *
  `;

  return await db.query(query, [
    data.ais_id,
    data.aatif_id,
    data.asset_id,
    data.vendor_id || null,
    empIntToSave,
    data.act_insp_st_date,
    data.status || 'PN', // PN = Pending
    data.created_by || 'SYSTEM',
    data.org_id,
    data.branch_code || null
  ]);
};

/**
 * Helper: Calculate next inspection date based on frequency
 */
const calculateNextInspectionDate = (baseDate, frequency, uom) => {
  const date = new Date(baseDate);
  
  switch (uom.toUpperCase()) {
    case 'D':
    case 'DAYS':
      date.setDate(date.getDate() + parseInt(frequency));
      break;
    case 'M':
    case 'MONTHS':
      date.setMonth(date.getMonth() + parseInt(frequency));
      break;
    case 'Y':
    case 'YEARS':
      date.setFullYear(date.getFullYear() + parseInt(frequency));
      break;
    default:
      throw new Error(`Invalid UOM: ${uom}`);
  }
  
  return date;
};

/**
 * Helper: Generate unique ID with prefix
 */
const generateUniqueId = (prefix) => {
  // Generate a shorter ID that fits in VARCHAR(20)
  // Format: PREFIX + last 6 digits of timestamp + 3-digit random
  // Example: WFAIISH_479080_123 (18 chars max)
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}_${timestamp}_${random}`;
};

/**
 * Get list of inspections for execution/viewing
 */
const getInspectionList = async (org_id, emp_int_id = null) => {
  // Vendor-maintained inspections should be visible to everyone.
  // Inhouse inspections (no vendor) should be visible only to the assigned emp_int_id.
  let query;
  let params;

  // Join frequency table to determine maintained_by (vendor vs inhouse)
  if (emp_int_id) {
    query = `
      SELECT 
        sch.ais_id,
        sch.asset_id,
        sch.vendor_id,
        sch.act_insp_st_date,
        sch.act_insp_end_date,
        sch.status,
        NULL as insp_outcome,
        sch.created_on,
        sch.created_by,
        a.asset_id as asset_code,
        a.serial_number,
        if.text as asset_type_name,
        v.vendor_name,
        b.text as branch_name,
        aif.maintained_by
      FROM "tblAAT_Insp_Sch" sch
      INNER JOIN "tblAssets" a ON sch.asset_id = a.asset_id
      LEFT JOIN "tblAssetTypes" if ON a.asset_type_id = if.asset_type_id
      LEFT JOIN "tblVendors" v ON sch.vendor_id = v.vendor_id
      LEFT JOIN "tblBranches" b ON sch.branch_code = b.branch_code
      LEFT JOIN "tblAAT_Insp_Freq" aif ON sch.aatif_id = aif.aatif_id
      WHERE sch.org_id = $1
        AND (
          COALESCE(aif.maintained_by, '') ILIKE 'vendor'
          OR sch.emp_int_id = $2
        )
      ORDER BY sch.act_insp_st_date DESC
    `;
    params = [org_id, emp_int_id];
  } else {
    // No emp provided: show only vendor-maintained inspections
    query = `
      SELECT 
        sch.ais_id,
        sch.asset_id,
        sch.vendor_id,
        sch.act_insp_st_date,
        sch.act_insp_end_date,
        sch.status,
        NULL as insp_outcome,
        sch.created_on,
        sch.created_by,
        a.asset_id as asset_code,
        a.serial_number,
        if.text as asset_type_name,
        v.vendor_name,
        b.text as branch_name,
        aif.maintained_by
      FROM "tblAAT_Insp_Sch" sch
      INNER JOIN "tblAssets" a ON sch.asset_id = a.asset_id
      LEFT JOIN "tblAssetTypes" if ON a.asset_type_id = if.asset_type_id
      LEFT JOIN "tblVendors" v ON sch.vendor_id = v.vendor_id
      LEFT JOIN "tblBranches" b ON sch.branch_code = b.branch_code
      LEFT JOIN "tblAAT_Insp_Freq" aif ON sch.aatif_id = aif.aatif_id
      WHERE sch.org_id = $1
        AND COALESCE(aif.maintained_by, '') ILIKE 'vendor'
      ORDER BY sch.act_insp_st_date DESC
    `;
    params = [org_id];
  }

  return await db.query(query, params);
};

/**
 * Get inspection details by ID
 */
const getInspectionDetailsById = async (ais_id, org_id) => {
  const query = `
    SELECT 
      sch.*,
      a.asset_id as asset_code,
      a.serial_number,
      a.asset_type_id,
      if.text as asset_type_name,
      v.vendor_name,
      b.text as branch_name,
      aif.maintained_by
    FROM "tblAAT_Insp_Sch" sch
    INNER JOIN "tblAssets" a ON sch.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" if ON a.asset_type_id = if.asset_type_id
    LEFT JOIN "tblVendors" v ON sch.vendor_id = v.vendor_id
    LEFT JOIN "tblBranches" b ON sch.branch_code = b.branch_code
    LEFT JOIN "tblAAT_Insp_Freq" aif ON sch.aatif_id = aif.aatif_id
    WHERE sch.ais_id = $1 AND sch.org_id = $2
  `;
  return await db.query(query, [ais_id, org_id]);
};

/**
 * Update inspection record (Execution)
 */
const updateInspectionRecord = async (ais_id, org_id, updateData) => {
  const keys = Object.keys(updateData);
  if (keys.length === 0) return null;
  
  const setClause = keys.map((key, index) => `${key} = $${index + 3}`).join(', ');
  const values = [ais_id, org_id, ...Object.values(updateData)];
  
  const query = `
    UPDATE "tblAAT_Insp_Sch"
    SET ${setClause}, changed_on = NOW()
    WHERE ais_id = $1 AND org_id = $2
    RETURNING *
  `;
  
  return await db.query(query, values);
};

/**
 * Get inspection checklist questions for an asset type
 * Updated to properly join with tblAATInspCheckList to get checklist items for specific asset type
 */
const getInspectionChecklistByAssetType = async (assetTypeId, org_id) => {
  const query = `
    SELECT 
      icl."insp_check_id" as insp_check_id,
      icl."inspection_text" as inspection_text,
      icl."response_type" as response_type,
      COALESCE(aatic."expected_value", icl."expected_value") as expected_value,
      COALESCE(aatic."min_range", icl."min_range") as min_range,
      COALESCE(aatic."max_range", icl."max_range") as max_range,
      COALESCE(aatic."trigger_maintenance", icl."trigger_maintenance") as trigger_maintenance
    FROM "tblInspCheckList" icl
    INNER JOIN "tblAATInspCheckList" aatic ON icl."insp_check_id" = aatic."insp_check_id"
    WHERE aatic."at_id" = $1 AND icl.org_id = $2
    ORDER BY icl."insp_check_id"
  `;
  return await db.query(query, [assetTypeId, org_id]);
};

/**
 * Get inspection records for a specific inspection schedule
 * Using ais_id to link inspection schedule to records
 */
const getInspectionRecords = async (aisId, org_id) => {
  // The tblAAT_Insp_Rec.aatisch_id stores the frequency id (aatif_id).
  // Map the provided ais_id to its aatif_id before querying records.
  const freqRes = await db.query(`SELECT aatif_id FROM "tblAAT_Insp_Sch" WHERE ais_id = $1 AND org_id = $2 LIMIT 1`, [aisId, org_id]);
  if (!freqRes || freqRes.rows.length === 0) {
    return { rows: [] };
  }
  const aatifId = freqRes.rows[0].aatif_id;

  const query = `
    SELECT 
      air."attirec_id" as attirec_id,
      air."aatisch_id" as aatisch_id,
      air."insp_check_id" as insp_check_id,
      air."recorded_value" as recorded_value,
      air.created_on,
      air.created_by,
      icl."inspection_text" as inspection_text,
      icl."response_type" as response_type
    FROM "tblAAT_Insp_Rec" air
    LEFT JOIN "tblInspCheckList" icl ON air."insp_check_id" = icl."insp_check_id"
    WHERE air."aatisch_id" = $1 AND air.org_id = $2
    ORDER BY air.created_on DESC
  `;
  return await db.query(query, [aatifId, org_id]);
};

/**
 * Create or update inspection record
 */
const saveInspectionRecord = async (recordData) => {
  // Support both passing schedule id (ais_id) or frequency id (aatisch_id).
  const { ais_id, aatisch_id, insp_check_id, recorded_value, created_by, org_id } = recordData;
  const linkId = aatisch_id || ais_id; // aatisch_id should be the frequency id (aatif_id)

  // Generate unique ID
  const timestamp = Date.now().toString();
  const attirec_id = `ATTIREC_${timestamp}`;

  // Check if record already exists
  const checkQuery = `
    SELECT attirec_id FROM "tblAAT_Insp_Rec"
    WHERE aatisch_id = $1 AND insp_check_id = $2
  `;
  const existingRecord = await db.query(checkQuery, [linkId, insp_check_id]);

  if (existingRecord.rows.length > 0) {
    // Update existing record
    const updateQuery = `
      UPDATE "tblAAT_Insp_Rec"
      SET recorded_value = $1, created_by = $2, created_on = NOW()
      WHERE aatisch_id = $3 AND insp_check_id = $4
      RETURNING *
    `;
    return await db.query(updateQuery, [recorded_value, created_by, linkId, insp_check_id]);
  } else {
    // Create new record
    const insertQuery = `
      INSERT INTO "tblAAT_Insp_Rec" (
        attirec_id,
        aatisch_id,
        insp_check_id,
        recorded_value,
        org_id,
        created_by,
        created_on
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;
    return await db.query(insertQuery, [
      attirec_id, linkId, insp_check_id, recorded_value, org_id, created_by
    ]);
  }
};

module.exports = {
  getAssetTypesRequiringInspection,
  getInspectionFrequency,
  getAssetByIdForInspection,
  getAssetsByAssetType,
  getGroupsByAssetType,
  getAssetsByGroupId,
  checkWorkflowExists,
  getInspectionJobRole,
  checkExistingWorkflowInspection,
  checkExistingDirectInspection,
  getLastCompletedInspectionDate,
  createWorkflowInspectionHeader,
  createWorkflowInspectionDetail,
  createDirectInspectionSchedule,
  calculateNextInspectionDate,
  generateUniqueId,
  getInspectionList,
  getInspectionDetailsById,
  updateInspectionRecord,
  getInspectionChecklistByAssetType,
  getInspectionRecords,
  saveInspectionRecord
};
