const model = require("../models/vendorProdServiceModel");
const { generateCustomId } = require("../utils/idGenerator");
const db = require("../config/db");

// Generate vendor product service ID
const generateVendorProdServiceId = async () => {
    const result = await db.query(`SELECT ven_prod_serv_id FROM "tblVendorProdService" ORDER BY ven_prod_serv_id DESC LIMIT 1`);
    const lastId = result.rows[0]?.ven_prod_serv_id;
    
    let newNumber = 1; // starting number
    if (lastId && /^VPS\d+$/.test(lastId)) {
        newNumber = parseInt(lastId.replace('VPS', '')) + 1;
    }
    
    return `VPS${String(newNumber).padStart(3, '0')}`;
};

// GET /api/vendor-prod-services - Get all vendor product services
const getAllVendorProdServices = async (req, res) => {
    try {
        const result = await model.getAllVendorProdServices();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching vendor product services:", err);
        res.status(500).json({ error: "Failed to fetch vendor product services", err });
    }
};

// GET /api/vendor-prod-services/:id - Get vendor product service by ID
const getVendorProdServiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getVendorProdServiceById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Vendor product service not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching vendor product service:", err);
        res.status(500).json({ error: "Failed to fetch vendor product service" });
    }
};

// GET /api/vendor-prod-services/details/:id - Get vendor product service with details
const getVendorProdServiceWithDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getVendorProdServiceWithDetails(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Vendor product service not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching vendor product service details:", err);
        res.status(500).json({ error: "Failed to fetch vendor product service details" });
    }
};

// GET /api/vendor-prod-services/vendor/:vendor_id - Get vendor product services by vendor
const getVendorProdServicesByVendor = async (req, res) => {
    try {
        const { vendor_id } = req.params;
        const result = await model.getVendorProdServicesByVendor(vendor_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching vendor product services by vendor:", err);
        res.status(500).json({ error: "Failed to fetch vendor product services by vendor" });
    }
};

// GET /api/vendor-prod-services/prod-serv/:prod_serv_id - Get vendor product services by product service
const getVendorProdServicesByProdServ = async (req, res) => {
    try {
        const { prod_serv_id } = req.params;
        const result = await model.getVendorProdServicesByProdServ(prod_serv_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching vendor product services by product service:", err);
        res.status(500).json({ error: "Failed to fetch vendor product services by product service" });
    }
};

// GET /api/vendor-prod-services/org/:org_id - Get vendor product services by organization
const getVendorProdServicesByOrg = async (req, res) => {
    try {
        const { org_id } = req.params;
        const result = await model.getVendorProdServicesByOrg(org_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching vendor product services by organization:", err);
        res.status(500).json({ error: "Failed to fetch vendor product services by organization" });
    }
};

// POST /api/vendor-prod-services - Add new vendor product service
const addVendorProdService = async (req, res) => {
    try {
        const {
            prod_serv_id,
            vendor_id,
            org_id
        } = req.body;

        // Validate required fields
        if (!prod_serv_id || !vendor_id || !org_id) {
            return res.status(400).json({ 
                error: "prod_serv_id, vendor_id, and org_id are required fields" 
            });
        }

        // Check if vendor product service already exists
        const existingVendorProdService = await model.checkVendorProdServiceExists(vendor_id, prod_serv_id, org_id);
        if (existingVendorProdService.rows.length > 0) {
            return res.status(409).json({ 
                error: "Vendor product service with this vendor_id and prod_serv_id combination already exists" 
            });
        }

        // Generate ven_prod_serv_id automatically
        const finalVendorProdServiceId = await generateVendorProdServiceId();

        // Insert new vendor product service
        const result = await model.insertVendorProdService(
            finalVendorProdServiceId,
            prod_serv_id,
            vendor_id,
            org_id
        );

        res.status(201).json({
            message: "Vendor product service added successfully",
            vendorProdService: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding vendor product service:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// PUT /api/vendor-prod-services/:id - Update vendor product service
const updateVendorProdService = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            prod_serv_id,
            vendor_id,
            org_id
        } = req.body;

        // Check if vendor product service exists
        const existingVendorProdService = await model.getVendorProdServiceById(id);
        if (existingVendorProdService.rows.length === 0) {
            return res.status(404).json({ error: "Vendor product service not found" });
        }

        const updateData = {
            prod_serv_id: prod_serv_id || existingVendorProdService.rows[0].prod_serv_id,
            vendor_id: vendor_id || existingVendorProdService.rows[0].vendor_id,
            org_id: org_id || existingVendorProdService.rows[0].org_id
        };

        const result = await model.updateVendorProdService(id, updateData);

        res.status(200).json({
            message: "Vendor product service updated successfully",
            vendorProdService: result.rows[0]
        });

    } catch (err) {
        console.error("Error updating vendor product service:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /api/vendor-prod-services/:id - Delete single vendor product service
const deleteVendorProdService = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if vendor product service exists
        const existingVendorProdService = await model.getVendorProdServiceById(id);
        if (existingVendorProdService.rows.length === 0) {
            return res.status(404).json({ error: "Vendor product service not found" });
        }

        // Delete the vendor product service
        const result = await model.deleteVendorProdService(id);

        res.status(200).json({
            message: "Vendor product service deleted successfully",
            deletedVendorProdService: result.rows[0]
        });

    } catch (err) {
        console.error("Error deleting vendor product service:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /api/vendor-prod-services - Delete multiple vendor product services
const deleteMultipleVendorProdServices = async (req, res) => {
    try {
        const { ven_prod_serv_ids } = req.body;

        if (!Array.isArray(ven_prod_serv_ids) || ven_prod_serv_ids.length === 0) {
            return res.status(400).json({ 
                error: "ven_prod_serv_ids array is required and must not be empty" 
            });
        }

        // Check if all vendor product services exist
        const existingVendorProdServices = [];
        for (const ven_prod_serv_id of ven_prod_serv_ids) {
            const vendorProdService = await model.getVendorProdServiceById(ven_prod_serv_id);
            if (vendorProdService.rows.length > 0) {
                existingVendorProdServices.push(ven_prod_serv_id);
            }
        }

        if (existingVendorProdServices.length === 0) {
            return res.status(404).json({ 
                error: "None of the specified vendor product services were found" 
            });
        }

        // Delete the vendor product services
        const result = await model.deleteMultipleVendorProdServices(existingVendorProdServices);

        res.status(200).json({
            message: `${result.rows.length} vendor product service(s) deleted successfully`,
            deletedVendorProdServices: result.rows,
            requestedCount: ven_prod_serv_ids.length,
            deletedCount: result.rows.length
        });

    } catch (err) {
        console.error("Error deleting multiple vendor product services:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getAllVendorProdServices,
    getVendorProdServiceById,
    getVendorProdServiceWithDetails,
    getVendorProdServicesByVendor,
    getVendorProdServicesByProdServ,
    getVendorProdServicesByOrg,
    addVendorProdService,
    updateVendorProdService,
    deleteVendorProdService,
    deleteMultipleVendorProdServices
};
