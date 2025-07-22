const model = require("../models/assetAssignmentModel");

// POST /api/asset-assignments - Add new asset assignment
const addAssetAssignment = async (req, res) => {
    try {
        const {
            asset_assign_id,
            dept_id,
            employee_id,
            asset_id,
            effective_date,
            return_date,
            status = "Active",
            org_id
        } = req.body;

        const created_by = req.user.user_id;

        // Validate required fields
        if (!asset_assign_id || !dept_id || !employee_id || !asset_id || !org_id) {
            return res.status(400).json({ 
                error: "asset_assign_id, dept_id, employee_id, asset_id, and org_id are required fields" 
            });
        }



        // Check if asset assignment already exists
        const existingAssignment = await model.checkAssetAssignmentExists(asset_assign_id);
        if (existingAssignment.rows.length > 0) {
            return res.status(409).json({ 
                error: "Asset assignment with this asset_assign_id already exists" 
            });
        }

        // Check if there's already an active assignment for this asset and employee
        const activeAssignment = await model.checkActiveAssignmentExists(asset_id, employee_id, org_id);
        if (activeAssignment.rows.length > 0) {
            return res.status(409).json({ 
                error: "There is already an active assignment for this asset and employee" 
            });
        }

        // Prepare assignment data
        const assignmentData = {
            asset_assign_id,
            dept_id,
            employee_id,
            asset_id,
            effective_date,
            return_date,
            status,
            org_id,
            created_by
        };

        // Insert new asset assignment
        const result = await model.insertAssetAssignment(assignmentData);

        res.status(201).json({
            message: "Asset assignment added successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding asset assignment:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

// GET /api/asset-assignments - Get all asset assignments
const getAllAssetAssignments = async (req, res) => {
    try {
        const result = await model.getAllAssetAssignments();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments" });
    }
};

// GET /api/asset-assignments/:id - Get asset assignment by ID
const getAssetAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetAssignmentById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset assignment not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching asset assignment:", err);
        res.status(500).json({ error: "Failed to fetch asset assignment" });
    }
};

// GET /api/asset-assignments/details/:id - Get asset assignment with detailed information
const getAssetAssignmentWithDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetAssignmentWithDetails(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset assignment not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching asset assignment details:", err);
        res.status(500).json({ error: "Failed to fetch asset assignment details", err });
    }
};

// GET /api/asset-assignments/dept/:dept_id - Get asset assignments by department
const getAssetAssignmentsByDept = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const result = await model.getAssetAssignmentsByDept(dept_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by department:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments by department" });
    }
};

// GET /api/asset-assignments/employee/:employee_id - Get asset assignments by employee
const getAssetAssignmentsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const result = await model.getAssetAssignmentsByEmployee(employee_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by employee:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments by employee" });
    }
};

// GET /api/asset-assignments/asset/:asset_id - Get asset assignments by asset
const getAssetAssignmentsByAsset = async (req, res) => {
    try {
        const { asset_id } = req.params;
        const result = await model.getAssetAssignmentsByAsset(asset_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by asset:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments by asset" });
    }
};

// GET /api/asset-assignments/status/:status - Get asset assignments by status
const getAssetAssignmentsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const result = await model.getAssetAssignmentsByStatus(status);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by status:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments by status" });
    }
};

// GET /api/asset-assignments/org/:org_id - Get asset assignments by organization
const getAssetAssignmentsByOrg = async (req, res) => {
    try {
        const { org_id } = req.params;
        const result = await model.getAssetAssignmentsByOrg(org_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by organization:", err);
        res.status(500).json({ error: "Failed to fetch asset assignments by organization" });
    }
};

// PUT /api/asset-assignments/:id - Update asset assignment
const updateAssetAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            dept_id,
            employee_id,
            asset_id,
            effective_date,
            return_date,
            status,
            org_id
        } = req.body;

        const changed_by = req.user.user_id;

        // Check if asset assignment exists
        const existingAssignment = await model.getAssetAssignmentById(id);
        if (existingAssignment.rows.length === 0) {
            return res.status(404).json({ error: "Asset assignment not found" });
        }

        // Prepare update data
        const updateData = {
            dept_id,
            employee_id,
            asset_id,
            effective_date,
            return_date,
            status,
            org_id,
            changed_by
        };

        // Update asset assignment
        const result = await model.updateAssetAssignment(id, updateData);

        res.status(200).json({
            message: "Asset assignment updated successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error updating asset assignment:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

// DELETE /api/asset-assignments/:id - Delete single asset assignment
const deleteAssetAssignment = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if asset assignment exists
        const existingAssignment = await model.getAssetAssignmentById(id);
        if (existingAssignment.rows.length === 0) {
            return res.status(404).json({ error: "Asset assignment not found" });
        }

        // Delete asset assignment
        const result = await model.deleteAssetAssignment(id);

        res.status(200).json({
            message: "Asset assignment deleted successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error deleting asset assignment:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

// DELETE /api/asset-assignments - Delete multiple asset assignments
const deleteMultipleAssetAssignments = async (req, res) => {
    try {
        const { asset_assign_ids } = req.body;

        if (!asset_assign_ids || !Array.isArray(asset_assign_ids) || asset_assign_ids.length === 0) {
            return res.status(400).json({ 
                error: "asset_assign_ids array is required" 
            });
        }

        // Delete multiple asset assignments
        const result = await model.deleteMultipleAssetAssignments(asset_assign_ids);

        res.status(200).json({
            message: `${result.rows.length} asset assignment(s) deleted successfully`,
            deleted_assignments: result.rows
        });

    } catch (err) {
        console.error("Error deleting multiple asset assignments:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

module.exports = {
    addAssetAssignment,
    getAllAssetAssignments,
    getAssetAssignmentById,
    getAssetAssignmentWithDetails,
    getAssetAssignmentsByDept,
    getAssetAssignmentsByEmployee,
    getAssetAssignmentsByAsset,
    getAssetAssignmentsByStatus,
    getAssetAssignmentsByOrg,
    updateAssetAssignment,
    deleteAssetAssignment,
    deleteMultipleAssetAssignments,
};
