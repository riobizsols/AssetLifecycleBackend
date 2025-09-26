const db = require("../config/db");

exports.getAssetMeta = (asset_type_id) => {
    return db.query(
        'SELECT org_id FROM "tblAssetTypes" WHERE asset_type_id = $1',
        [asset_type_id]
    );
};

exports.getLastDeptAssetId = () => {
    return db.query('SELECT dept_asset_type_id FROM "tblDeptAssetTypes" ORDER BY dept_asset_type_id DESC LIMIT 1');
};

exports.insertDeptAsset = (
    dept_asset_type_id,
    dept_id,
    asset_type_id,
    org_id,
    created_by
) => {
    return db.query(
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
    return db.query('DELETE FROM "tblDeptAssetTypes" WHERE dept_asset_type_id = $1', [dept_asset_type_id]);
};

exports.getAllDeptAssets = () => {
    return db.query(`
    SELECT da.dept_asset_type_id, da.dept_id, da.asset_type_id, d.text AS dept_name, at.text AS asset_name
    FROM "tblDeptAssetTypes" da
    JOIN "tblDepartments" d ON da.dept_id = d.dept_id
    JOIN "tblAssetTypes" at ON da.asset_type_id = at.asset_type_id
    WHERE da.int_status = 1
    ORDER BY da.dept_asset_type_id
  `);
};

exports.getAssetTypesByDepartment = (dept_id) => {
    return db.query(`
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
