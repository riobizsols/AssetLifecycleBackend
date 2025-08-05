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

// Get vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = await vendorsModel.getVendorById(vendorId);
    
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }
    
    res.json({
      success: true,
      data: vendor,
      message: "Vendor details retrieved successfully"
    });
  } catch (error) {
    console.error("Get vendor by ID error:", error);
    res.status(500).json({ error: "Failed to fetch vendor details" });
  }
};

//add new vendor

const generateVendorId = async () => {
  const result = await db.query(`SELECT vendor_id FROM "tblVendors" ORDER BY vendor_id DESC LIMIT 1`);
  const lastId = result.rows[0]?.vendor_id;
  let newNumber = 1; // starting number
  if (lastId && /^V\d+$/.test(lastId)) {
    newNumber = parseInt(lastId.replace('V', '')) + 1;
  }
  return `V${String(newNumber).padStart(3, '0')}`;
};

exports.createVendor = async (req, res) => {
  try {
    const {
      // vendor_id, // REMOVE this from destructuring
      vendor_name,
      company_name,
      company_email,
      contact_person_number,
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
    const vendor_id = await generateVendorId(); // Always generate vendor_id

    const vendorData = {
      vendor_id, // use generated
      org_id,
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



// Delete single vendor
exports.deleteVendor = async (req, res) => {
  try {
    const { vendor_id } = req.params;

    if (!vendor_id) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request",
        message: "Vendor ID is required" 
      });
    }

    // Check if vendor exists and check all foreign key constraints
    const checkQuery = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        CASE WHEN vps.vendor_id IS NOT NULL THEN true ELSE false END as has_products,
        CASE WHEN a.purchase_vendor_id = v.vendor_id OR a.service_vendor_id = v.vendor_id THEN true ELSE false END as has_assets
      FROM "tblVendors" v
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblAssets" a ON (v.vendor_id = a.purchase_vendor_id OR v.vendor_id = a.service_vendor_id)
      WHERE v.vendor_id = $1
      GROUP BY v.vendor_id, v.vendor_name, vps.vendor_id, a.purchase_vendor_id, a.service_vendor_id;
    `;
    const checkResult = await db.query(checkQuery, [vendor_id]);

    // Check if vendor exists
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Vendor not found",
        message: "The specified vendor does not exist"
      });
    }

    const vendor = checkResult.rows[0];

    // Check for any constraints
    if (vendor.has_products || vendor.has_assets) {
      const constraints = [];
      if (vendor.has_products) constraints.push("products/services");
      if (vendor.has_assets) constraints.push("assets");
      
      return res.status(400).json({
        success: false,
        error: "Constraint violation",
        message: "Cannot delete vendor with associated records",
        details: `${vendor.vendor_name} (${vendor.vendor_id}) - has associated ${constraints.join(" and ")}`
      });
    }

    // Delete the vendor
    const deleteQuery = 'DELETE FROM "tblVendors" WHERE vendor_id = $1 RETURNING *;';
    const { rows } = await db.query(deleteQuery, [vendor_id]);

    res.json({ 
      success: true, 
      message: "Vendor deleted successfully",
      deletedVendor: rows[0]
    });
  } catch (error) {
    console.error("Delete vendor error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Server Error",
      message: "Failed to delete vendor" 
    });
  }
};

// Delete multiple vendors
exports.deleteVendors = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request",
        message: "Please provide an array of vendor IDs to delete" 
      });
    }

    // Check if vendors exist and check all foreign key constraints
    const checkQuery = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        CASE WHEN vps.vendor_id IS NOT NULL THEN true ELSE false END as has_products,
        CASE WHEN a.purchase_vendor_id = v.vendor_id OR a.service_vendor_id = v.vendor_id THEN true ELSE false END as has_assets
      FROM "tblVendors" v
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblAssets" a ON (v.vendor_id = a.purchase_vendor_id OR v.vendor_id = a.service_vendor_id)
      WHERE v.vendor_id = ANY($1)
      GROUP BY v.vendor_id, v.vendor_name, vps.vendor_id, a.purchase_vendor_id, a.service_vendor_id;
    `;
    const checkResult = await db.query(checkQuery, [ids]);

    // Check if all vendors exist
    if (checkResult.rows.length !== ids.length) {
      return res.status(404).json({
        success: false,
        error: "Vendors not found",
        message: "One or more vendors do not exist"
      });
    }

    // Check for any constraints
    const vendorsWithConstraints = checkResult.rows.filter(row => row.has_products || row.has_assets);
    if (vendorsWithConstraints.length > 0) {
      const constraintDetails = vendorsWithConstraints.map(vendor => {
        const constraints = [];
        if (vendor.has_products) constraints.push("products/services");
        if (vendor.has_assets) constraints.push("assets");
        
        return `${vendor.vendor_name} (${vendor.vendor_id}) - has associated ${constraints.join(" and ")}`;
      });

      return res.status(400).json({
        success: false,
        error: "Constraint violation",
        message: "Cannot delete vendors with associated records",
        details: constraintDetails
      });
    }

    // Delete the vendors
    const deleteQuery = 'DELETE FROM "tblVendors" WHERE vendor_id = ANY($1) RETURNING *;';
    const { rows } = await db.query(deleteQuery, [ids]);

    res.json({ 
      success: true, 
      message: `${rows.length} vendor(s) deleted successfully`,
      deletedCount: rows.length
    });
  } catch (error) {
    console.error("Delete vendors error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Server Error",
      message: "Failed to delete vendors" 
    });
  }
};

// Update vendor by vendor_id
exports.updateVendor = async (req, res) => {
  try {
    const { vendor_id } = req.params;
    const {
      org_id,
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
          vendor_name = $2,
          int_status = $3,
          company_name = $4,
          address_line1 = $5,
          address_line2 = $6,
          city = $7,
          state = $8,
          pincode = $9,
          company_email = $10,
          gst_number = $11,
          cin_number = $12,
          contact_person_name = $13,
          contact_person_email = $14,
          contact_person_number = $15,
          changed_by = $16,
          changed_on = $17
        WHERE vendor_id = $18
        RETURNING *;
      `;

    const values = [
      org_id,
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
      ORDER BY v.vendor_name, ps.brand, ps.model
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor-product-services:', error);
    res.status(500).json({ error: "Failed to fetch vendor-product-services" });
  }
};
