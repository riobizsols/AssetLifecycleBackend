const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');
<<<<<<< HEAD
=======

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get all vendors - supports super access users who can view all branches
const getAllVendors = async (org_id, userBranchCode, hasSuperAccess = false) => {
  console.log('=== Vendor Model Listing Debug ===');
  console.log('org_id:', org_id);
  console.log('userBranchCode:', userBranchCode);
  console.log('hasSuperAccess:', hasSuperAccess);
  
  let query = `
    SELECT * FROM "tblVendors" 
    WHERE org_id = $1
  `;
  const params = [org_id];
  
<<<<<<< HEAD
  // Apply branch filter only if user doesn't have super access
  if (!hasSuperAccess && userBranchCode) {
    query += ` AND branch_code = $2`;
    params.push(userBranchCode);
  }
  
  query += ` ORDER BY created_on DESC`;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, params);
=======
  const dbPool = getDb();
  const result = await dbPool.query(query, [org_id, userBranchCode]);
>>>>>>> 205758be7c8605190654e3f4f51c3e2cb0043142
  console.log('Query executed successfully, found vendors:', result.rows.length);
  return result.rows;
};

// Get vendor by ID
const getVendorById = async (vendorId) => {
  const dbPool = getDb();
  const result = await dbPool.query('SELECT * FROM "tblVendors" WHERE vendor_id = $1', [vendorId]);
  return result.rows[0];
};


const createVendor = async (vendor) => {
  console.log('=== Vendor Model Creation Debug ===');
  console.log('vendor_id:', vendor.vendor_id);
  console.log('org_id:', vendor.org_id);
  console.log('branch_code:', vendor.branch_code);
  
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
      created_by,
      created_on,
      changed_by,
      changed_on
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
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
    vendor.created_by,
    vendor.created_on,
    vendor.changed_by,
    vendor.changed_on
  ];

  const dbPool = getDb();
  const { rows } = await dbPool.query(query, values);
  console.log('Vendor created successfully with branch_code:', vendor.branch_code);
  return rows[0];
};

module.exports = {
  createVendor
};


module.exports = {
  getAllVendors,
  getVendorById,
  createVendor,
};
