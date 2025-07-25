const model = require("../models/assetAssignmentModel");

// POST /api/asset-assignments - Add new asset assignment
const addAssetAssignment = async (req, res) => {
    try {
        const {
            asset_assign_id,
            dept_id,
            asset_id,
            org_id,
            employee_int_id,
            action = "Assigned",
            action_by,
            latest_assignment_flag
        } = req.body;

        const created_by = req.user.user_id;

        // Validate basic required fields
        if (!asset_assign_id || !dept_id || !asset_id || !org_id || latest_assignment_flag === undefined) {
            return res.status(400).json({ 
                error: "asset_assign_id, dept_id, asset_id, org_id, and latest_assignment_flag are required fields" 
            });
        }

        // Check asset type assignment_type to determine if employee_int_id is required
        const assetModel = require("../models/assetModel");
        const assetTypeResult = await assetModel.getAssetTypeAssignmentType(asset_id);
        
        if (assetTypeResult.rows.length === 0) {
            return res.status(404).json({ 
                error: "Asset not found or asset type not configured" 
            });
        }

        const assignmentType = assetTypeResult.rows[0].assignment_type;
        
        // Validate employee_int_id based on assignment_type
        if (assignmentType === "User" && !employee_int_id) {
            return res.status(400).json({ 
                error: "employee_int_id is required when assignment_type is 'User'" 
            });
        }

        // Check if asset assignment already exists
        const existingAssignment = await model.checkAssetAssignmentExists(asset_assign_id);
        if (existingAssignment.rows.length > 0) {
            return res.status(409).json({ 
                error: "Asset assignment with this asset_assign_id already exists" 
            });
        }

        // Prepare assignment data
        const assignmentData = {
            asset_assign_id,
            dept_id,
            asset_id,
            org_id,
            employee_int_id: assignmentType === "Department" ? null : employee_int_id,
            action,
            action_by: created_by,
            latest_assignment_flag
        };

        // Insert new asset assignment
        const result = await model.insertAssetAssignment(assignmentData);

        res.status(201).json({
            message: "Asset assignment added successfully",
            assignment: result.rows[0],
            assignment_type: assignmentType
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

// GET /api/asset-assignments/employee/:employee_id/active - Get active asset assignments by employee
const getActiveAssetAssignmentsByEmployee = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const result = await model.getActiveAssetAssignmentsByEmployeeWithDetails(employee_id);
        
        const count = result.assignments.length;
        const message = count > 0 ? `Active AssetAssignment : ${count}` : "No active asset assignments found";
        
        // Check if employee exists
        if (!result.employee) {
            return res.status(404).json({ 
                error: "Employee not found",
                message: "Employee not found",
                count: 0,
                data: [],
                employee: null,
                department: null
            });
        }
        
        res.status(200).json({
            message: message,
            count: count,
            data: result.assignments,
            employee: {
                emp_int_id: result.employee.emp_int_id,
                employee_id: result.employee.employee_id,
                employee_name: result.employee.employee_name,
                dept_id: result.employee.dept_id
            },
            department: {
                dept_id: result.employee.dept_id,
                department_name: result.employee.department_name
            }
        });
    } catch (err) {
        console.error("Error fetching active asset assignments by employee:", err);
        res.status(500).json({ error: "Failed to fetch active asset assignments by employee" });
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
            asset_id,
            org_id,
            employee_int_id,
            action,
            action_by,
            latest_assignment_flag
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
            asset_id,
            org_id,
            employee_int_id,
            action,
            action_by: changed_by,
            latest_assignment_flag
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

// PUT /api/asset-assignments/asset/:asset_id - Update asset assignment by asset_id (only for action="A" and latest_assignment_flag=true)
const updateAssetAssignmentByAssetId = async (req, res) => {
    try {
        const { asset_id } = req.params;
        const { latest_assignment_flag } = req.body;

        // Validate required field
        if (latest_assignment_flag === undefined) {
            return res.status(400).json({ 
                error: "latest_assignment_flag is required field" 
            });
        }

        // Check if asset assignment exists with the required conditions
        const existingAssignment = await model.getAssetAssignmentsByAsset(asset_id);
        const validAssignment = existingAssignment.rows.find(row => 
            row.action === 'A' && row.latest_assignment_flag === true
        );
        
        if (!validAssignment) {
            return res.status(404).json({ 
                error: "No asset assignment found with action='A' and latest_assignment_flag=true for this asset_id" 
            });
        }

        // Update asset assignment
        const result = await model.updateAssetAssignmentByAssetId(asset_id, latest_assignment_flag);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: "No rows were updated. Please check if the asset has action='A' and latest_assignment_flag=true" 
            });
        }

        res.status(200).json({
            message: "Asset assignment updated successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error updating asset assignment by asset_id:", err);
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
        res.status(500).json({ error: "Internal server error" });
    }
};

// GET /api/asset-assignments/department/:dept_id/assignments - Get department-wise asset assignments
const getDepartmentWiseAssetAssignments = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const result = await model.getDepartmentWiseAssetAssignments(dept_id);
        
        // Check if department exists
        if (!result.department) {
            return res.status(404).json({ 
                error: "Department not found",
                message: "Department not found",
                department: null,
                assignedAssets: [],
                assetCount: 0,
                employeeCount: 0
            });
        }
        
        const assetCount = result.assignedAssets.length;
        const employeeCount = result.department.employee_count;
        
        const message = assetCount > 0 
            ? `Department has ${assetCount} assigned assets and ${employeeCount} employees`
            : `Department has no assigned assets and ${employeeCount} employees`;
        
        res.status(200).json({
            message: message,
            department: {
                dept_id: result.department.dept_id,
                department_name: result.department.department_name,
                employee_count: employeeCount
            },
            assetCount: assetCount,
            employeeCount: employeeCount,
            assignedAssets: result.assignedAssets
        });
    } catch (err) {
        console.error("Error fetching department-wise asset assignments:", err);
        res.status(500).json({ error: "Failed to fetch department-wise asset assignments" });
    }
};

module.exports = {
    addAssetAssignment,
    getAllAssetAssignments,
    getAssetAssignmentById,
    getAssetAssignmentWithDetails,
    getAssetAssignmentsByDept,
    getAssetAssignmentsByEmployee,
    getActiveAssetAssignmentsByEmployee,
    getAssetAssignmentsByAsset,
    getAssetAssignmentsByStatus,
    getAssetAssignmentsByOrg,
    updateAssetAssignment,
    updateAssetAssignmentByAssetId,
    deleteAssetAssignment,
    deleteMultipleAssetAssignments,
    getDepartmentWiseAssetAssignments,
};
