const model = require("../models/assetAssignmentModel");
const deptAssignmentLogger = require("../eventLoggers/deptAssignmentEventLogger");
const empAssignmentLogger = require("../eventLoggers/empAssignmentEventLogger");

// POST /api/asset-assignments - Add new asset assignment
const addAssetAssignment = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
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

        // STEP 1: Log API called (non-blocking)
        deptAssignmentLogger.logAssignmentApiCalled({
            method: req.method,
            url: req.originalUrl,
            assetId: asset_id,
            deptId: dept_id,
            orgId: org_id,
            userId,
            requestBody: req.body
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Validate basic required fields (non-blocking)
        deptAssignmentLogger.logValidatingParameters({
            assetId: asset_id,
            deptId: dept_id,
            orgId: org_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        if (!asset_assign_id || !dept_id || !asset_id || !org_id || latest_assignment_flag === undefined) {
            deptAssignmentLogger.logMissingParameters({
                operation: 'addAssetAssignment',
                missingParams: ['asset_assign_id', 'dept_id', 'asset_id', 'org_id', 'latest_assignment_flag'],
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "asset_assign_id, dept_id, asset_id, org_id, and latest_assignment_flag are required fields" 
            });
        }

        // STEP 3: Check asset type assignment_type (non-blocking)
        deptAssignmentLogger.logCheckingAssetTypeAssignment({
            assetId: asset_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const assetModel = require("../models/assetModel");
        const assetTypeResult = await assetModel.getAssetTypeAssignmentType(asset_id);
        
        if (assetTypeResult.rows.length === 0) {
            deptAssignmentLogger.logInvalidAssetForDept({
                assetId: asset_id,
                reason: 'Asset not found or asset type not configured',
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(404).json({ 
                error: "Asset not found or asset type not configured" 
            });
        }

        const assignmentType = assetTypeResult.rows[0].assignment_type;

        // STEP 4: Log asset type validated (non-blocking)
        deptAssignmentLogger.logAssetTypeValidated({
            assetId: asset_id,
            assignmentType: assignmentType,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        // Validate employee_int_id based on assignment_type
        if (assignmentType === "User" && !employee_int_id) {
            deptAssignmentLogger.logInvalidAssetForDept({
                assetId: asset_id,
                reason: 'Asset type requires User assignment but employee_int_id not provided',
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "employee_int_id is required when assignment_type is 'User'" 
            });
        }

        // STEP 5: Check for existing assignment (non-blocking)
        deptAssignmentLogger.logCheckingExistingAssignment({
            assetId: asset_id,
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const existingAssignment = await model.checkAssetAssignmentExists(asset_assign_id);
        if (existingAssignment.rows.length > 0) {
            deptAssignmentLogger.logDuplicateAssignment({
                assetId: asset_id,
                deptId: dept_id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(409).json({ 
                error: "Asset assignment with this asset_assign_id already exists" 
            });
        }

        // STEP 6: No existing assignment - can proceed (non-blocking)
        deptAssignmentLogger.logNoExistingAssignment({
            assetId: asset_id,
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 7: Log assignment ID (non-blocking)
        deptAssignmentLogger.logAssignmentIdGenerated({
            assignmentId: asset_assign_id,
            userId
        }).catch(err => console.error('Logging error:', err));

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

        // STEP 8: Insert to database (non-blocking)
        deptAssignmentLogger.logInsertingAssignmentToDatabase({
            assignmentId: asset_assign_id,
            assetId: asset_id,
            deptId: dept_id,
            orgId: org_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.insertAssetAssignment(assignmentData);

        // STEP 9: Assignment inserted successfully (non-blocking)
        deptAssignmentLogger.logAssignmentInsertedToDatabase({
            assignmentId: asset_assign_id,
            assetId: asset_id,
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 10: Log success (non-blocking)
        deptAssignmentLogger.logDeptAssignmentSuccess({
            assetId: asset_id,
            deptId: dept_id,
            assignmentId: asset_assign_id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(201).json({
            message: "Asset assignment added successfully",
            assignment: result.rows[0],
            assignment_type: assignmentType
        });

    } catch (err) {
        console.error("Error adding asset assignment:", err);
        deptAssignmentLogger.logAssignmentError({
            assetId: req.body?.asset_id,
            deptId: req.body?.dept_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        res.status(500).json({ error: "Internal server error", err });
    }
};

// POST /api/asset-assignments/employee - Add new asset assignment for employee only (no assignment_type check)
const addEmployeeAssetAssignment = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
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

        // STEP 1: Log API called (non-blocking)
        empAssignmentLogger.logAssignmentApiCalled({
            method: req.method,
            url: req.originalUrl,
            assetId: asset_id,
            employeeIntId: employee_int_id,
            deptId: dept_id,
            orgId: org_id,
            userId,
            requestBody: req.body
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Validate required fields (non-blocking)
        empAssignmentLogger.logValidatingParameters({
            assetId: asset_id,
            employeeIntId: employee_int_id,
            deptId: dept_id,
            orgId: org_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        if (!asset_assign_id || !dept_id || !asset_id || !org_id || !employee_int_id || latest_assignment_flag === undefined) {
            empAssignmentLogger.logMissingParameters({
                operation: 'addEmployeeAssetAssignment',
                missingParams: ['asset_assign_id', 'dept_id', 'asset_id', 'org_id', 'employee_int_id', 'latest_assignment_flag'],
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "asset_assign_id, dept_id, asset_id, org_id, employee_int_id, and latest_assignment_flag are required fields" 
            });
        }

        // STEP 3: Check for existing assignment (non-blocking)
        empAssignmentLogger.logCheckingExistingAssignment({
            assetId: asset_id,
            employeeIntId: employee_int_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const existingAssignment = await model.checkAssetAssignmentExists(asset_assign_id);
        if (existingAssignment.rows.length > 0) {
            empAssignmentLogger.logDuplicateAssignment({
                assetId: asset_id,
                employeeIntId: employee_int_id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(409).json({ 
                error: "Asset assignment with this asset_assign_id already exists" 
            });
        }

        // STEP 4: No existing assignment - can proceed (non-blocking)
        empAssignmentLogger.logNoExistingAssignment({
            assetId: asset_id,
            employeeIntId: employee_int_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 5: Log assignment ID (non-blocking)
        empAssignmentLogger.logAssignmentIdGenerated({
            assignmentId: asset_assign_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Prepare assignment data
        const assignmentData = {
            asset_assign_id,
            dept_id,
            asset_id,
            org_id,
            employee_int_id,
            action,
            action_by: created_by,
            latest_assignment_flag
        };

        // STEP 6: Insert to database (non-blocking)
        empAssignmentLogger.logInsertingAssignmentToDatabase({
            assignmentId: asset_assign_id,
            assetId: asset_id,
            employeeIntId: employee_int_id,
            deptId: dept_id,
            orgId: org_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.insertAssetAssignment(assignmentData);

        // STEP 7: Assignment inserted successfully (non-blocking)
        empAssignmentLogger.logAssignmentInsertedToDatabase({
            assignmentId: asset_assign_id,
            assetId: asset_id,
            employeeIntId: employee_int_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 8: Log success (non-blocking)
        empAssignmentLogger.logEmpAssignmentSuccess({
            assetId: asset_id,
            employeeIntId: employee_int_id,
            assignmentId: asset_assign_id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(201).json({
            message: "Employee asset assignment added successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding employee asset assignment:", err);
        empAssignmentLogger.logAssignmentError({
            assetId: req.body?.asset_id,
            employeeIntId: req.body?.employee_int_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
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

// GET /api/asset-assignments/dept/:dept_id - Get asset assignments by department (HISTORY)
const getAssetAssignmentsByDept = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { dept_id } = req.params;

        // STEP 1: Log history API called (non-blocking)
        deptAssignmentLogger.logApiCall({
            operation: 'getDepartmentAssignmentHistory',
            method: req.method,
            url: req.originalUrl,
            requestData: { dept_id },
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Log querying history from database (non-blocking)
        deptAssignmentLogger.logQueryingDeptAssignments({
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.getAssetAssignmentsByDept(dept_id);

        // STEP 3: Log history retrieved (non-blocking)
        deptAssignmentLogger.logAssignmentHistoryViewed({
            deptId: dept_id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by department:", err);
        deptAssignmentLogger.logAssignmentRetrievalError({
            deptId: req.params?.dept_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        res.status(500).json({ error: "Failed to fetch asset assignments by department" });
    }
};

// GET /api/asset-assignments/employee/:employee_id - Get asset assignments by employee (HISTORY)
const getAssetAssignmentsByEmployee = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { employee_id } = req.params;

        // STEP 1: Log history API called (non-blocking)
        empAssignmentLogger.logApiCall({
            operation: 'getEmployeeAssignmentHistory',
            method: req.method,
            url: req.originalUrl,
            requestData: { employee_id },
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Log querying history from database (non-blocking)
        empAssignmentLogger.logQueryingEmpAssignments({
            employeeId: employee_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.getAssetAssignmentsByEmployee(employee_id);

        // STEP 3: Log history retrieved (non-blocking)
        empAssignmentLogger.logAssignmentHistoryViewed({
            employeeIntId: employee_id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset assignments by employee:", err);
        empAssignmentLogger.logAssignmentRetrievalError({
            employeeId: req.params?.employee_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        res.status(500).json({ error: "Failed to fetch asset assignments by employee" });
    }
};

// GET /api/asset-assignments/employee/:employee_id/active - Get active asset assignments by employee
const getActiveAssetAssignmentsByEmployee = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { employee_id } = req.params;

        // STEP 1: Log API called (non-blocking)
        empAssignmentLogger.logEmpSelectionApiCalled({
            method: req.method,
            url: req.originalUrl,
            employeeId: employee_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Log querying database (non-blocking)
        empAssignmentLogger.logQueryingEmpAssignments({
            employeeId: employee_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.getActiveAssetAssignmentsByEmployeeWithDetails(employee_id);
        
        const count = result.assignments.length;
        const message = count > 0 ? `Active AssetAssignment : ${count}` : "No active asset assignments found";
        
        // Check if employee exists
        if (!result.employee) {
            empAssignmentLogger.logInvalidEmployee({
                employeeId: employee_id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            return res.status(404).json({ 
                error: "Employee not found",
                message: "Employee not found",
                count: 0,
                data: [],
                employee: null,
                department: null
            });
        }

        // STEP 3: Log processing data (non-blocking)
        empAssignmentLogger.logProcessingEmpAssignmentData({
            employeeId: employee_id,
            count: count,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 4: Log successful retrieval (non-blocking)
        empAssignmentLogger.logEmpAssignmentsRetrieved({
            employeeId: employee_id,
            count: count,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
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
        empAssignmentLogger.logAssignmentRetrievalError({
            employeeId: req.params?.employee_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
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
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
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
            // Log to both since we don't know which type it is (non-blocking)
            if (employee_int_id) {
                empAssignmentLogger.logInvalidAssetForEmployee({
                    assetId: asset_id,
                    reason: 'Assignment not found',
                    userId,
                    duration: Date.now() - startTime
                }).catch(logErr => console.error('Logging error:', logErr));
            } else {
                deptAssignmentLogger.logInvalidAssetForDept({
                    assetId: asset_id,
                    reason: 'Assignment not found',
                    userId,
                    duration: Date.now() - startTime
                }).catch(logErr => console.error('Logging error:', logErr));
            }
            return res.status(404).json({ error: "Asset assignment not found" });
        }

        // Determine if this is unassignment (action='C') or update
        const isUnassignment = action === 'C';
        const isEmployeeAssignment = employee_int_id || existingAssignment.rows[0].employee_int_id;

        // Log unassignment initiated (non-blocking)
        if (isUnassignment) {
            if (isEmployeeAssignment) {
                empAssignmentLogger.logEmpUnassignmentInitiated({
                    assetId: asset_id || existingAssignment.rows[0].asset_id,
                    employeeIntId: employee_int_id || existingAssignment.rows[0].employee_int_id,
                    assignmentId: id,
                    userId
                }).catch(logErr => console.error('Logging error:', logErr));
            } else {
                deptAssignmentLogger.logDeptUnassignmentInitiated({
                    assetId: asset_id || existingAssignment.rows[0].asset_id,
                    deptId: dept_id || existingAssignment.rows[0].dept_id,
                    assignmentId: id,
                    userId
                }).catch(logErr => console.error('Logging error:', logErr));
            }
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

        // Log success (non-blocking)
        if (isUnassignment) {
            if (isEmployeeAssignment) {
                empAssignmentLogger.logEmpUnassignmentSuccess({
                    assetId: asset_id || existingAssignment.rows[0].asset_id,
                    employeeIntId: employee_int_id || existingAssignment.rows[0].employee_int_id,
                    assignmentId: id,
                    userId,
                    duration: Date.now() - startTime
                }).catch(logErr => console.error('Logging error:', logErr));
            } else {
                deptAssignmentLogger.logDeptUnassignmentSuccess({
                    assetId: asset_id || existingAssignment.rows[0].asset_id,
                    deptId: dept_id || existingAssignment.rows[0].dept_id,
                    assignmentId: id,
                    userId,
                    duration: Date.now() - startTime
                }).catch(logErr => console.error('Logging error:', logErr));
            }
        }

        res.status(200).json({
            message: "Asset assignment updated successfully",
            assignment: result.rows[0]
        });

    } catch (err) {
        console.error("Error updating asset assignment:", err);
        
        // Log error (non-blocking)
        if (req.body?.employee_int_id) {
            empAssignmentLogger.logUnassignmentError({
                assetId: req.body?.asset_id,
                employeeIntId: req.body?.employee_int_id,
                error: err,
                userId,
                duration: Date.now() - startTime
            }).catch(logErr => console.error('Logging error:', logErr));
        } else {
            deptAssignmentLogger.logUnassignmentError({
                assetId: req.body?.asset_id,
                deptId: req.body?.dept_id,
                error: err,
                userId,
                duration: Date.now() - startTime
            }).catch(logErr => console.error('Logging error:', logErr));
        }
        
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
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const org_id = req.user?.org_id;
    const branch_id = req.user?.branch_id;
    
    try {
        const { dept_id } = req.params;

        // STEP 1: Log API called (non-blocking)
        deptAssignmentLogger.logDeptSelectionApiCalled({
            method: req.method,
            url: req.originalUrl,
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 2: Log querying database (non-blocking)
        deptAssignmentLogger.logQueryingDeptAssignments({
            deptId: dept_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.getDepartmentWiseAssetAssignments(dept_id, org_id, branch_id, req.user?.hasSuperAccess || false);
        
        // Check if department exists
        if (!result.department) {
            deptAssignmentLogger.logInvalidDepartment({
                deptId: dept_id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
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
        const employeeCount = result.employees.length;
        
        const message = assetCount > 0 
            ? `Department has ${assetCount} assigned assets and ${employeeCount} employees`
            : `Department has no assigned assets and ${employeeCount} employees`;
        
        // STEP 3: Log processing data (non-blocking)
        deptAssignmentLogger.logProcessingAssignmentData({
            deptId: dept_id,
            count: assetCount,
            userId
        }).catch(err => console.error('Logging error:', err));

        // STEP 4: Log successful retrieval (non-blocking)
        deptAssignmentLogger.logDeptAssignmentsRetrieved({
            deptId: dept_id,
            count: assetCount,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            message: message,
            department: {
                dept_id: result.department.dept_id,
                department_name: result.department.department_name,
                employee_count: employeeCount,
                org_id: result.department.org_id,
                branch_id: result.department.branch_id
            },
            assetCount: assetCount,
            employeeCount: employeeCount,
            assignedAssets: result.assignedAssets,
            employees: result.employees
        });
    } catch (err) {
        console.error("Error fetching department-wise asset assignments:", err);
        deptAssignmentLogger.logAssignmentRetrievalError({
            deptId: req.params?.dept_id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
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

module.exports.addEmployeeAssetAssignment = addEmployeeAssetAssignment;
