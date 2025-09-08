const db = require('../config/db');

// Get breakdown history with filtering capabilities
const getBreakdownHistory = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT 
            -- Breakdown Information
            brd.abr_id,
            brd.asset_id,
            brd.atbrrc_id,
            brd.reported_by,
            brd.is_create_maintenance,
            brd.decision_code,
            brd.status as breakdown_status,
            brd.description as breakdown_description,
            brd.created_on as breakdown_date,
            brd.created_on as breakdown_updated_on,
            brd.reported_by as breakdown_updated_by,
            brd.org_id,
            
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            a.service_vendor_id,
            a.group_id,
            a.branch_id,
            
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            at.maint_lead_type,
            
            -- Breakdown Reason Code Information
            brc.text as breakdown_reason,
            brc.instatus as reason_code_status,
            
            -- Reported By User Information
            u.full_name as reported_by_name,
            u.email as reported_by_email,
            u.phone as reported_by_phone,
            
            -- Department Information (from user)
            d.text as department_name,
            d.dept_id,
            
            -- Vendor Information
            v.vendor_id,
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address,
            
            -- Work Order Information (if maintenance was created)
            ams.ams_id as work_order_id,
            ams.act_maint_st_date as maintenance_start_date,
            ams.act_main_end_date as maintenance_end_date,
            ams.status as maintenance_status,
            ams.notes as maintenance_notes,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            
            -- Branch Information
            b.text as branch_name,
            
            -- Group Information
            ag.text as group_name
            
        FROM "tblAssetBRDet" brd
        INNER JOIN "tblAssets" a ON brd.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
        LEFT JOIN "tblUsers" u ON brd.reported_by = u.user_id
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
        LEFT JOIN "tblAssetMaintSch" ams ON brd.asset_id = ams.asset_id 
            AND ams.status IN ('IN', 'AP', 'IP', 'CO')
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblAssetGroup_H" ag ON a.group_id = ag.assetgroup_h_id
        WHERE brd.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply filters
    if (filters.asset_id) {
        query += ` AND brd.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND a.service_vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.work_order_id) {
        query += ` AND ams.ams_id = $${paramIndex}`;
        queryParams.push(filters.work_order_id);
        paramIndex++;
    }
    
    if (filters.reported_by) {
        query += ` AND (LOWER(u.full_name) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}))`;
        queryParams.push(`%${filters.reported_by}%`);
        paramIndex++;
    }
    
    if (filters.breakdown_date_from) {
        query += ` AND brd.created_on >= $${paramIndex}`;
        queryParams.push(filters.breakdown_date_from);
        paramIndex++;
    }
    
    if (filters.breakdown_date_to) {
        query += ` AND brd.created_on <= $${paramIndex}`;
        queryParams.push(filters.breakdown_date_to);
        paramIndex++;
    }
    
    if (filters.breakdown_status) {
        query += ` AND brd.status = $${paramIndex}`;
        queryParams.push(filters.breakdown_status);
        paramIndex++;
    }
    
    if (filters.decision_code) {
        query += ` AND brd.decision_code = $${paramIndex}`;
        queryParams.push(filters.decision_code);
        paramIndex++;
    }
    
    if (filters.description) {
        query += ` AND LOWER(brd.description) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.description}%`);
        paramIndex++;
    }
    
    if (filters.department_id) {
        query += ` AND u.dept_id = $${paramIndex}`;
        queryParams.push(filters.department_id);
        paramIndex++;
    }
    
    if (filters.asset_type_id) {
        query += ` AND a.asset_type_id = $${paramIndex}`;
        queryParams.push(filters.asset_type_id);
        paramIndex++;
    }
    
    if (filters.branch_id) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    if (filters.group_id) {
        query += ` AND a.group_id = $${paramIndex}`;
        queryParams.push(filters.group_id);
        paramIndex++;
    }
    
    // Add ordering
    query += ` ORDER BY brd.created_on DESC`;
    
    // Add pagination if specified
    if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(filters.limit);
        paramIndex++;
        
        if (filters.offset) {
            query += ` OFFSET $${paramIndex}`;
            queryParams.push(filters.offset);
        }
    }
    
    return await db.query(query, queryParams);
};

// Get breakdown history count for pagination
const getBreakdownHistoryCount = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT COUNT(DISTINCT brd.abr_id) as total_count
        FROM "tblAssetBRDet" brd
        INNER JOIN "tblAssets" a ON brd.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
        LEFT JOIN "tblUsers" u ON brd.reported_by = u.user_id
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
        LEFT JOIN "tblAssetMaintSch" ams ON brd.asset_id = ams.asset_id 
            AND ams.status IN ('IN', 'AP', 'IP', 'CO')
        WHERE brd.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply the same filters as the main query
    if (filters.asset_id) {
        query += ` AND brd.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND a.service_vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.work_order_id) {
        query += ` AND ams.ams_id = $${paramIndex}`;
        queryParams.push(filters.work_order_id);
        paramIndex++;
    }
    
    if (filters.reported_by) {
        query += ` AND (LOWER(u.full_name) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}))`;
        queryParams.push(`%${filters.reported_by}%`);
        paramIndex++;
    }
    
    if (filters.breakdown_date_from) {
        query += ` AND brd.created_on >= $${paramIndex}`;
        queryParams.push(filters.breakdown_date_from);
        paramIndex++;
    }
    
    if (filters.breakdown_date_to) {
        query += ` AND brd.created_on <= $${paramIndex}`;
        queryParams.push(filters.breakdown_date_to);
        paramIndex++;
    }
    
    if (filters.breakdown_status) {
        query += ` AND brd.status = $${paramIndex}`;
        queryParams.push(filters.breakdown_status);
        paramIndex++;
    }
    
    if (filters.decision_code) {
        query += ` AND brd.decision_code = $${paramIndex}`;
        queryParams.push(filters.decision_code);
        paramIndex++;
    }
    
    if (filters.description) {
        query += ` AND LOWER(brd.description) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.description}%`);
        paramIndex++;
    }
    
    if (filters.department_id) {
        query += ` AND u.dept_id = $${paramIndex}`;
        queryParams.push(filters.department_id);
        paramIndex++;
    }
    
    if (filters.asset_type_id) {
        query += ` AND a.asset_type_id = $${paramIndex}`;
        queryParams.push(filters.asset_type_id);
        paramIndex++;
    }
    
    if (filters.branch_id) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    if (filters.group_id) {
        query += ` AND a.group_id = $${paramIndex}`;
        queryParams.push(filters.group_id);
        paramIndex++;
    }
    
    return await db.query(query, queryParams);
};

// Get breakdown history by asset ID
const getBreakdownHistoryByAsset = async (assetId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            -- Breakdown Information
            brd.abr_id,
            brd.asset_id,
            brd.atbrrc_id,
            brd.reported_by,
            brd.is_create_maintenance,
            brd.decision_code,
            brd.status as breakdown_status,
            brd.description as breakdown_description,
            brd.created_on as breakdown_date,
            brd.created_on as breakdown_updated_on,
            brd.reported_by as breakdown_updated_by,
            brd.org_id,
            
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            a.service_vendor_id,
            a.group_id,
            a.branch_id,
            
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            at.maint_lead_type,
            
            -- Breakdown Reason Code Information
            brc.text as breakdown_reason,
            brc.instatus as reason_code_status,
            
            -- Reported By User Information
            u.full_name as reported_by_name,
            u.email as reported_by_email,
            u.phone as reported_by_phone,
            
            -- Department Information (from user)
            d.text as department_name,
            d.dept_id,
            
            -- Vendor Information
            v.vendor_id,
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address,
            
            -- Work Order Information (if maintenance was created)
            ams.ams_id as work_order_id,
            ams.act_maint_st_date as maintenance_start_date,
            ams.act_main_end_date as maintenance_end_date,
            ams.status as maintenance_status,
            ams.notes as maintenance_notes,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            
            -- Branch Information
            b.text as branch_name,
            
            -- Group Information
            ag.text as group_name
            
        FROM "tblAssetBRDet" brd
        INNER JOIN "tblAssets" a ON brd.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
        LEFT JOIN "tblUsers" u ON brd.reported_by = u.user_id
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
        LEFT JOIN "tblAssetMaintSch" ams ON brd.asset_id = ams.asset_id 
            AND ams.status IN ('IN', 'AP', 'IP', 'CO')
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblAssetGroup_H" ag ON a.group_id = ag.assetgroup_h_id
        WHERE brd.asset_id = $1 AND brd.org_id = $2
        ORDER BY brd.created_on DESC
    `;
    
    return await db.query(query, [assetId, orgId]);
};

// Get breakdown history summary statistics
const getBreakdownHistorySummary = async (orgId = 'ORG001') => {
    const query = `
        SELECT 
            COUNT(DISTINCT brd.abr_id) as total_breakdown_records,
            COUNT(CASE WHEN brd.status = 'CR' THEN 1 END) as created_breakdowns,
            COUNT(CASE WHEN brd.status = 'IN' THEN 1 END) as in_progress_breakdowns,
            COUNT(CASE WHEN brd.status = 'CO' THEN 1 END) as completed_breakdowns,
            COUNT(CASE WHEN brd.decision_code = 'BF01' THEN 1 END) as breakdowns_with_maintenance,
            COUNT(CASE WHEN brd.decision_code = 'BF02' THEN 1 END) as breakdowns_without_maintenance,
            COUNT(CASE WHEN brd.decision_code = 'BF03' THEN 1 END) as breakdowns_cancelled,
            COUNT(CASE WHEN brd.created_on >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as breakdowns_last_30_days,
            COUNT(CASE WHEN brd.created_on >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as breakdowns_last_90_days,
            COUNT(DISTINCT brd.asset_id) as unique_assets_with_breakdowns,
            COUNT(DISTINCT brd.reported_by) as unique_reporters,
            COUNT(DISTINCT a.service_vendor_id) as unique_vendors_involved
        FROM "tblAssetBRDet" brd
        LEFT JOIN "tblAssets" a ON brd.asset_id = a.asset_id
        WHERE brd.org_id = $1
    `;
    
    return await db.query(query, [orgId]);
};

// Get available filter options for dropdowns
const getBreakdownFilterOptions = async (orgId = 'ORG001') => {
    // Get asset options
    const assetQuery = `
        SELECT DISTINCT a.asset_id, a.serial_number, a.description
        FROM "tblAssets" a 
        INNER JOIN "tblAssetBRDet" brd ON a.asset_id = brd.asset_id
        WHERE a.org_id = $1
        ORDER BY a.asset_id
    `;
    
    // Get vendor options
    const vendorQuery = `
        SELECT DISTINCT v.vendor_id, v.vendor_name
        FROM "tblVendors" v 
        INNER JOIN "tblAssets" a ON v.vendor_id = a.service_vendor_id
        INNER JOIN "tblAssetBRDet" brd ON a.asset_id = brd.asset_id
        WHERE v.org_id = $1
        ORDER BY v.vendor_name
    `;
    
    // Get work order options
    const workOrderQuery = `
        SELECT DISTINCT ams.ams_id as work_order_id
        FROM "tblAssetMaintSch" ams 
        INNER JOIN "tblAssetBRDet" brd ON ams.asset_id = brd.asset_id
        WHERE ams.org_id = $1 AND ams.status IN ('IN', 'AP', 'IP', 'CO')
        ORDER BY ams.ams_id
    `;
    
    // Get reported by user options
    const reportedByQuery = `
        SELECT DISTINCT u.user_id, u.full_name, u.email
        FROM "tblUsers" u 
        INNER JOIN "tblAssetBRDet" brd ON u.user_id = brd.reported_by
        WHERE u.org_id = $1
        ORDER BY u.full_name
    `;
    
    // Get breakdown status options
    const breakdownStatusQuery = `
        SELECT DISTINCT brd.status as breakdown_status
        FROM "tblAssetBRDet" brd 
        WHERE brd.org_id = $1 AND brd.status IS NOT NULL
        ORDER BY brd.status
    `;
    
    // Get decision code options
    const decisionCodeQuery = `
        SELECT DISTINCT brd.decision_code
        FROM "tblAssetBRDet" brd 
        WHERE brd.org_id = $1 AND brd.decision_code IS NOT NULL
        ORDER BY brd.decision_code
    `;
    
    // Get breakdown reason options
    const breakdownReasonQuery = `
        SELECT DISTINCT brc.atbrrc_id, brc.text as breakdown_reason
        FROM "tblATBRReasonCodes" brc 
        INNER JOIN "tblAssetBRDet" brd ON brc.atbrrc_id = brd.atbrrc_id
        WHERE brc.org_id = $1 AND brc.instatus = 'A'
        ORDER BY brc.text
    `;
    
    // Get department options
    const departmentQuery = `
        SELECT DISTINCT d.dept_id, d.text as department_name
        FROM "tblDepartments" d 
        INNER JOIN "tblUsers" u ON d.dept_id = u.dept_id
        INNER JOIN "tblAssetBRDet" brd ON u.user_id = brd.reported_by
        WHERE d.org_id = $1
        ORDER BY d.text
    `;
    
    // Get asset type options
    const assetTypeQuery = `
        SELECT DISTINCT at.asset_type_id, at.text as asset_type_name
        FROM "tblAssetTypes" at 
        INNER JOIN "tblAssets" a ON at.asset_type_id = a.asset_type_id
        INNER JOIN "tblAssetBRDet" brd ON a.asset_id = brd.asset_id
        WHERE at.org_id = $1
        ORDER BY at.text
    `;
    
    const [assetResult, vendorResult, workOrderResult, reportedByResult, breakdownStatusResult, decisionCodeResult, breakdownReasonResult, departmentResult, assetTypeResult] = await Promise.all([
        db.query(assetQuery, [orgId]),
        db.query(vendorQuery, [orgId]),
        db.query(workOrderQuery, [orgId]),
        db.query(reportedByQuery, [orgId]),
        db.query(breakdownStatusQuery, [orgId]),
        db.query(decisionCodeQuery, [orgId]),
        db.query(breakdownReasonQuery, [orgId]),
        db.query(departmentQuery, [orgId]),
        db.query(assetTypeQuery, [orgId])
    ]);
    
    return {
        rows: [{
            asset_options: assetResult.rows,
            vendor_options: vendorResult.rows,
            work_order_options: workOrderResult.rows,
            reported_by_options: reportedByResult.rows,
            breakdown_status_options: breakdownStatusResult.rows,
            decision_code_options: decisionCodeResult.rows,
            breakdown_reason_options: breakdownReasonResult.rows,
            department_options: departmentResult.rows,
            asset_type_options: assetTypeResult.rows
        }]
    };
};

module.exports = {
    getBreakdownHistory,
    getBreakdownHistoryCount,
    getBreakdownHistoryByAsset,
    getBreakdownHistorySummary,
    getBreakdownFilterOptions
};
