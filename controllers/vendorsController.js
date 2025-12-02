const vendorsModel = require("../models/vendorsModel");
const { v4: uuidv4 } = require("uuid");
const { generateCustomId } = require("../utils/idGenerator");
//To get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    const org_id = req.user.org_id;
    
    // Get user's branch information
    const userModel = require("../models/userModel");
    const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
    const userBranchId = userWithBranch?.branch_id;
    
    console.log('=== Vendor Listing Debug ===');
    console.log('User org_id:', org_id);
    console.log('User branch_id:', userBranchId);
    
    // Get branch_code from tblBranches
    let userBranchCode = null;
    if (userBranchId) {
      const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;
      const dbPool = req.db || require("../config/db");

      const branchResult = await dbPool.query(branchQuery, [userBranchId]);
      if (branchResult.rows.length > 0) {
        userBranchCode = branchResult.rows[0].branch_code;
        console.log('User branch_code:', userBranchCode);
      } else {
        console.log('Branch not found for branch_id:', userBranchId);
      }
    }
    
    const vendors = await vendorsModel.getAllVendors(org_id, userBranchCode);
    res.json(vendors);
  } catch (error) {
    console.error("Get all vendors error:", error);
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
    
    // Fetch vendor SLAs from tblVendorSLAs (one row with 10 columns)
    const vendorSLAModel = require("../models/vendorSLAModel");
    const vendorSLAsRow = await vendorSLAModel.getVendorSLAs(vendorId);
    
    // Convert row with columns to array format for frontend
    let vendor_slas = [];
    if (vendorSLAsRow) {
      for (let i = 1; i <= 10; i++) {
        const columnName = `SLA-${i}`;
        const value = vendorSLAsRow[columnName];
        if (value) {
          vendor_slas.push({
            sla_id: columnName,
            value: value
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        ...vendor,
        vendor_slas: vendor_slas // Add vendor SLAs as array for frontend
      },
      message: "Vendor details retrieved successfully"
    });
  } catch (error) {
    console.error("Get vendor by ID error:", error);
    res.status(500).json({ error: "Failed to fetch vendor details" });
  }
};

//add new vendor

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
      vendor_slas, // Array of {sla_id, value}
      contract_start_date,
      contract_end_date,
      created_by,
      changed_by,
    } = req.body;

    // Use internal org_id from req.user (already set by authMiddleware from tblOrgs)
    const org_id = req.user.org_id; // This is now the internal org_id from tblOrgs
    
    // Get user's branch information
    const userModel = require("../models/userModel");
    const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
    const userBranchId = userWithBranch?.branch_id;
    
    console.log('=== Vendor Creation Debug ===');
    console.log('Internal org_id (from req.user):', org_id);
    console.log('Tenant org_id (for reference):', req.user.tenant_org_id);
    console.log('User branch_id:', userBranchId);
    
    // Get branch_code from tblBranches
    let branch_code = null;
    if (userBranchId) {
      const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;
      const dbPool = req.db || require("../config/db");

      const branchResult = await dbPool.query(branchQuery, [userBranchId]);
      if (branchResult.rows.length > 0) {
        branch_code = branchResult.rows[0].branch_code;
        console.log('Branch code found:', branch_code);
      } else {
        console.log('Branch not found for branch_id:', userBranchId);
      }
    }
    
    const changed_on = new Date();
    const created_on = new Date();
    const vendor_id = await generateCustomId("vendor", 3); // Generate vendor_id using idGenerator

    const vendorData = {
      vendor_id, // use generated
      org_id: org_id, // Use internal org_id from req.user (already set by authMiddleware)
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
      changed_on,
    };

    const newVendor = await vendorsModel.createVendor(vendorData);

    // Save vendor SLAs to tblVendorSLAs if provided (one row with 10 columns)
    if (vendor_slas && Array.isArray(vendor_slas) && vendor_slas.length > 0) {
      const vendorSLAModel = require("../models/vendorSLAModel");
      const vsla_id = await generateCustomId("vendor_sla", 3);
      
      // Map array to 10 columns (SLA-1 through SLA-10)
      const slaData = {
        "SLA-1": null,
        "SLA-2": null,
        "SLA-3": null,
        "SLA-4": null,
        "SLA-5": null,
        "SLA-6": null,
        "SLA-7": null,
        "SLA-8": null,
        "SLA-9": null,
        "SLA-10": null
      };
      
      for (const sla of vendor_slas) {
        if (sla.sla_id && sla.value) {
          // Map sla_id (e.g., "SLA-1") to column name
          const columnName = sla.sla_id; // e.g., "SLA-1"
          if (slaData.hasOwnProperty(columnName)) {
            slaData[columnName] = sla.value;
            console.log(`[VendorController] ✅ Mapping SLA: ${sla.sla_id} = "${sla.value}" → column "${columnName}"`);
          } else {
            console.warn(`[VendorController] ⚠️ Invalid SLA ID: ${sla.sla_id} - not mapped to any column`);
          }
        }
      }
      
      console.log(`[VendorController] 📊 Final SLA data mapping for vendor ${newVendor.vendor_id}:`, slaData);
      
      const vendorSLARecord = {
        vsla_id,
        vendor_id: newVendor.vendor_id,
        ...slaData,
        created_by: created_by || req.user.user_id,
        created_on: new Date(),
        changed_by: changed_by || req.user.user_id,
        changed_on: new Date(),
        int_status: 1
      };
      
      await vendorSLAModel.upsertVendorSLA(vendorSLARecord);
      console.log(`[VendorController] ✅ Created/Updated vendor SLA record (vsla_id: ${vsla_id}) for vendor: ${newVendor.vendor_id}`);
    }

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
    const dbPool = req.db || require("../config/db");

    const checkResult = await dbPool.query(checkQuery, [vendor_id]);

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
    const { rows } = await dbPool.query(deleteQuery, [vendor_id]);

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
        CASE WHEN a.purchase_vendor_id IS NOT NULL OR a.service_vendor_id IS NOT NULL THEN true ELSE false END as has_assets
      FROM "tblVendors" v
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblAssets" a ON v.vendor_id = a.purchase_vendor_id OR v.vendor_id = a.service_vendor_id
      WHERE v.vendor_id = ANY($1)
      GROUP BY v.vendor_id, v.vendor_name, vps.vendor_id, a.purchase_vendor_id, a.service_vendor_id;
    `;
    const dbPool = req.db || require("../config/db");

    const checkResult = await dbPool.query(checkQuery, [ids]);

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
    const { rows } = await dbPool.query(deleteQuery, [ids]);

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
    
    // Use internal org_id from req.user (already set by authMiddleware from tblOrgs)
    const org_id = req.user.org_id; // This is now the internal org_id from tblOrgs
    
    const {
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
      vendor_slas, // Array of {sla_id, value, vsla_id?} for updates
      contract_start_date,
      contract_end_date,
      changed_by,
      changed_on,
    } = req.body;

    const dbPool = req.db || require("../config/db");

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
          contract_start_date = $16,
          contract_end_date = $17,
          changed_by = $18,
          changed_on = $19
        WHERE vendor_id = $20
        RETURNING *;
      `;

    const values = [
      org_id, // Use internal org_id from req.user (already set by authMiddleware)
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
      contract_start_date || null,
      contract_end_date || null,
      changed_by,
      changed_on,
      vendor_id,
    ];

    const { rows } = await dbPool.query(query, values);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }

    // Update vendor SLAs if provided (one row with 10 columns)
    if (vendor_slas && Array.isArray(vendor_slas)) {
      const vendorSLAModel = require("../models/vendorSLAModel");
      
      // Check if record exists to get vsla_id, otherwise generate new one
      const existing = await vendorSLAModel.getVendorSLAs(vendor_id);
      const vsla_id = existing ? existing.vsla_id : await generateCustomId("vendor_sla", 3);
      
      // Map array to 10 columns (SLA-1 through SLA-10)
      const slaData = {
        "SLA-1": null,
        "SLA-2": null,
        "SLA-3": null,
        "SLA-4": null,
        "SLA-5": null,
        "SLA-6": null,
        "SLA-7": null,
        "SLA-8": null,
        "SLA-9": null,
        "SLA-10": null
      };
      
      for (const sla of vendor_slas) {
        if (sla.sla_id && sla.value) {
          // Map sla_id (e.g., "SLA-1") to column name
          const columnName = sla.sla_id; // e.g., "SLA-1"
          if (slaData.hasOwnProperty(columnName)) {
            slaData[columnName] = sla.value;
          }
        }
      }
      
      const vendorSLARecord = {
        vsla_id,
        vendor_id: vendor_id,
        ...slaData,
        created_by: existing ? existing.created_by : (changed_by || req.user.user_id),
        created_on: existing ? existing.created_on : new Date(),
        changed_by: changed_by || req.user.user_id,
        changed_on: new Date(),
        int_status: existing ? existing.int_status : 1
      };
      
      await vendorSLAModel.upsertVendorSLA(vendorSLARecord);
      console.log(`[VendorController] Updated vendor SLA record for vendor: ${vendor_id}`);
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
    
    const dbPool = req.db || require("../config/db");

    
    const result = await dbPool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vendor-product-services:', error);
    res.status(500).json({ error: "Failed to fetch vendor-product-services" });
  }
};

// Get vendor SLAs by vendor ID (returns only filled SLAs with descriptions)
exports.getVendorSLAs = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendorSLAModel = require("../models/vendorSLAModel");
    const vendorSLAsRow = await vendorSLAModel.getVendorSLAs(vendorId);
    
    if (!vendorSLAsRow) {
      return res.json({
        success: true,
        data: [],
        message: "No SLAs configured for this vendor"
      });
    }
    
    // Get SLA descriptions from tblsla_desc
    const dbPool = req.db || require("../config/db");
    const slaDescriptionsQuery = `
      SELECT sla_id, description
      FROM "tblsla_desc"
      ORDER BY sla_id
    `;
    const slaDescriptionsResult = await dbPool.query(slaDescriptionsQuery);
    const slaDescriptionsMap = {};
    slaDescriptionsResult.rows.forEach(row => {
      slaDescriptionsMap[row.sla_id] = row.description || row.sla_id;
    });
    
    // Convert row with columns to array format, only include filled SLAs
    let vendor_slas = [];
    for (let i = 1; i <= 10; i++) {
      const columnName = `SLA-${i}`;
      const value = vendorSLAsRow[columnName];
      if (value && value.trim() !== '') {
        vendor_slas.push({
          sla_id: columnName,
          value: value,
          description: slaDescriptionsMap[columnName] || null
        });
      }
    }
    
    res.json({
      success: true,
      data: vendor_slas,
      message: "Vendor SLAs retrieved successfully"
    });
  } catch (error) {
    console.error("Get vendor SLAs error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch vendor SLAs",
      message: error.message 
    });
  }
};