const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const truthyFlag = (value) =>
  value === true ||
  value === 1 ||
  value === '1' ||
  value === 't' ||
  String(value).toLowerCase() === 'true';

const ensureVendorSupplyColumns = async (dbPool) => {
  await dbPool.query(`
    ALTER TABLE "tblVendors"
      ADD COLUMN IF NOT EXISTS product_supply boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS service_supply boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS spare_supply boolean DEFAULT false
  `);
};

const attachVendorSupplyFlags = async (vendors) => {
  const list = Array.isArray(vendors) ? vendors : vendors ? [vendors] : [];
  if (!list.length) return vendors;

  const ids = list.map((row) => row.vendor_id).filter(Boolean);
  const dbPool = getDb();
  const spareSet = new Set();
  const productSet = new Set();
  const serviceSet = new Set();

  if (ids.length) {
    try {
      const spare = await dbPool.query(
        `
          SELECT DISTINCT vendor_id
          FROM "tblVSPMap"
          WHERE vendor_id = ANY($1::text[])
            AND COALESCE(int_status, 1) = 1
        `,
        [ids]
      );
      spare.rows.forEach((row) => spareSet.add(row.vendor_id));
    } catch (_) {
      /* tblVSPMap may be missing in some tenants */
    }
    try {
      const prod = await dbPool.query(
        `
          SELECT DISTINCT
            vps.vendor_id,
            LOWER(BTRIM(ps.ps_type)) AS ps_type
          FROM "tblVendorProdService" vps
          INNER JOIN "tblProdServs" ps
            ON ps.prod_serv_id = vps.prod_serv_id
          WHERE vps.vendor_id = ANY($1::text[])
        `,
        [ids]
      );
      prod.rows.forEach((row) => {
        if (row.ps_type === 'product') productSet.add(row.vendor_id);
        if (row.ps_type === 'service') serviceSet.add(row.vendor_id);
      });
    } catch (_) {
      /* product/service mapping tables may be missing */
    }
  }

  const mapped = list.map((row) => ({
    ...row,
    product_supply: truthyFlag(row.product_supply) || productSet.has(row.vendor_id),
    service_supply: truthyFlag(row.service_supply) || serviceSet.has(row.vendor_id),
    spare_supply: truthyFlag(row.spare_supply) || spareSet.has(row.vendor_id),
  }));

  return Array.isArray(vendors) ? mapped : mapped[0];
};

// Get all vendors for an organization (org-level master data — visible in every branch)
const getAllVendors = async (org_id, userBranchCode, hasSuperAccess = false, serviceOnly = false) => {
  console.log('=== Vendor Model Listing Debug ===');
  console.log('org_id:', org_id);
  console.log('serviceOnly:', serviceOnly);
  // userBranchCode / hasSuperAccess retained for call-site compatibility; vendors are not branch-scoped
  
  let query = `
    SELECT * FROM "tblVendors" 
    WHERE org_id = $1
  `;
  const params = [org_id];

  // Filter to service vendors if requested. The vendors table contains a boolean
  // column `service_supply` which indicates whether the vendor provides services.
  if (serviceOnly) {
    query += ` AND service_supply = true`;
  }
  
  query += ` ORDER BY created_on DESC`;
  
  const dbPool = getDb();
  await ensureVendorSupplyColumns(dbPool);
  const result = await dbPool.query(query, params);
  console.log('Query executed successfully, found vendors:', result.rows.length);
  return attachVendorSupplyFlags(result.rows);
};

// Get vendor by ID from tenant database context only
const getVendorById = async (vendorId) => {
  const dbPool = getDb();
  try {
    await ensureVendorSupplyColumns(dbPool);
    const result = await dbPool.query('SELECT * FROM "tblVendors" WHERE vendor_id = $1', [vendorId]);
    if (result.rows && result.rows.length > 0) {
      return attachVendorSupplyFlags(result.rows[0]);
    }
  } catch (e) {
    console.warn('Vendor lookup in tenant DB failed:', e.message);
  }

  // Fallback: try default DB pool
  if (db && db !== dbPool) {
    try {
      const fallback = await db.query('SELECT * FROM "tblVendors" WHERE vendor_id = $1', [vendorId]);
      if (fallback.rows && fallback.rows.length > 0) {
        return attachVendorSupplyFlags(fallback.rows[0]);
      }
    } catch (e) {
      console.warn('Vendor lookup in default DB failed:', e.message);
    }
  }

  return null;
};

/**
 * Get vendors by supply type (product-based or service-based) using tblVendorProdService + tblProdServs.ps_type.
 * - product: vendors that have at least one linked prod_serv with ps_type = 'product'
 * - service: vendors that have at least one linked prod_serv with ps_type = 'service'
 * Vendors with both appear in both lists.
 * Scoped by organization only (same as getAllVendors).
 */
const getVendorsBySupplyType = async (org_id, supplyType, userBranchCode, hasSuperAccess = false) => {
  if (!supplyType || !['product', 'service'].includes(String(supplyType).toLowerCase())) {
    return getAllVendors(org_id, userBranchCode, hasSuperAccess, false);
  }
  const psType = String(supplyType).toLowerCase();
  const dbPool = getDb();
  const query = `
    SELECT DISTINCT v.vendor_id, v.vendor_name, v.company_name, v.int_status, v.org_id, v.branch_code, v.created_on
    FROM "tblVendors" v
    INNER JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id AND vps.org_id = v.org_id
    INNER JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND LOWER(TRIM(ps.ps_type)) = $2
    WHERE v.org_id = $1 AND (v.int_status = 1 OR v.int_status IS NULL)
    ORDER BY v.vendor_name ASC
  `;
  const result = await dbPool.query(query, [org_id, psType]);
  return result.rows;
};

const createVendor = async (vendor) => {
  console.log('=== Vendor Model Creation Debug ===');
  console.log('vendor_id:', vendor.vendor_id);
  console.log('org_id:', vendor.org_id);
  console.log('branch_code:', vendor.branch_code);
  
  const dbPool = getDb();
  await ensureVendorSupplyColumns(dbPool);

  const query = `
    INSERT INTO "tblVendors" (
      vendor_id,
      org_id,
      branch_code,
      vendor_name,
      int_status,
      company_name,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      company_email,
      gst_number,
      cin_number,
      contact_person_name,
      contact_person_email,
      contact_person_number,
      contract_start_date,
      contract_end_date,
      product_supply,
      service_supply,
      spare_supply,
      created_by,
      created_on,
      changed_by,
      changed_on
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) RETURNING *;
  `;

  const values = [
    vendor.vendor_id,
    vendor.org_id,
    vendor.branch_code,
    vendor.vendor_name,
    vendor.int_status,
    vendor.company_name,
    vendor.address_line1,
    vendor.address_line2,
    vendor.city,
    vendor.state,
    vendor.pincode,
    vendor.company_email,
    vendor.gst_number,
    vendor.cin_number,
    vendor.contact_person_name,
    vendor.contact_person_email,
    vendor.contact_person_number,
    vendor.contract_start_date || null,
    vendor.contract_end_date || null,
    Boolean(vendor.product_supply),
    Boolean(vendor.service_supply),
    Boolean(vendor.spare_supply),
    vendor.created_by,
    vendor.created_on,
    vendor.changed_by,
    vendor.changed_on
  ];

  const { rows } = await dbPool.query(query, values);
  console.log('Vendor created successfully with branch_code:', vendor.branch_code);
  return attachVendorSupplyFlags(rows[0]);
};

module.exports = {
  createVendor
};


module.exports = {
  getAllVendors,
  getVendorById,
  getVendorsBySupplyType,
  createVendor,
};
