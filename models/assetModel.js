const db = require("../config/db");
const { generateCustomId } = require('../utils/idGenerator');
const { convertAssetTypeToSerialFormat, generateSerialNumber } = require('../utils/serialNumberGenerator');

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

const getAssetProperties = async (asset_id) => {
  const query = `
    SELECT 
      apv.apv_id,
      apv.asset_id,
      apv.asset_type_prop_id,
      apv.value,
      p.property,
      p.prop_id
    FROM "tblAssetPropValues" apv
    LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
    WHERE apv.asset_id = $1
    ORDER BY p.property
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
        AND current_status != 'SCRAPPED'
        ORDER BY created_on DESC
    `;

  return await db.query(query, [asset_type_id]);
};

const getPrinterAssets = async () => {
  const query = `
        SELECT 
            a.asset_type_id, a.asset_id, a.text, a.serial_number, a.description,
            a.branch_id, a.purchase_vendor_id, a.service_vendor_id, a.prod_serv_id, a.maintsch_id, a.purchased_cost,
            a.purchased_on, a.purchased_by, a.expiry_date, a.current_status, a.warranty_period,
            a.parent_asset_id, a.group_id, a.org_id, a.created_by, a.created_on, a.changed_by, a.changed_on
        FROM "tblAssets" a
        WHERE a.asset_type_id = (
            SELECT asset_type_id 
            FROM "tblAssetTypes" 
            WHERE text = (
                SELECT value 
                FROM "tblOrgSettings" 
                WHERE key = 'printer_asset_type'
            )
        )
        AND a.current_status != 'SCRAPPED'
        ORDER BY a.created_on DESC
    `;

  return await db.query(query);
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
            v.vendor_name,
            ps.description as prod_serv_name
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
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
      await client.query('DELETE FROM "tblAssetPropValues" WHERE asset_id = $1', [asset_id]);

      // Then insert new properties
      // Need to convert property names to asset_type_prop_id
      for (const [propertyName, value] of Object.entries(properties)) {
        // Get prop_id from property name
        const propQuery = `
          SELECT p.prop_id 
          FROM "tblAssetTypeProps" atp
          JOIN "tblProps" p ON atp.prop_id = p.prop_id
          WHERE p.property = $1 AND atp.asset_type_id = $2
        `;
        const propResult = await client.query(propQuery, [propertyName, asset_type_id]);
        
        if (propResult.rows.length > 0) {
          const propId = propResult.rows[0].prop_id;
          // Generate a unique apv_id
          const timestamp = Date.now().toString().slice(-6);
          const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const apvId = `APV${timestamp}${random}`;
          
          await client.query(
            'INSERT INTO "tblAssetPropValues" (apv_id, asset_id, org_id, asset_type_prop_id, value) VALUES ($1, $2, $3, $4, $5)',
            [apvId, asset_id, org_id, propId, value]
          );
        }
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
  // First, get the parent asset type for this child asset type
  const parentTypeQuery = `
    SELECT parent_asset_type_id 
    FROM "tblAssetTypes" 
    WHERE asset_type_id = $1 AND is_child = true
  `;
  
  const parentTypeResult = await db.query(parentTypeQuery, [asset_type_id]);
  
  if (parentTypeResult.rows.length === 0 || !parentTypeResult.rows[0].parent_asset_type_id) {
    // Not a child asset type or no parent defined
    return { rows: [] };
  }
  
  const parentAssetTypeId = parentTypeResult.rows[0].parent_asset_type_id;
  
  // Now get assets of the parent asset type
  const query = `
    SELECT 
      a.asset_id, 
      a.text as asset_name, 
      a.serial_number, 
      a.description, 
      a.current_status,
      at.text as asset_type_name
    FROM "tblAssets" a
    JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE a.asset_type_id = $1
    AND a.current_status = 'Active'
    AND a.parent_asset_id IS NULL
    ORDER BY a.text
  `;

  return await db.query(query, [parentAssetTypeId]);
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
      AND a.current_status != 'SCRAPPED'
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
        AND current_status != 'SCRAPPED'
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
        AND current_status != 'SCRAPPED'
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
        AND current_status != 'SCRAPPED'
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
        AND current_status != 'SCRAPPED'
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
        AND current_status != 'SCRAPPED'
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
    // Depreciation fields
    salvage_value,
    useful_life_years,
    depreciation_rate,
    current_book_value,
    accumulated_depreciation,
    last_depreciation_calc_date,
    depreciation_start_date
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

    // Use the serial number as provided and increment the sequence in database
    let finalSerialNumber = serial_number;
    
    console.log(`🔢 Using provided serial number: ${finalSerialNumber}`);
    
    // Validate that serial number is provided
    if (!finalSerialNumber || finalSerialNumber === '') {
      throw new Error('Serial number is required. Please generate a serial number first.');
    }
    
    // Extract the last 5 digits from the serial number to update last_gen_seq_no
    if (finalSerialNumber && finalSerialNumber.length >= 5) {
      const last5Digits = finalSerialNumber.slice(-5);
      const sequenceNumber = parseInt(last5Digits);
      
      if (!isNaN(sequenceNumber)) {
        // Update the last_gen_seq_no in tblAssetTypes to this sequence number
        await client.query(
          'UPDATE "tblAssetTypes" SET last_gen_seq_no = $1 WHERE asset_type_id = $2',
          [sequenceNumber, asset_type_id]
        );
        console.log(`🔢 Updated last_gen_seq_no to ${sequenceNumber} for asset type ${asset_type_id}`);
      }
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
        salvage_value,
        useful_life_years,
        depreciation_rate,
        current_book_value,
        accumulated_depreciation,
        last_depreciation_calc_date,
        depreciation_start_date,
        created_on,
        changed_on
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    const values = [
      finalAssetId,
      asset_type_id,
      text,
      finalSerialNumber,
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
      created_by, // changed_by
      salvage_value,
      useful_life_years,
      depreciation_rate,
      current_book_value,
      accumulated_depreciation,
      last_depreciation_calc_date,
      depreciation_start_date
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
  getAssetProperties,
  getAssetsByAssetType,
  getPrinterAssets,
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

// Check existing asset IDs for bulk upload validation
const checkExistingAssetIds = async (assetIds) => {
  const query = `
    SELECT asset_id 
    FROM "tblAssets" 
    WHERE asset_id = ANY($1)
  `;
  
  return await db.query(query, [assetIds]);
};

// Get reference data for bulk upload validation
const getBulkUploadReferenceData = async () => {
  try {
    // Fetch all reference data in parallel
    const [organizations, assetTypes, branches, vendors, prodServs] = await Promise.all([
      db.query('SELECT org_id, text as org_name FROM "tblOrgs" WHERE int_status = 1'),
      db.query('SELECT asset_type_id, text as asset_type_name FROM "tblAssetTypes" WHERE int_status = 1'),
      db.query('SELECT branch_id, text as branch_name FROM "tblBranches" WHERE int_status = 1'),
      db.query('SELECT vendor_id, text as vendor_name FROM "tblVendors" WHERE int_status = 1'),
      db.query('SELECT prod_serv_id, text as prod_serv_name FROM "tblProdServs" WHERE int_status = 1')
    ]);

    return {
      organizations: organizations.rows,
      assetTypes: assetTypes.rows,
      branches: branches.rows,
      vendors: vendors.rows,
      prodServs: prodServs.rows
    };
  } catch (error) {
    console.error('Error fetching reference data:', error);
    throw error;
  }
};

// Helper function to validate property values against allowed values
const validatePropertyValue = async (client, assetTypePropId, value, orgId, createdBy = 'system') => {
  if (!value || value.trim() === '') {
    return { isValid: true, error: null };
  }
  
  const trimmedValue = value.trim();
  
  // First, get the actual prop_id from asset_type_prop_id
  const propIdQuery = `
    SELECT prop_id FROM "tblAssetTypeProps" 
    WHERE asset_type_prop_id = $1 AND org_id = $2
  `;
  
  const propIdResult = await client.query(propIdQuery, [assetTypePropId, orgId]);
  
  if (propIdResult.rows.length === 0) {
    return { 
      isValid: false, 
      error: `Asset type property ID '${assetTypePropId}' not found for organization '${orgId}'` 
    };
  }
  
  const actualPropId = propIdResult.rows[0].prop_id;
  
  // Get all existing property values for this property
  const query = `
    SELECT aplv_id, value FROM "tblAssetPropListValues" 
    WHERE prop_id = $1 AND org_id = $2 AND int_status = 1
    ORDER BY value
  `;
  
  const result = await client.query(query, [actualPropId, orgId]);
  const existingValues = result.rows;
  
  // 1. Check for exact case-sensitive match first
  const exactMatch = existingValues.find(row => row.value === trimmedValue);
  if (exactMatch) {
    return { isValid: true, error: null };
  }
  
  // 2. Check for case-insensitive match
  const caseInsensitiveMatch = existingValues.find(row => 
    row.value.toLowerCase() === trimmedValue.toLowerCase()
  );
  
  if (caseInsensitiveMatch) {
    // Use the correct case value
    return { isValid: true, error: null, correctedValue: caseInsensitiveMatch.value };
  }
  
  // 3. No match found - create new property value (this is commit mode)
  try {
    const { generateCustomId } = require('../utils/idGenerator');
    
    // Generate unique APLV ID
    const aplvId = await generateCustomId('aplv', 3);
    
    const insertQuery = `
      INSERT INTO "tblAssetPropListValues" (
        aplv_id,
        prop_id,
        value,
        int_status,
        org_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING aplv_id
    `;
    
    await client.query(insertQuery, [aplvId, actualPropId, trimmedValue, 1, orgId]);
    
    console.log(`✅ Auto-created new property value: '${trimmedValue}' for property '${actualPropId}' with ID ${aplvId}`);
    
    return { isValid: true, error: null };
    
  } catch (error) {
    console.error('Error creating new property value:', error);
    return { 
      isValid: false, 
      error: `Failed to create new property value '${trimmedValue}' for property '${assetTypePropId}': ${error.message}` 
    };
  }
};

// Helper function to validate property values without requiring a client (for trial upload)
const validatePropertyValueStandalone = async (assetTypePropId, value, orgId, createdBy = 'system', isTrial = true) => {
  if (!value || value.trim() === '') {
    return { isValid: true, error: null };
  }
  
  const trimmedValue = value.trim();
  
  // First, get the actual prop_id from asset_type_prop_id
  const propIdQuery = `
    SELECT prop_id FROM "tblAssetTypeProps" 
    WHERE asset_type_prop_id = $1 AND org_id = $2
  `;
  
  const propIdResult = await db.query(propIdQuery, [assetTypePropId, orgId]);
  
  if (propIdResult.rows.length === 0) {
    return { 
      isValid: false, 
      error: `Asset type property ID '${assetTypePropId}' not found for organization '${orgId}'` 
    };
  }
  
  const actualPropId = propIdResult.rows[0].prop_id;
  
  // Get all existing property values for this property
  const query = `
    SELECT aplv_id, value FROM "tblAssetPropListValues" 
    WHERE prop_id = $1 AND org_id = $2 AND int_status = 1
    ORDER BY value
  `;
  
  const result = await db.query(query, [actualPropId, orgId]);
  const existingValues = result.rows;
  
  // 1. Check for exact case-sensitive match first
  const exactMatch = existingValues.find(row => row.value === trimmedValue);
  if (exactMatch) {
    return { isValid: true, error: null };
  }
  
  // 2. Check for case-insensitive match
  const caseInsensitiveMatch = existingValues.find(row => 
    row.value.toLowerCase() === trimmedValue.toLowerCase()
  );
  
  if (caseInsensitiveMatch) {
    // Show warning but accept it - user typed wrong case
    return { 
      isValid: true, 
      warning: `Case mismatch: '${trimmedValue}' should be '${caseInsensitiveMatch.value}' for property '${assetTypePropId}'`,
      correctedValue: caseInsensitiveMatch.value
    };
  }
  
  // 3. No match found
  if (isTrial) {
    // In trial mode, just indicate that a new value would be created
    return { 
      isValid: true, 
      info: `Will create new property value: '${trimmedValue}' for property '${assetTypePropId}'`,
      newValue: trimmedValue
    };
  } else {
    // In commit mode, actually create the new property value
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      
      // Generate unique APLV ID
      const aplvId = await generateCustomId('aplv', 3);
      
      const insertQuery = `
        INSERT INTO "tblAssetPropListValues" (
          aplv_id,
          prop_id,
          value,
          int_status,
          org_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING aplv_id
      `;
      
      await db.query(insertQuery, [aplvId, actualPropId, trimmedValue, 1, orgId]);
      
      console.log(`✅ Auto-created new property value: '${trimmedValue}' for property '${actualPropId}' with ID ${aplvId}`);
      
      return { 
        isValid: true, 
        info: `Auto-created new property value: '${trimmedValue}' for property '${assetTypePropId}'`,
        newValue: trimmedValue
      };
      
    } catch (error) {
      console.error('Error creating new property value:', error);
      return { 
        isValid: false, 
        error: `Failed to create new property value '${trimmedValue}' for property '${assetTypePropId}': ${error.message}` 
      };
    }
  }
};

// Helper function to validate and format dates
const validateAndFormatDate = (dateString) => {
  if (!dateString || dateString.trim() === '' || dateString.toLowerCase() === 'null') {
    return null;
  }
  
  // Check if it's already in YYYY-MM-DD format
  const yyyyMMddRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (yyyyMMddRegex.test(dateString)) {
    // Validate the date
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
    }
    return dateString;
  }
  
  // Check if it's in DD-MM-YYYY format
  const ddMMyyyyRegex = /^\d{2}-\d{2}-\d{4}$/;
  if (ddMMyyyyRegex.test(dateString)) {
    const parts = dateString.split('-');
    const day = parts[0];
    const month = parts[1];
    const year = parts[2];
    
    // Create date in YYYY-MM-DD format
    const formattedDate = `${year}-${month}-${day}`;
    const date = new Date(formattedDate);
    
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateString}. Expected DD-MM-YYYY or YYYY-MM-DD`);
    }
    
    return formattedDate;
  }
  
  // Try to parse other common formats and convert to YYYY-MM-DD
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}. Expected DD-MM-YYYY or YYYY-MM-DD`);
  }
  
  // Convert to YYYY-MM-DD format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Bulk upsert assets (insert or update)
const bulkUpsertAssets = async (csvData, created_by, user_org_id, user_branch_id) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];
    
    // Fetch asset types to get text values
    const assetTypesResult = await client.query('SELECT asset_type_id, text FROM "tblAssetTypes" WHERE int_status = 1');
    const assetTypesMap = {};
    assetTypesResult.rows.forEach(at => {
      assetTypesMap[at.asset_type_id] = at.text;
    });
    
    for (const row of csvData) {
      // Declare variables outside try-catch for error handling
      let finalAssetId = row.asset_id;
      let finalSerialNumber = row.serial_number;
      let finalOrgId = row.org_id || user_org_id; // Use user's org_id if not provided in CSV
      let finalBranchId = row.branch_id || user_branch_id; // Use user's branch_id if not provided in CSV
      
      // Get asset type text for the 'text' field
      const assetTypeText = assetTypesMap[row.asset_type_id] || '';
      
      // Validate that we have a valid org_id
      if (!finalOrgId) {
        throw new Error('Organization ID is required. Please provide org_id in CSV or ensure user has a valid organization.');
      }
      
      // Validate that we have a valid branch_id
      if (!finalBranchId) {
        throw new Error('Branch ID is required. Please provide branch_id in CSV or ensure user has a valid branch.');
      }
      
      try {
        // Generate asset_id if not provided (same as Add Assets screen)
        if (!finalAssetId) {
          finalAssetId = await generateCustomId("asset", 3);
          console.log(`🔢 Generated asset ID for bulk upload: ${finalAssetId}`);
        }
        
        // Generate serial_number if not provided (transaction-safe, row-by-row)
        if (!finalSerialNumber) {
          // Atomically increment sequence within this transaction and get the new value
          const seqResult = await client.query(
            'UPDATE "tblAssetTypes" SET last_gen_seq_no = COALESCE(last_gen_seq_no, 0) + 1 WHERE asset_type_id = $1 RETURNING last_gen_seq_no',
            [row.asset_type_id]
          );
          const nextSequence = parseInt(seqResult.rows[0].last_gen_seq_no);
          const now = new Date();
          const year = now.getFullYear().toString().slice(-2);
          const reversedYear = year.split('').reverse().join('');
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const formattedAssetTypeId = convertAssetTypeToSerialFormat(row.asset_type_id);
          finalSerialNumber = `${formattedAssetTypeId}${reversedYear}${month}${String(nextSequence).padStart(5, '0')}`;
          console.log(`🔢 Generated serial number for bulk upload (tx-safe): ${finalSerialNumber}`);
        }
        
        // Validate and format date fields
        const purchasedOn = validateAndFormatDate(row.purchased_on);
        const expiryDate = validateAndFormatDate(row.expiry_date);
        const lastDepreciationCalcDate = validateAndFormatDate(row.last_depreciation_calc_date);
        const commissionedDate = validateAndFormatDate(row.commissioned_date);
        // Set depreciation start date to purchase date (like Add Assets screen)
        const depreciationStartDate = purchasedOn;
        
        // Calculate current book value (same as purchase cost initially, like Add Assets screen)
        const currentBookValue = parseFloat(row.purchased_cost) || 0;
        const accumulatedDepreciation = 0; // Always start with 0
        const depreciationRate = 0; // Will be calculated by depreciation service
        
        // Check if asset exists
        const existingAsset = await client.query(
          'SELECT asset_id FROM "tblAssets" WHERE asset_id = $1',
          [finalAssetId]
        );
        
        if (existingAsset.rows.length > 0) {
          // Update existing asset
          await client.query(`
            UPDATE "tblAssets" SET
              asset_type_id = $2,
              text = $3,
              serial_number = $4,
              description = $5,
              branch_id = $6,
              purchase_vendor_id = $7,
              prod_serv_id = $8,
              maintsch_id = $9,
              purchased_cost = $10,
              purchased_on = $11,
              purchased_by = $12,
              current_status = $13,
              warranty_period = $14,
              parent_asset_id = $15,
              group_id = $16,
              org_id = $17,
              service_vendor_id = $18,
              expiry_date = $19,
              current_book_value = $20,
              salvage_value = $21,
              accumulated_depreciation = $22,
              useful_life_years = $23,
              last_depreciation_calc_date = $24,
              invoice_no = $25,
              commissioned_date = $26,
              depreciation_start_date = $27,
              project_code = $28,
              grant_code = $29,
              insurance_policy_no = $30,
              gl_account_code = $31,
              cost_center_code = $32,
              depreciation_rate = $33,
              changed_by = $34,
              changed_on = CURRENT_TIMESTAMP
            WHERE asset_id = $1
          `, [
            finalAssetId,
            row.asset_type_id,
            assetTypeText,
            finalSerialNumber,
            row.description,
            finalBranchId,
            row.purchase_vendor_id,
            row.service_vendor_id, // Set prod_serv_id same as service_vendor_id (like Add Assets screen)
            row.maintsch_id,
            row.purchased_cost ? parseFloat(row.purchased_cost) : null,
            purchasedOn,
            row.purchased_by,
            row.current_status || 'Active',
            row.warranty_period,
            row.parent_asset_id,
            row.group_id,
            finalOrgId,
            row.service_vendor_id,
            expiryDate,
            currentBookValue, // Use calculated current book value
            row.salvage_value ? parseFloat(row.salvage_value) : 0,
            accumulatedDepreciation, // Always 0 initially
            row.useful_life_years ? parseInt(row.useful_life_years) : 0,
            lastDepreciationCalcDate,
            row.invoice_no,
            commissionedDate,
            depreciationStartDate,
            row.project_code,
            row.grant_code,
            row.insurance_policy_no,
            row.gl_account_code,
            row.cost_center_code,
            depreciationRate, // Always 0 initially
            created_by
          ]);
          updated++;
        } else {
          // Insert new asset
          await client.query(`
            INSERT INTO "tblAssets" (
              asset_id, asset_type_id, text, serial_number, description,
              branch_id, purchase_vendor_id, prod_serv_id, maintsch_id, purchased_cost,
              purchased_on, purchased_by, current_status, warranty_period,
              parent_asset_id, group_id, org_id, service_vendor_id, expiry_date,
              current_book_value, salvage_value, accumulated_depreciation, useful_life_years,
              last_depreciation_calc_date, invoice_no, commissioned_date, depreciation_start_date,
              project_code, grant_code, insurance_policy_no, gl_account_code, cost_center_code,
              depreciation_rate, created_by, created_on, changed_by, changed_on
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, CURRENT_TIMESTAMP, $34, CURRENT_TIMESTAMP
            )
          `, [
            finalAssetId,
            row.asset_type_id,
            assetTypeText,
            finalSerialNumber,
            row.description,
            finalBranchId,
            row.purchase_vendor_id,
            row.service_vendor_id, // Set prod_serv_id same as service_vendor_id (like Add Assets screen)
            row.maintsch_id,
            row.purchased_cost ? parseFloat(row.purchased_cost) : null,
            purchasedOn,
            row.purchased_by,
            row.current_status || 'Active',
            row.warranty_period,
            row.parent_asset_id,
            row.group_id,
            finalOrgId,
            row.service_vendor_id,
            expiryDate,
            currentBookValue, // Use calculated current book value
            row.salvage_value ? parseFloat(row.salvage_value) : 0,
            accumulatedDepreciation, // Always 0 initially
            row.useful_life_years ? parseInt(row.useful_life_years) : 0,
            lastDepreciationCalcDate,
            row.invoice_no,
            commissionedDate,
            depreciationStartDate,
            row.project_code,
            row.grant_code,
            row.insurance_policy_no,
            row.gl_account_code,
            row.cost_center_code,
            depreciationRate, // Always 0 initially
            created_by
          ]);
          inserted++;
        }
        
        // Handle property values (like Add Assets screen)
        if (row.properties && Object.keys(row.properties).length > 0) {
          console.log('Saving property values for asset:', finalAssetId, row.properties);
          
          // Validate all property values first
          const propertyValidationErrors = [];
          for (const [propId, value] of Object.entries(row.properties)) {
            if (value && value.trim() !== '') {
              const validation = await validatePropertyValue(client, propId, value, finalOrgId, created_by);
              if (!validation.isValid) {
                propertyValidationErrors.push(validation.error);
              }
            }
          }
          
          // If there are validation errors, throw an error
          if (propertyValidationErrors.length > 0) {
            throw new Error(`Property validation failed: ${propertyValidationErrors.join('; ')}`);
          }
          
          // First, delete existing property values for this asset
          await client.query('DELETE FROM "tblAssetPropValues" WHERE asset_id = $1', [finalAssetId]);
          
          // Then insert new property values
          for (const [assetTypePropId, value] of Object.entries(row.properties)) {
            if (value && value.trim() !== '') {
              // Get the prop_id from asset_type_prop_id
              const propIdQuery = `
                SELECT prop_id FROM "tblAssetTypeProps" 
                WHERE asset_type_prop_id = $1 AND org_id = $2
              `;
              
              const propIdResult = await client.query(propIdQuery, [assetTypePropId, finalOrgId]);
              
              if (propIdResult.rows.length > 0) {
                const actualPropId = propIdResult.rows[0].prop_id;
                
                // Generate a unique apv_id
                const timestamp = Date.now().toString().slice(-6);
                const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                const apvId = `APV${timestamp}${random}`;
                
                await client.query(
                  'INSERT INTO "tblAssetPropValues" (apv_id, asset_id, org_id, asset_type_prop_id, value) VALUES ($1, $2, $3, $4, $5)',
                  [apvId, finalAssetId, finalOrgId, actualPropId, value]
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing asset ${finalAssetId}:`, error);
        errors++;
        errorDetails.push({
          asset_id: finalAssetId,
          error: error.message
        });
      }
    }
    
    await client.query('COMMIT');
    
    return {
      totalProcessed: csvData.length,
      inserted,
      updated,
      errors,
      errorDetails
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk upsert assets:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Export bulk upload functions
module.exports = {
  ...module.exports,
  checkExistingAssetIds,
  getBulkUploadReferenceData,
  bulkUpsertAssets,
  validatePropertyValueStandalone
};
