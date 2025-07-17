const vendorsModel = require("../models/vendorsModel");
const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
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
      vendor_name,
      company,
      email,
      contact_number,
      gst_number,
      cin_number,
      product_supply,
      service_supply,
      int_status,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      contact_person_name,
      contact_person_email,
      created_by,
      changed_by,
    } = req.body;

    const org_id = req.user.org_id;
    const changed_on = new Date();
    const created_on = new Date();
    const ext_id = uuidv4(); // Always auto-generate ext_id

    const vendorData = {
      vendor_id,
      org_id,
      ext_id, // auto-generated
      vendor_name,
      int_status,
      company_name: company,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      company_email: email,
      gst_number,
      cin_number,
      contact_person_name,
      contact_person_email,
      contact_person_number: contact_number,
      created_by,
      created_on,
      changed_by,
      changed_on,
    };

    const newVendor = await vendorsModel.createVendor(vendorData);

    res.status(201).json({
      message: "Vendor created successfully",
      data: newVendor,
    });
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({ error: "Failed to create vendor" });
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

// Get vendor-product-service relationships for dropdowns
exports.getVendorProdServices = async (req, res) => {
  try {
    const query = `
      SELECT 
        vps.vendor_id,
        vps.prod_serv_id,
        v.vendor_name,
        ps.brand,
        ps.model,
        ps.description as prod_serv_description
      FROM "tblVendorProdService" vps
      LEFT JOIN "tblVendors" v ON vps.vendor_id = v.vendor_id
      LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id
      WHERE vps.int_status = 1
      ORDER BY v.vendor_name, ps.brand, ps.model
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor-product-services:', error);
    res.status(500).json({ error: "Failed to fetch vendor-product-services" });
  }
};
