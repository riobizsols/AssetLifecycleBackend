const db = require('../config/db');

// Get available assets by asset type (excluding those already in asset groups)
const getAvailableAssetsByAssetType = async (asset_type_id) => {
    const query = `
        SELECT 
            a.asset_id, 
            a.asset_type_id, 
            a.text, 
            a.serial_number, 
            a.description,
            a.branch_id, 
            a.purchase_vendor_id, 
            a.service_vendor_id, 
            a.prod_serv_id, 
            a.maintsch_id, 
            a.purchased_cost,
            a.purchased_on, 
            a.purchased_by, 
            a.expiry_date, 
            a.current_status, 
            a.warranty_period,
            a.parent_asset_id, 
            a.group_id, 
            a.org_id, 
            a.created_by, 
            a.created_on, 
            a.changed_by, 
            a.changed_on,
            at.text as asset_type_name,
            at.assignment_type,
            at.group_required,
            CASE 
                WHEN a.expiry_date IS NOT NULL THEN 
                    a.expiry_date - CURRENT_DATE
                ELSE NULL
            END as days_until_expiry
        FROM "tblAssets" a
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE a.asset_type_id = $1
        AND a.current_status = 'Active'
        AND NOT EXISTS (
            SELECT 1 
            FROM "tblAssetGroup_D" agd 
            WHERE agd.asset_id = a.asset_id
        )
        ORDER BY a.text ASC
    `;

    return await db.query(query, [asset_type_id]);
};

// Get all available assets (not in any group) for all asset types
const getAllAvailableAssets = async () => {
    const query = `
        SELECT 
            a.asset_id, 
            a.asset_type_id, 
            a.text, 
            a.serial_number, 
            a.description,
            a.branch_id, 
            a.purchase_vendor_id, 
            a.service_vendor_id, 
            a.prod_serv_id, 
            a.maintsch_id, 
            a.purchased_cost,
            a.purchased_on, 
            a.purchased_by, 
            a.expiry_date, 
            a.current_status, 
            a.warranty_period,
            a.parent_asset_id, 
            a.group_id, 
            a.org_id, 
            a.created_by, 
            a.created_on, 
            a.changed_by, 
            a.changed_on,
            at.text as asset_type_name,
            at.assignment_type,
            at.group_required,
            CASE 
                WHEN a.expiry_date IS NOT NULL THEN 
                    a.expiry_date - CURRENT_DATE
                ELSE NULL
            END as days_until_expiry
        FROM "tblAssets" a
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE a.current_status = 'Active'
        AND NOT EXISTS (
            SELECT 1 
            FROM "tblAssetGroup_D" agd 
            WHERE agd.asset_id = a.asset_id
        )
        ORDER BY at.text ASC, a.text ASC
    `;

    return await db.query(query);
};

// Get available assets by asset type with additional filters
const getAvailableAssetsByAssetTypeWithFilters = async (asset_type_id, filters = {}) => {
    let query = `
        SELECT 
            a.asset_id, 
            a.asset_type_id, 
            a.text, 
            a.serial_number, 
            a.description,
            a.branch_id, 
            a.purchase_vendor_id, 
            a.service_vendor_id, 
            a.prod_serv_id, 
            a.maintsch_id, 
            a.purchased_cost,
            a.purchased_on, 
            a.purchased_by, 
            a.expiry_date, 
            a.current_status, 
            a.warranty_period,
            a.parent_asset_id, 
            a.group_id, 
            a.org_id, 
            a.created_by, 
            a.created_on, 
            a.changed_by, 
            a.changed_on,
            at.text as asset_type_name,
            at.assignment_type,
            at.group_required,
            CASE 
                WHEN a.expiry_date IS NOT NULL THEN 
                    a.expiry_date - CURRENT_DATE
                ELSE NULL
            END as days_until_expiry
        FROM "tblAssets" a
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE a.asset_type_id = $1
        AND a.current_status = 'Active'
        AND NOT EXISTS (
            SELECT 1 
            FROM "tblAssetGroup_D" agd 
            WHERE agd.asset_id = a.asset_id
        )
    `;

    const params = [asset_type_id];
    let paramIndex = 2;

    // Add branch filter
    if (filters.branch_id) {
        query += ` AND a.branch_id = $${paramIndex}`;
        params.push(filters.branch_id);
        paramIndex++;
    }

    // Add vendor filter
    if (filters.vendor_id) {
        query += ` AND (a.purchase_vendor_id = $${paramIndex} OR a.service_vendor_id = $${paramIndex})`;
        params.push(filters.vendor_id);
        paramIndex++;
    }

    // Add expiry filter
    if (filters.expiring_soon) {
        const days = filters.expiring_soon;
        query += ` AND a.expiry_date IS NOT NULL AND a.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'`;
    }

    // Add search filter
    if (filters.search) {
        query += ` AND (a.text ILIKE $${paramIndex} OR a.serial_number ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
    }

    query += ` ORDER BY a.text ASC`;

    return await db.query(query, params);
};

// Get count of available assets by asset type
const getAvailableAssetsCountByAssetType = async (asset_type_id) => {
    const query = `
        SELECT COUNT(*) as count
        FROM "tblAssets" a
        WHERE a.asset_type_id = $1
        AND a.current_status = 'Active'
        AND NOT EXISTS (
            SELECT 1 
            FROM "tblAssetGroup_D" agd 
            WHERE agd.asset_id = a.asset_id
        )
    `;

    return await db.query(query, [asset_type_id]);
};

// Check if asset is available for grouping
const isAssetAvailableForGrouping = async (asset_id) => {
    const query = `
        SELECT 
            a.asset_id,
            a.text,
            a.current_status,
            CASE 
                WHEN agd.asset_id IS NOT NULL THEN false
                ELSE true
            END as is_available
        FROM "tblAssets" a
        LEFT JOIN "tblAssetGroup_D" agd ON a.asset_id = agd.asset_id
        WHERE a.asset_id = $1
    `;

    return await db.query(query, [asset_id]);
};

module.exports = {
    getAvailableAssetsByAssetType,
    getAllAvailableAssets,
    getAvailableAssetsByAssetTypeWithFilters,
    getAvailableAssetsCountByAssetType,
    isAssetAvailableForGrouping
};
