const db = require("../config/db");
const { generateCustomId } = require('../utils/idGenerator');

const getAllAssets = async () => {
  const query = `
                SELECT 
            asset_id, asset_type_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_id, asset_type_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
            purchased_on, purchased_by, expiry_date, current_status, warranty_period,
            parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE purchase_vendor_id = $1 OR service_vendor_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [vendor_id]);
};

const getAssetsByStatus = async (current_status) => {
  const query = `
        SELECT 
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            a.asset_type_id, a.asset_id, a.text, a.serial_number, a.description,
            a.branch_id, a.purchase_vendor_id, a.service_vendor_id, a.prod_serv_id, a.maintsch_id, a.purchased_cost,
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
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
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
            a.asset_type_id, a.asset_id, a.text, a.serial_number, a.description,
            a.branch_id, a.purchase_vendor_id, a.service_vendor_id, a.prod_serv_id, a.maintsch_id, a.purchased_cost,
            a.purchased_on, a.purchased_by, a.expiry_date, a.current_status, a.warranty_period,
            a.parent_asset_id, a.group_id, a.org_id, a.created_by, a.created_on, a.changed_by, a.changed_on,
            at.text as asset_type_name,
            at.is_child,
            at.parent_asset_type_id,
            pat.text as parent_asset_type_name,
            b.text as branch_name,
            v.text as vendor_name,
            ps.text as prod_serv_name
        FROM "tblAssets" a
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblAssetTypes" pat ON at.parent_asset_type_id = pat.asset_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
        LEFT JOIN "tblProdServs" ps ON a.prod_serv_id = ps.prod_serv_id
        WHERE a.asset_id = $1
    `;

  return await db.query(query, [asset_id]);
};

// const getPotentialParentAssets = async (asset_type_id) => {



const insertAsset = async (assetData) => {
  const {
    asset_type_id,
    asset_id,
    text,
    serial_number,
    description,
    branch_id,
    purchase_vendor_id,
    service_vendor_id,
    prod_serv_id,
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

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert asset
    const query = `
      INSERT INTO "tblAssets" (
        asset_id,
        asset_type_id,
        text,
        serial_number,
        description,
        branch_id,
        purchase_vendor_id,
        service_vendor_id,
        prod_serv_id,
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
        changed_by,
        created_on,
        changed_on
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const values = [
      asset_id,
      asset_type_id,
      text,
      serial_number,
      description,
      branch_id,
      purchase_vendor_id,
      service_vendor_id,
      prod_serv_id,
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

    const result = await client.query(query, values);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};



const updateAsset = async (asset_id, {
  asset_type_id,
  serial_number,
  description,
  branch_id,
  purchase_vendor_id,
  service_vendor_id,
  prod_serv_id,
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
  properties
}) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Update main asset data
    const query = `
      UPDATE "tblAssets"
      SET
        asset_type_id = COALESCE($1, asset_type_id),
        serial_number = COALESCE($2, serial_number),
        description = COALESCE($3, description),
        branch_id = COALESCE($4, branch_id),
        purchase_vendor_id = $5,
        service_vendor_id = $6,
        prod_serv_id = $7,
        maintsch_id = $8,
        purchased_cost = COALESCE($9, purchased_cost),
        purchased_on = COALESCE($10, purchased_on),
        purchased_by = $11,
        expiry_date = $12,
        current_status = COALESCE($13, current_status),
        warranty_period = $14,
        parent_asset_id = $15,
        group_id = $16,
        org_id = COALESCE($17, org_id),
        changed_on = CURRENT_TIMESTAMP
      WHERE asset_id = $18
      RETURNING *
    `;

    const values = [
      asset_type_id,
      serial_number,
      description,
      branch_id,
      purchase_vendor_id,
      service_vendor_id,
      prod_serv_id,
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
      asset_id
    ];

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Asset not found');
    }

    // Update properties if provided
    if (properties && Object.keys(properties).length > 0) {
      // First, delete existing properties
      await client.query('DELETE FROM "tblAssetProperties" WHERE asset_id = $1', [asset_id]);

      // Then insert new properties
      for (const [assetTypePropId, value] of Object.entries(properties)) {
        await client.query(
          'INSERT INTO "tblAssetProperties" (asset_id, asset_type_prop_id, value) VALUES ($1, $2, $3)',
          [asset_id, assetTypePropId, value]
        );
      }
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


const checkAssetExists = async (org_id) => {
  const query = `
        SELECT asset_id FROM "tblAssets"
        WHERE org_id = $1
    `;

  return await db.query(query, [org_id]);
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
            apv_id, asset_id, org_id, asset_type_prop_id, value
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;

  const values = [apvId, asset_id, org_id, asset_type_prop_id, value];
  return await db.query(query, values);
};

const generateAssetId = async () => {
  // Use the proper ID generator for asset IDs
  return await generateCustomId("asset", 3);
}
const deleteAsset = async (asset_id) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Delete asset property values first
    await client.query('DELETE FROM "tblAssetPropValues" WHERE asset_id = $1', [asset_id]);

    // Then delete the asset
    const query = `
      DELETE FROM "tblAssets"
      WHERE asset_id = $1
      RETURNING *
    `;
    const result = await client.query(query, [asset_id]);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteMultipleAssets = async (asset_ids) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Delete asset property values first
    await client.query('DELETE FROM "tblAssetPropValues" WHERE asset_id = ANY($1::text[])', [asset_ids]);

    // Then delete the assets
    const query = `
      DELETE FROM "tblAssets"
      WHERE asset_id = ANY($1::text[])
      RETURNING *
    `;
    const result = await client.query(query, [asset_ids]);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getPotentialParentAssets = async (asset_type_id) => {
  const query = `
    SELECT 
      asset_id, text, serial_number, description, current_status
    FROM "tblAssets"
    WHERE asset_type_id = $1
    AND current_status = 'Active'
    AND parent_asset_id IS NULL
    ORDER BY text
  `;

  return await db.query(query, [asset_type_id]);
};

// Get assets expiring within 30 days
const getAssetsExpiringWithin30Days = async () => {
  const query = `
    SELECT 
      asset_id, asset_type_id, text, serial_number, description,
      branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
      purchased_on, purchased_by, expiry_date, current_status, warranty_period,
      parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on,
      CASE 
        WHEN expiry_date IS NOT NULL THEN 
          expiry_date - CURRENT_DATE
        ELSE NULL
      END as days_until_expiry
    FROM "tblAssets"
    WHERE expiry_date IS NOT NULL
    AND expiry_date >= CURRENT_DATE
    AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    ORDER BY expiry_date ASC
  `;

  return await db.query(query);
};

// Get assets expiring within 30 days grouped by asset type
const getAssetsExpiringWithin30DaysByType = async () => {
  const query = `
    SELECT 
      at.text as asset_type_name,
      at.asset_type_id,
      COUNT(a.asset_id) as asset_count,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'asset_id', a.asset_id,
          'text', a.text,
          'serial_number', a.serial_number,
          'description', a.description,
          'expiry_date', a.expiry_date,
          'current_status', a.current_status,
          'days_until_expiry', CASE 
            WHEN a.expiry_date IS NOT NULL THEN 
              a.expiry_date - CURRENT_DATE
            ELSE NULL
          END
        ) ORDER BY a.expiry_date ASC
      ) as assets
    FROM "tblAssetTypes" at
    LEFT JOIN "tblAssets" a ON at.asset_type_id = a.asset_type_id
      AND a.expiry_date IS NOT NULL
      AND a.expiry_date >= CURRENT_DATE
      AND a.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    WHERE at.asset_type_id IS NOT NULL
    GROUP BY at.asset_type_id, at.text
    HAVING COUNT(a.asset_id) > 0
    ORDER BY at.text ASC
  `;

  return await db.query(query);
};

// Get assets by expiry date with different filter types
const getAssetsByExpiryDate = async (filterType, value = null) => {
  let query = '';
  let params = [];

  switch (filterType) {
    case 'expired':
      query = `
        SELECT 
          asset_id, asset_type_id, text, serial_number, description,
          branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
          purchased_on, purchased_by, expiry_date, current_status, warranty_period,
          parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on,
          CASE 
            WHEN expiry_date IS NOT NULL THEN 
              CURRENT_DATE - expiry_date
            ELSE NULL
          END as days_expired
        FROM "tblAssets"
        WHERE expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
        ORDER BY expiry_date DESC
      `;
      break;

    case 'expiring_soon':
      const days = parseInt(value) || 30;
      query = `
        SELECT 
          asset_id, asset_type_id, text, serial_number, description,
          branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
          purchased_on, purchased_by, expiry_date, current_status, warranty_period,
          parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on,
          CASE 
            WHEN expiry_date IS NOT NULL THEN 
              expiry_date - CURRENT_DATE
            ELSE NULL
          END as days_until_expiry
        FROM "tblAssets"
        WHERE expiry_date IS NOT NULL
        AND expiry_date >= CURRENT_DATE
        AND expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
        ORDER BY expiry_date ASC
      `;
      break;

    case 'expiring_on':
      query = `
        SELECT 
          asset_id, asset_type_id, text, serial_number, description,
          branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
          purchased_on, purchased_by, expiry_date, current_status, warranty_period,
          parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE expiry_date = $1
        ORDER BY text
      `;
      params = [value];
      break;

    case 'expiring_between':
      const [startDate, endDate] = value.split(',');
      query = `
        SELECT 
          asset_id, asset_type_id, text, serial_number, description,
          branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
          purchased_on, purchased_by, expiry_date, current_status, warranty_period,
          parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on,
          CASE 
            WHEN expiry_date IS NOT NULL THEN 
              expiry_date - CURRENT_DATE
            ELSE NULL
          END as days_until_expiry
        FROM "tblAssets"
        WHERE expiry_date IS NOT NULL
        AND expiry_date >= $1
        AND expiry_date <= $2
        ORDER BY expiry_date ASC
      `;
      params = [startDate, endDate];
      break;

    case 'no_expiry':
      query = `
        SELECT 
          asset_id, asset_type_id, text, serial_number, description,
          branch_id, purchase_vendor_id, service_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
          purchased_on, purchased_by, expiry_date, current_status, warranty_period,
          parent_asset_id, group_id, org_id, created_by, created_on, changed_by, changed_on
        FROM "tblAssets"
        WHERE expiry_date IS NULL
        ORDER BY text
      `;
      break;

    default:
      throw new Error('Invalid filter type');
  }

  return await db.query(query, params);
};

// WEB MODEL
const createAsset = async (assetData) => {
  const {
    asset_type_id,
    ext_id,
    asset_id, // This might be empty, we'll generate it inside transaction
    text,
    serial_number,
    description,
    branch_id,
    purchase_vendor_id,
    service_vendor_id,
    prod_serv_id,
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

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Generate asset ID inside the transaction
    let finalAssetId = asset_id;
    if (!asset_id) {
      console.log('🔢 Generating asset ID inside transaction...');
      finalAssetId = await generateCustomId("asset", 3);
      console.log('🔢 Generated asset ID:', finalAssetId);
    }

    // Insert asset
    const query = `
      INSERT INTO "tblAssets" (
        asset_id,
        asset_type_id,
        text,
        serial_number,
        description,
        branch_id,
        purchase_vendor_id,
        service_vendor_id,
        prod_serv_id,
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
        changed_by,
        created_on,
        changed_on
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const values = [
      finalAssetId,
      asset_type_id,
      text,
      serial_number,
      description,
      branch_id,
      purchase_vendor_id,
      service_vendor_id,
      prod_serv_id,
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

    const result = await client.query(query, values);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Get total count of assets
const getAssetsCount = async () => {
  const query = `
    SELECT COUNT(*) as count
    FROM "tblAssets"
  `;
  
  return await db.query(query);
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
  createAsset,
  updateAsset,
  checkAssetExists,
  checkAssetIdExists,
  checkVendorExists,
  checkProdServExists,
  getAssetTypeAssignmentType,
  insertAssetPropValue,
  generateAssetId,
  deleteAsset,
  deleteMultipleAssets,
  getPotentialParentAssets,
  getAssetsExpiringWithin30Days,
  getAssetsExpiringWithin30DaysByType,
  getAssetsByExpiryDate,
  
  getAssetsCount
};
