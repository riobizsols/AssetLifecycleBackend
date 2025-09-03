const model = require("../models/docTypeObjectModel");

// GET /api/doc-type-objects - Get all document type objects
const getAllDocTypeObjects = async (req, res) => {
    try {
        // Get org_id from authenticated user if available, otherwise null
        const org_id = req.user ? req.user.org_id : null;
        
        const result = await model.getAllDocTypeObjects(org_id);
        
        res.status(200).json({
            success: true,
            message: "Document type objects retrieved successfully",
            data: result.rows,
            count: result.rows.length
        });
        
    } catch (err) {
        console.error("Error getting document type objects:", err);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve document type objects"
        });
    }
};

// GET /api/doc-type-objects/:id - Get document type object by ID
const getDocTypeObjectById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                success: false,
                error: "Document type object ID is required"
            });
        }
        
        const result = await model.getDocTypeObjectById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Document type object not found"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Document type object retrieved successfully",
            data: result.rows[0]
        });
        
    } catch (err) {
        console.error("Error getting document type object by ID:", err);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve document type object"
        });
    }
};

// GET /api/doc-type-objects/object-type/:object_type - Get document type objects by object type
const getDocTypeObjectsByObjectType = async (req, res) => {
    try {
        const { object_type } = req.params;
        
        if (!object_type) {
            return res.status(400).json({
                success: false,
                error: "Object type is required"
            });
        }
        
        // Get org_id from authenticated user if available, otherwise null
        const org_id = req.user ? req.user.org_id : null;
        
        const result = await model.getDocTypeObjectsByObjectType(object_type, org_id);
        
        res.status(200).json({
            success: true,
            message: "Document type objects retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            object_type: object_type,
            includes_common: result.rows.some(row => row.object_type === '*'),
            note: "Results include both specific object type and common (*) document types"
        });
        
    } catch (err) {
        console.error("Error getting document type objects by object type:", err);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve document type objects"
        });
    }
};

// GET /api/doc-type-objects/doc-type/:doc_type - Get document type objects by document type
const getDocTypeObjectsByDocType = async (req, res) => {
    try {
        const { doc_type } = req.params;
        
        if (!doc_type) {
            return res.status(400).json({
                success: false,
                error: "Document type is required"
            });
        }
        
        // Get org_id from authenticated user if available, otherwise null
        const org_id = req.user ? req.user.org_id : null;
        
        const result = await model.getDocTypeObjectsByDocType(doc_type, org_id);
        
        res.status(200).json({
            success: true,
            message: "Document type objects retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            doc_type: doc_type
        });
        
    } catch (err) {
        console.error("Error getting document type objects by document type:", err);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve document type objects"
        });
    }
};

// GET /api/doc-type-objects/common - Get common document type objects (object_type = '*')
const getCommonDocTypeObjects = async (req, res) => {
    try {
        // Get org_id from authenticated user if available, otherwise null
        const org_id = req.user ? req.user.org_id : null;
        
        const result = await model.getCommonDocTypeObjects(org_id);
        
        res.status(200).json({
            success: true,
            message: "Common document type objects retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            note: "These are universal document types that apply to all object types"
        });
        
    } catch (err) {
        console.error("Error getting common document type objects:", err);
        res.status(500).json({
            success: false,
            error: "Internal server error",
            message: "Failed to retrieve common document type objects"
        });
    }
};

module.exports = {
    getAllDocTypeObjects,
    getDocTypeObjectById,
    getDocTypeObjectsByObjectType,
    getDocTypeObjectsByDocType,
    getCommonDocTypeObjects
};
