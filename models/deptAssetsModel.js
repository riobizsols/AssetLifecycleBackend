const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


exports.getAssetMeta = (asset_type_id) => {
    const dbPool = getDb();

    return dbPool.query(
        'SELECT org_id FROM "tblAssetTypes" WHERE asset_type_id = $1',
        [asset_type_id]
    );
};

exports.getLastDeptAssetId = () => {
    const dbPool = getDb();

    return dbPool.query('SELECT dept_asset_type_id FROM "tblDeptAssetTypes" ORDER BY dept_asset_type_id DESC LIMIT 1');
};

exports.insertDeptAsset = (
    dept_asset_type_id,
    dept_id,
    asset_type_id,
    org_id,
    created_by
) => {
    const dbPool = getDb();

    return dbPool.query(
        `INSERT INTO "tblDeptAssetTypes" (
      dept_asset_type_id, dept_id, asset_type_id, org_id,
      created_by, created_on, changed_by, changed_on, int_status
    ) VALUES (
      $1, $2, $3, $4,
      $5, CURRENT_DATE, $5, CURRENT_DATE, 1
    )`,
        [dept_asset_type_id, dept_id, asset_type_id, org_id, created_by]
    );
};

exports.deleteDeptAsset = (dept_asset_type_id) => {
    const dbPool = getDb();

    return dbPool.query('DELETE FROM "tblDeptAssetTypes" WHERE dept_asset_type_id = $1', [dept_asset_type_id]);
};

<<<<<<< HEAD
// Get all department asset mappings - supports super access users
exports.getAllDeptAssets = (org_id, branch_id, hasSuperAccess = false) => {
    const dbPool = getDb();
    
    let query = `
=======
exports.getAllDeptAssets = () => {
    const dbPool = getDb();

    return dbPool.query(`
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
    SELECT da.dept_asset_type_id, da.dept_id, da.asset_type_id, d.text AS dept_name, at.text AS asset_name
    FROM "tblDeptAssetTypes" da
    JOIN "tblDepartments" d ON da.dept_id = d.dept_id
    JOIN "tblAssetTypes" at ON da.asset_type_id = at.asset_type_id
    WHERE da.int_status = 1 AND da.org_id = $1 AND d.org_id = $1 AND at.org_id = $1
    `;
    const params = [org_id];
    
    // Apply branch filter only if user doesn't have super access
    if (!hasSuperAccess && branch_id) {
        query += ` AND d.branch_id = $2`;
        params.push(branch_id);
    }
    
    query += ` ORDER BY da.dept_asset_type_id`;
    
    return dbPool.query(query, params);
};

exports.getAssetTypesByDepartment = (dept_id) => {
    const dbPool = getDb();

    return dbPool.query(`
    SELECT 
        at.asset_type_id,
        at.text AS asset_type_name,
        at.assignment_type,
        at.group_required,
        at.inspection_required,
        at.maint_required,
        at.is_child,
        at.parent_asset_type_id,
        at.maint_type_id,
        at.maint_lead_type,
        at.depreciation_type,
        da.dept_asset_type_id,
        da.dept_id,
        d.text AS dept_name
    FROM "tblDeptAssetTypes" da
    JOIN "tblAssetTypes" at ON da.asset_type_id = at.asset_type_id
    JOIN "tblDepartments" d ON da.dept_id = d.dept_id
    WHERE da.dept_id = $1 
    AND da.int_status = 1 
    AND at.int_status = 1
    ORDER BY at.text
  `, [dept_id]);
};
