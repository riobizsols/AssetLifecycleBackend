const vendorsModel = require("../models/vendorsModel");
const db = require("../config/db");

//To get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await vendorsModel.getAllVendors();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendors" });
  }
};

//add new vendor
exports.createVendor = async (req, res) => {
  try {
    const {
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
    } = req.body;

    const newVendor = await vendorsModel.createVendor(
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
    );

    res.status(201).json({
      message: "Vendor created successfully",
      vendor: newVendor,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to create vendor ${error}` });
  }
};

// Delete vendor by vendor_id
exports.deleteVendor = async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const query = 'DELETE FROM "tblVendors" WHERE vendor_id = $1 RETURNING *;';
    const { rows } = await db.query(query, [vendor_id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }
    res.json({ success: true, message: "Vendor deleted", vendor: rows[0] });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Update vendor by vendor_id
exports.updateVendor = async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const {
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
      changed_by,
      changed_on,
    } = req.body;

    const query = `
        UPDATE "tblVendors" SET
          org_id = $1,
          ext_id = $2,
          vendor_name = $3,
          int_status = $4,
          company_name = $5,
          address_line1 = $6,
          address_line2 = $7,
          city = $8,
          state = $9,
          pincode = $10,
          company_email = $11,
          gst_number = $12,
          cin_number = $13,
          contact_person_name = $14,
          contact_person_email = $15,
          contact_person_number = $16,
          changed_by = $17,
          changed_on = $18
        WHERE vendor_id = $19
        RETURNING *;
      `;

    const values = [
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
      changed_by,
      changed_on,
      vendor_id,
    ];

    const { rows } = await db.query(query, values);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }
    res.json({ success: true, message: "Vendor updated", vendor: rows[0] });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};
