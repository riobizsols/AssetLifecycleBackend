const db = require("../config/db");

const getAllAssets = async () => {
  const query = `
        SELECT 
           asset_id, asset_type_id, ext_id,  text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        ORDER BY created_on DESC
    `;

  return await db.query(query);
};

const getAssetById = async (asset_id) => {
  const query = `
        SELECT 
           asset_id, asset_type_id, ext_id,  text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE asset_id = $1
    `;

  return await db.query(query, [asset_id]);
};

const getAssetsByAssetType = async (asset_type_id) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE asset_type_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [asset_type_id]);
};

const getAssetsByBranch = async (branch_id) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE branch_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [branch_id]);
};

const getAssetsByVendor = async (vendor_id) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE vendor_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [vendor_id]);
};

const getAssetsByStatus = async (current_status) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE current_status = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [current_status]);
};

const getAssetsBySerialNumber = async (serial_number) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE serial_number = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [serial_number]);
};



const getAssetsByOrg = async (org_id) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE org_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [org_id]);
};

const getInactiveAssetsByAssetType = async (asset_type_id) => {
  const query = `
        SELECT 
            a.asset_type_id, a.ext_id, a.asset_id, a.text, a.serial_number, a.description,
            a.branch_id, a.vendor_id, a.prod_serve_id, a.maintsch_id, a.purchased_cost,
            a.purchased_on, a.purchased_by, a.expiry_date, a.current_status, a.warranty_period,
            a.parent_asset_id, a.group_id, a.org_id, a.created_by, a.created_on, a.changed_by, a.changed_on
        FROM "tblAssets" a
        WHERE a.asset_type_id = $1
        AND a.asset_id NOT IN (
            SELECT DISTINCT aa.asset_id 
            FROM "tblAssetAssignments" aa
            WHERE aa.action = 'A' AND aa.latest_assignment_flag = true
        )
        ORDER BY a.created_on DESC
    `;

  return await db.query(query, [asset_type_id]);
};

const searchAssets = async (searchTerm) => {
  const query = `
        SELECT 
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE 
            text ILIKE $1 OR 
            serial_number ILIKE $1 OR 
            description ILIKE $1 OR
            asset_id ILIKE $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [`%${searchTerm}%`]);
};

const getAssetWithDetails = async (asset_id) => {
  const query = `
        SELECT 
            a.asset_type_id, a.ext_id, a.asset_id, a.text, a.serial_number, a.description,
            a.branch_id, a.vendor_id, a.prod_serve_id, a.maintsch_id, a.purchased_cost,
            a.purchased_on, a.purchased_by, a.expiry_date, a.current_status, a.warranty_period,
            a.parent_asset_id, a.group_id, a.org_id, a.created_by, a.created_on, a.changed_by, a.changed_on,
            at.text as asset_type_name,
            b.text as branch_name,
            v.text as vendor_name,
            ps.text as prod_serv_name
        FROM "tblAssets" a
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblVendors" v ON a.vendor_id = v.vendor_id
        LEFT JOIN "tblProdServs" ps ON a.prod_serve_id = ps.prod_serv_id
        WHERE a.asset_id = $1
    `;

  return await db.query(query, [asset_id]);
};

const insertAsset = async (assetData) => {
  const {
    asset_type_id,
    ext_id,
    asset_id,
    text,
    serial_number,
    description,
    branch_id,
    vendor_id,
    prod_serve_id,
    maintsch_id,
    purchased_cost,
    purchased_on,
    purchased_by,
    expiry_date,
    current_status,
    warranty_period,
    parent_asset_id,
    group_id,
    org_id,
    created_by,
  } = assetData;

  const query = `
        INSERT INTO "tblAssets" (
            asset_type_id, ext_id, asset_id, text, serial_number, description,
            branch_id, vendor_id, prod_serve_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, $20, CURRENT_TIMESTAMP)
        RETURNING *
    `;

  const values = [
    asset_type_id,
    ext_id,
    asset_id,
    text,
    serial_number,
    description,
    branch_id,
    vendor_id,
    prod_serve_id,
    maintsch_id,
    purchased_cost,
    purchased_on,
    purchased_by,
    expiry_date,
    current_status,
    warranty_period,
    parent_asset_id,
    group_id,
    org_id,
    created_by,
  ];

  return await db.query(query, values);
};


const checkAssetExists = async (ext_id, org_id) => {
  const query = `
        SELECT asset_id FROM "tblAssets"
        WHERE ext_id = $1 AND org_id = $2
    `;

  return await db.query(query, [ext_id, org_id]);
};

const checkAssetIdExists = async (asset_id) => {
  const query = `
        SELECT asset_id FROM "tblAssets"
        WHERE asset_id = $1
    `;

  return await db.query(query, [asset_id]);
};

const checkVendorExists = async (vendor_id) => {
  const query = `
        SELECT vendor_id FROM "tblVendors"
        WHERE vendor_id = $1
    `;

  return await db.query(query, [vendor_id]);
};

const checkProdServExists = async (prod_serv_id) => {
  const query = `
        SELECT prod_serv_id FROM "tblProdServs"
        WHERE prod_serv_id = $1
    `;

  return await db.query(query, [prod_serv_id]);
};

const getAssetTypeAssignmentType = async (asset_id) => {
  const query = `
        SELECT at.assignment_type
        FROM "tblAssets" a
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE a.asset_id = $1
    `;

  return await db.query(query, [asset_id]);
};

const insertAssetPropValue = async (propValueData) => {
  const {
    asset_id,
    ext_id,
    org_id,
    asset_type_prop_id,
    value
  } = propValueData;

  // Generate a unique apv_id if sequence doesn't exist
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const apvId = `APV${timestamp}${random}`;

  const query = `
        INSERT INTO "tblAssetPropValues" (
            apv_id, asset_id, ext_id, org_id, asset_type_prop_id, value
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;

  const values = [apvId, asset_id, ext_id, org_id, asset_type_prop_id, value];
  return await db.query(query, values);
};

const generateAssetId = async () => {
  // Generate a unique asset ID with format: AST + timestamp + random number
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const assetId = `AST${timestamp}${random}`;
  
  // Check if this ID already exists
  const existing = await checkAssetIdExists(assetId);
  if (existing.rows.length > 0) {
    // If exists, generate a new one recursively
    return generateAssetId();
  }
  
  return assetId;
}
const deleteAsset = async (asset_id) => {
  const query = `
        DELETE FROM "tblAssets"
        WHERE asset_id = $1
        RETURNING *
    `;

  return await db.query(query, [asset_id]);
};

const deleteMultipleAssets = async (asset_ids) => {
  const query = `
        DELETE FROM "tblAssets"
        WHERE asset_id = ANY($1::text[])
        RETURNING *
    `;

  return await db.query(query, [asset_ids]);
};

module.exports = {
  getAllAssets,
  getAssetById,
  getAssetsByAssetType,
  getAssetsByBranch,
  getAssetsByVendor,
  getAssetsByStatus,
  getAssetsBySerialNumber,
  getAssetsByOrg,
  getInactiveAssetsByAssetType,
  searchAssets,
  getAssetWithDetails,
  insertAsset,
  checkAssetExists,
  checkAssetIdExists,
  checkVendorExists,
  checkProdServExists,
  getAssetTypeAssignmentType,
  insertAssetPropValue,
  generateAssetId,
  deleteAsset,
  deleteMultipleAssets,
};
