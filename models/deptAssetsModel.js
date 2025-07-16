const db = require("../config/db");

exports.getAssetMeta = (asset_type_id) => {
    return db.query(
        'SELECT org_id, ext_id FROM "tblAssetTypes" WHERE asset_type_id = $1',
        [asset_type_id]
    );
};

exports.getLastDeptAssetId = () => {
    return db.query('SELECT id FROM "tblDeptAssets" ORDER BY id DESC LIMIT 1');
};

exports.insertDeptAsset = (
    id,
    ext_id,
    dept_id,
    asset_type_id,
    org_id,
    created_by
) => {
    return db.query(
        `INSERT INTO "tblDeptAssets" (
      id, ext_id, dept_id, asset_type_id, org_id,
      created_by, created_on, changed_by, changed_on
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, CURRENT_DATE, $6, CURRENT_DATE
    )`,
        [id, ext_id, dept_id, asset_type_id, org_id, created_by]
    );
};

exports.deleteDeptAsset = (id) => {
    return db.query('DELETE FROM "tblDeptAssets" WHERE id = $1', [id]);
};

exports.getAllDeptAssets = () => {
    return db.query(`
    SELECT da.id, da.dept_id, da.asset_type_id, d.text AS dept_name, at.text AS asset_name
    FROM "tblDeptAssets" da
    JOIN "tblDepartments" d ON da.dept_id = d.dept_id
    JOIN "tblAssetTypes" at ON da.asset_type_id = at.asset_type_id
    ORDER BY da.id
  `);
};
