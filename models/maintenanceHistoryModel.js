const db = require('../config/db');

// Get maintenance history with filtering capabilities
const getMaintenanceHistory = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply filters
    if (filters.asset_id) {
        query += ` AND ams.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND ams.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.wo_id) {
        query += ` AND ams.wo_id = $${paramIndex}`;
        queryParams.push(filters.wo_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND LOWER(ams.notes) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND ams.act_maint_st_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND ams.act_maint_st_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND ams.act_main_end_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND ams.act_main_end_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.status) {
        query += ` AND ams.status = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
    }
    
    if (filters.maintenance_type_id) {
        query += ` AND ams.maint_type_id = $${paramIndex}`;
        queryParams.push(filters.maintenance_type_id);
        paramIndex++;
    }
    
    // Add ordering
    query += ` ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC`;
    
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

// Get maintenance history count for pagination
const getMaintenanceHistoryCount = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT COUNT(*) as total_count
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply the same filters as the main query
    if (filters.asset_id) {
        query += ` AND ams.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND ams.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.wo_id) {
        query += ` AND ams.wo_id = $${paramIndex}`;
        queryParams.push(filters.wo_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND LOWER(ams.notes) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND ams.act_maint_st_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND ams.act_maint_st_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND ams.act_main_end_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND ams.act_main_end_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.status) {
        query += ` AND ams.status = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
    }
    
    if (filters.maintenance_type_id) {
        query += ` AND ams.maint_type_id = $${paramIndex}`;
        queryParams.push(filters.maintenance_type_id);
        paramIndex++;
    }
    
    return await db.query(query, queryParams);
};

// Get maintenance history by asset ID
const getMaintenanceHistoryByAsset = async (assetId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.asset_id = $1 AND ams.org_id = $2
        ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC
    `;
    
    return await db.query(query, [assetId, orgId]);
};

// Get maintenance history by work order ID
const getMaintenanceHistoryByWorkOrder = async (woId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.wo_id = $1 AND ams.org_id = $2
        ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC
    `;
    
    return await db.query(query, [woId, orgId]);
};

// Get maintenance history summary statistics
const getMaintenanceHistorySummary = async (orgId = 'ORG001') => {
    const query = `
        SELECT 
            COUNT(*) as total_maintenance_records,
            COUNT(CASE WHEN status = 'CO' THEN 1 END) as completed_maintenance,
            COUNT(CASE WHEN status = 'IN' THEN 1 END) as in_progress_maintenance,
            COUNT(CASE WHEN status = 'CA' THEN 1 END) as cancelled_maintenance,
            COUNT(CASE WHEN act_maint_st_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as maintenance_last_30_days,
            COUNT(CASE WHEN act_maint_st_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as maintenance_last_90_days,
            COUNT(DISTINCT asset_id) as unique_assets_maintained,
            COUNT(DISTINCT vendor_id) as unique_vendors_used
        FROM "tblAssetMaintSch"
        WHERE org_id = $1
    `;
    
    return await db.query(query, [orgId]);
};

// Get available filter options for dropdowns
const getFilterOptions = async (orgId = 'ORG001') => {
    // Get asset options
    const assetQuery = `
        SELECT DISTINCT a.asset_id, a.serial_number, a.description
        FROM "tblAssets" a 
        WHERE a.org_id = $1
        ORDER BY a.asset_id
    `;
    
    // Get vendor options
    const vendorQuery = `
        SELECT DISTINCT v.vendor_id, v.vendor_name
        FROM "tblVendors" v 
        WHERE v.org_id = $1
        ORDER BY v.vendor_name
    `;
    
    // Get work order options
    const workOrderQuery = `
        SELECT DISTINCT ams.wo_id
        FROM "tblAssetMaintSch" ams 
        WHERE ams.org_id = $1 AND ams.wo_id IS NOT NULL
        ORDER BY ams.wo_id
    `;
    
    // Get maintenance type options
    const maintenanceTypeQuery = `
        SELECT DISTINCT mt.maint_type_id, mt.text as maintenance_type_name
        FROM "tblMaintTypes" mt 
        WHERE mt.org_id = $1
        ORDER BY mt.text
    `;
    
    // Get status options
    const statusQuery = `
        SELECT DISTINCT ams.status
        FROM "tblAssetMaintSch" ams 
        WHERE ams.org_id = $1 AND ams.status IS NOT NULL
        ORDER BY ams.status
    `;
    
    const [assetResult, vendorResult, workOrderResult, maintenanceTypeResult, statusResult] = await Promise.all([
        db.query(assetQuery, [orgId]),
        db.query(vendorQuery, [orgId]),
        db.query(workOrderQuery, [orgId]),
        db.query(maintenanceTypeQuery, [orgId]),
        db.query(statusQuery, [orgId])
    ]);
    
    return {
        rows: [{
            asset_options: assetResult.rows,
            vendor_options: vendorResult.rows,
            work_order_options: workOrderResult.rows,
            maintenance_type_options: maintenanceTypeResult.rows,
            status_options: statusResult.rows
        }]
    };
};

module.exports = {
    getMaintenanceHistory,
    getMaintenanceHistoryCount,
    getMaintenanceHistoryByAsset,
    getMaintenanceHistoryByWorkOrder,
    getMaintenanceHistorySummary,
    getFilterOptions
};
