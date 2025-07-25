const express = require("express");
const router = express.Router();
const controller = require("../controllers/assetAssignmentController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// POST /api/asset-assignments - Add new asset assignment
router.post("/", controller.addAssetAssignment);  //....

// POST /api/asset-assignments/employee - Add asset assignment for employee only
router.post('/employee', controller.addEmployeeAssetAssignment);

// GET /api/asset-assignments - Get all asset assignments
router.get("/", controller.getAllAssetAssignments);

// GET /api/asset-assignments/:id - Get asset assignment by ID
router.get("/:id", controller.getAssetAssignmentById);

// GET /api/asset-assignments/details/:id - Get asset assignment with detailed information
router.get("/details/:id", controller.getAssetAssignmentWithDetails);

// GET /api/asset-assignments/dept/:dept_id - Get asset assignments by department
router.get("/dept/:dept_id", controller.getAssetAssignmentsByDept);

// GET /api/asset-assignments/employee/:employee_id - Get asset assignments History by employee
router.get("/employee-history/:employee_id", controller.getAssetAssignmentsByEmployee);

// GET /api/asset-assignments/employee/:employee_id/active - Get active asset assignments by employee
router.get("/employee/:employee_id/active", controller.getActiveAssetAssignmentsByEmployee); //.....

// GET /api/asset-assignments/asset/:asset_id - Get asset assignments by asset
router.get("/asset/:asset_id", controller.getAssetAssignmentsByAsset);

// GET /api/asset-assignments/action/:action - Get asset assignments by action
router.get("/action/:action", controller.getAssetAssignmentsByStatus);

// GET /api/asset-assignments/org/:org_id - Get asset assignments by organization
router.get("/org/:org_id", controller.getAssetAssignmentsByOrg);

// GET /api/asset-assignments/department/:dept_id/assignments - Get department-wise asset assignments
router.get("/department/:dept_id/assignments", controller.getDepartmentWiseAssetAssignments);

// PUT /api/asset-assignments/:id - Update asset assignment
router.put("/:id", controller.updateAssetAssignment);

// PUT /api/asset-assignments/asset/:asset_id - Update asset assignment by asset_id (only for action="A" and latest_assignment_flag=true)
router.put("/asset/:asset_id", controller.updateAssetAssignmentByAssetId);

// DELETE /api/asset-assignments/:id - Delete single asset assignment
router.delete("/:id", controller.deleteAssetAssignment);

// DELETE /api/asset-assignments - Delete multiple asset assignments
router.delete("/", controller.deleteMultipleAssetAssignments);

module.exports = router;
