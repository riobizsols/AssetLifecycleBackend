// controllers/deptAssetController.js
const model = require("../models/deptAssetsModel");
const db = require('../config/db');
const { generateCustomId } = require("../utils/idGenerator");


const addDeptAsset = async (req, res) => {
    try {
        const { dept_id, asset_type_id } = req.body;
        const created_by = req.user.user_id;

        // Validation
        if (!dept_id || !asset_type_id) {
            return res.status(400).json({ 
                error: "Missing required fields",
                message: "Both department and asset type are required" 
            });
        }

        // Check if department exists
        const deptCheck = await db.query(
            `SELECT text FROM "tblDepartments" WHERE dept_id = $1`,
            [dept_id]
        );

        if (deptCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: "Department not found",
                message: "The specified department does not exist" 
            });
        }

        // Check if asset type exists
        const assetRes = await model.getAssetMeta(asset_type_id);
        if (assetRes.rows.length === 0) {
            return res.status(404).json({ 
                error: "Asset Type not found",
                message: "The specified asset type does not exist" 
            });
        }

        const { org_id } = assetRes.rows[0];

        // Check if mapping already exists
        const existingMapping = await db.query(
            `SELECT * FROM "tblDeptAssetTypes" WHERE dept_id = $1 AND asset_type_id = $2`,
            [dept_id, asset_type_id]
        );

        if (existingMapping.rows.length > 0) {
            return res.status(400).json({ 
                error: "Mapping already exists",
                message: "This asset type is already mapped to this department" 
            });
        }

        const dept_asset_type_id = await generateCustomId("dept_asset", 3);

        await model.insertDeptAsset(dept_asset_type_id, dept_id, asset_type_id, org_id, created_by);

        res.status(201).json({ 
            message: "Department asset mapping created successfully",
            data: { dept_asset_type_id, dept_id, asset_type_id }
        });
    } catch (err) {
        console.error("Error adding dept asset:", err);
        
        // Handle specific database errors
        if (err.code === '23505') { // Unique constraint violation
            return res.status(400).json({ 
                error: "Duplicate mapping",
                message: "This asset type is already mapped to this department" 
            });
        }
        
        if (err.code === '23503') { // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Invalid reference",
                message: "The specified department or asset type does not exist" 
            });
        }
        
        res.status(500).json({ 
            error: "Failed to create department asset mapping",
            message: "An internal server error occurred" 
        });
    }
};

const getAllAssetTypes = async (req, res) => {
    try {
        const { assignment_type } = req.query;
        
        let query = `SELECT 
                asset_type_id, 
                text,
                assignment_type,
                group_required,
                COALESCE(is_child, false) as is_child,
                parent_asset_type_id
             FROM "tblAssetTypes" 
             WHERE int_status = 1`;
        
        const params = [];
        
        // If assignment_type is provided, filter by it
        if (assignment_type) {
            query += ` AND assignment_type = $1`;
            params.push(assignment_type);
            console.log(`Fetching asset types with assignment_type = '${assignment_type}'...`);
        } else {
            console.log('Fetching all active asset types...');
        }
        
        query += ` ORDER BY text`;
        
        const result = await db.query(query, params);
        console.log(`Found ${result.rows.length} asset types:`, result.rows);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset types:", err);
        res.status(500).json({ error: "Failed to fetch asset types" });
    }
};

const deleteDeptAsset = async (req, res) => {
    try {
        const { dept_asset_type_id } = req.body;
        if (!dept_asset_type_id) return res.status(400).json({ error: "Department Asset Type ID is required" });

        await model.deleteDeptAsset(dept_asset_type_id);
        res.status(200).json({ message: "Department asset type mapping deleted successfully" });
    } catch (err) {
        console.error("Error deleting dept asset:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

const fetchAllDeptAssets = async (req, res) => {
    try {
        const result = await model.getAllDeptAssets();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching dept assets:", err);
        res.status(500).json({ error: "Failed to fetch dept assets" });
    }
};

const getAssetTypesByDepartment = async (req, res) => {
    try {
        const { dept_id } = req.params;
        
        // Validation
        if (!dept_id) {
            return res.status(400).json({ 
                error: "Department ID is required",
                message: "Please provide a valid department ID" 
            });
        }

        // Check if department exists
        const deptCheck = await db.query(
            `SELECT text FROM "tblDepartments" WHERE dept_id = $1`,
            [dept_id]
        );

        if (deptCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: "Department not found",
                message: "The specified department does not exist" 
            });
        }

        const result = await model.getAssetTypesByDepartment(dept_id);
        
        res.status(200).json({
            success: true,
            message: "Asset types retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            department: {
                dept_id: dept_id,
                dept_name: deptCheck.rows[0].text
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching asset types by department:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch asset types by department",
            message: "An internal server error occurred" 
        });
    }
};

module.exports = {
    addDeptAsset,
    getAllAssetTypes,
    deleteDeptAsset,
    fetchAllDeptAssets,
    getAssetTypesByDepartment,
};
