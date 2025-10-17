const db = require('../config/db');

// Get all work orders from tblAssetMaintSch with detailed information
const getAllWorkOrders = async (orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.*,
            a.asset_type_id,
            a.serial_number,
            a.description as asset_description,
            a.purchased_on,
            a.service_vendor_id,
            at.text as asset_type_name,
            at.maint_required,
            at.assignment_type,
            at.inspection_required,
            at.group_required,
            at.is_child,
            at.parent_asset_type_id,
            at.maint_type_id as asset_type_maint_type_id,
            at.maint_lead_type,
            at.depreciation_type,
            mt.text as maintenance_type_name,
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
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
            -- Get checklist items for this asset type
            (
                SELECT json_agg(
                    json_build_object(
                        'checklist_id', cl.at_main_checklist_id,
                        'text', cl.text,
                        'at_main_freq_id', cl.at_main_freq_id
                    )
                )
                FROM "tblATMaintCheckList" cl
                WHERE cl.asset_type_id = a.asset_type_id 
                AND cl.org_id = ams.org_id
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
            -- Get final approver name (highest sequence with status 'UA')
            (
                SELECT u.full_name
                FROM "tblWFAssetMaintSch_D" wfd
                LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
                WHERE wfd.wfamsh_id = ams.wfamsh_id
                  AND wfd.org_id = ams.org_id
                  AND wfd.status = 'UA'
                ORDER BY wfd.sequence DESC, wfd.created_on DESC
                LIMIT 1
            ) as final_approver_name,
            -- Get final approval date (changed_on of the same record)
            (
                SELECT wfd.changed_on
                FROM "tblWFAssetMaintSch_D" wfd
                WHERE wfd.wfamsh_id = ams.wfamsh_id
                  AND wfd.org_id = ams.org_id
                  AND wfd.status = 'UA'
                ORDER BY wfd.sequence DESC, wfd.created_on DESC
                LIMIT 1
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
        WHERE ams.org_id = $1 AND ams.status = 'IN' AND ams.maintained_by = 'Vendor'
        ORDER BY ams.created_on DESC
`;
    
    return await db.query(query, [orgId]);
};

// Get work order by ID with detailed information
const getWorkOrderById = async (amsId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.*,
            a.asset_type_id,
            a.serial_number,
            a.description as asset_description,
            a.purchased_on,
            a.service_vendor_id,
            at.text as asset_type_name,
            at.maint_required,
            at.assignment_type,
            at.inspection_required,
            at.group_required,
            at.is_child,
            at.parent_asset_type_id,
            at.maint_type_id as asset_type_maint_type_id,
            at.maint_lead_type,
            at.depreciation_type,
            mt.text as maintenance_type_name,
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
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
            -- Get checklist items for this asset type
            (
                SELECT json_agg(
                    json_build_object(
                        'checklist_id', cl.at_main_checklist_id,
                        'text', cl.text,
                        'at_main_freq_id', cl.at_main_freq_id
                    )
                )
                FROM "tblATMaintCheckList" cl
                WHERE cl.asset_type_id = a.asset_type_id 
                AND cl.org_id = ams.org_id
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
            -- Get final approver name (highest sequence with status 'UA')
            (
                SELECT u.full_name
                FROM "tblWFAssetMaintSch_D" wfd
                LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
                WHERE wfd.wfamsh_id = ams.wfamsh_id
                  AND wfd.org_id = ams.org_id
                  AND wfd.status = 'UA'
                ORDER BY wfd.sequence DESC, wfd.created_on DESC
                LIMIT 1
            ) as final_approver_name,
            -- Get final approval date (changed_on of the same record)
            (
                SELECT wfd.changed_on
                FROM "tblWFAssetMaintSch_D" wfd
                WHERE wfd.wfamsh_id = ams.wfamsh_id
                  AND wfd.org_id = ams.org_id
                  AND wfd.status = 'UA'
                ORDER BY wfd.sequence DESC, wfd.created_on DESC
                LIMIT 1
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
        WHERE ams.ams_id = $1 AND ams.org_id = $2 AND ams.status = 'IN' AND ams.maintained_by = 'Vendor'
    `;
    
    return await db.query(query, [amsId, orgId]);
};

module.exports = {
    getAllWorkOrders,
    getWorkOrderById
};
