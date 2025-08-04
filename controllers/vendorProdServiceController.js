const model = require("../models/vendorProdServiceModel");
const { generateCustomId } = require("../utils/idGenerator");

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
            org_id,
            ven_prod_serv_id // Optional, will be auto-generated if not provided
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
                error: "Vendor product service with this vendor_id, prod_serv_id, and org_id already exists" 
            });
        }

        // Use provided ven_prod_serv_id or generate one
        let finalVendorProdServiceId = ven_prod_serv_id;
        if (!ven_prod_serv_id) {
            finalVendorProdServiceId = await generateCustomId("vendor_prod_serv", 3);
        } else {
            // Check if the provided ven_prod_serv_id already exists
            const existingId = await model.checkVendorProdServiceIdExists(ven_prod_serv_id);
            if (existingId.rows.length > 0) {
                return res.status(409).json({ 
                    error: "Vendor product service with this ven_prod_serv_id already exists" 
                });
            }
        }

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
        
        // Handle specific database errors
        if (err.code === '23505') {
            // Duplicate key constraint violation
            if (err.detail && err.detail.includes('ven_prod_serv_id')) {
                return res.status(409).json({ 
                    error: "Duplicate vendor product service ID",
                    message: "A vendor product service with this ID already exists. Please try again.",
                    type: "DUPLICATE_ID"
                });
            } else {
                return res.status(409).json({ 
                    error: "Duplicate vendor product service",
                    message: "This vendor-product-service combination already exists.",
                    type: "DUPLICATE_RECORD"
                });
            }
        } else if (err.code === '23503') {
            // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Invalid reference",
                message: "The vendor or product/service does not exist.",
                type: "INVALID_REFERENCE"
            });
        } else if (err.message && err.message.includes("Invalid tableKey")) {
            // ID generator error
            return res.status(500).json({ 
                error: "ID generation error",
                message: "Unable to generate unique ID. Please try again.",
                type: "ID_GENERATION_ERROR"
            });
        }
        
        // Generic error
        res.status(500).json({ 
            error: "Failed to add vendor product service",
            message: "An unexpected error occurred. Please try again.",
            type: "INTERNAL_ERROR"
        });
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

        // Check if new vendor_id, prod_serv_id, and org_id combination already exists (excluding current record)
        if (vendor_id && prod_serv_id && org_id) {
            const duplicateCheck = await model.checkVendorProdServiceExists(vendor_id, prod_serv_id, org_id);
            const duplicate = duplicateCheck.rows.find(row => row.ven_prod_serv_id !== id);
            if (duplicate) {
                return res.status(409).json({ 
                    error: "Vendor product service with this vendor_id, prod_serv_id, and org_id already exists" 
                });
            }
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
        
        // Handle specific database errors
        if (err.code === '23505') {
            // Duplicate key constraint violation
            return res.status(409).json({ 
                error: "Duplicate vendor product service",
                message: "This vendor-product-service combination already exists.",
                type: "DUPLICATE_RECORD"
            });
        } else if (err.code === '23503') {
            // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Invalid reference",
                message: "The vendor or product/service does not exist.",
                type: "INVALID_REFERENCE"
            });
        }
        
        // Generic error
        res.status(500).json({ 
            error: "Failed to update vendor product service",
            message: "An unexpected error occurred. Please try again.",
            type: "INTERNAL_ERROR"
        });
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
        
        // Handle specific database errors
        if (err.code === '23503') {
            // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Cannot delete vendor product service",
                message: "This vendor product service is being used by other records and cannot be deleted.",
                type: "CONSTRAINT_VIOLATION"
            });
        }
        
        // Generic error
        res.status(500).json({ 
            error: "Failed to delete vendor product service",
            message: "An unexpected error occurred. Please try again.",
            type: "INTERNAL_ERROR"
        });
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
        
        // Handle specific database errors
        if (err.code === '23503') {
            // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Cannot delete vendor product services",
                message: "Some vendor product services are being used by other records and cannot be deleted.",
                type: "CONSTRAINT_VIOLATION"
            });
        }
        
        // Generic error
        res.status(500).json({ 
            error: "Failed to delete vendor product services",
            message: "An unexpected error occurred. Please try again.",
            type: "INTERNAL_ERROR"
        });
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
