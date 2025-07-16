const db = require("../config/db");

// Get all vendors
const getAllVendors = async () => {
  const result = await db.query('SELECT * FROM "tblVendors"');
  return result.rows;
};

const createVendor = async (
  vendor_id,
  org_id,
  ext_id,
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
  created_by,
  created_on,
  changed_by,
  changed_on
) => {
  const result = await db.query(
    'INSERT INTO "tblVendors" (vendor_id, org_id, ext_id, vendor_name, int_status, company_name, address_line1, address_line2, city, state, pincode, company_email, gst_number, cin_number, contact_person_name, contact_person_email, contact_person_number, created_by, created_on, changed_by, changed_on) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
    [
      vendor_id,
      org_id,
      ext_id,
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
      created_by,
      created_on,
      changed_by,
      changed_on,
    ]
  );
  return result.rows[0];
};

module.exports = {
  getAllVendors,
  createVendor,
};
