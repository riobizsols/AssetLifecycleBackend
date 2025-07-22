const express = require("express");
const router = express.Router();
const controller = require("../controllers/assetAssignmentController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// POST /api/asset-assignments - Add new asset assignment
router.post("/", controller.addAssetAssignment);

// GET /api/asset-assignments - Get all asset assignments
router.get("/", controller.getAllAssetAssignments);

// GET /api/asset-assignments/:id - Get asset assignment by ID
router.get("/:id", controller.getAssetAssignmentById);

// GET /api/asset-assignments/details/:id - Get asset assignment with detailed information
router.get("/details/:id", controller.getAssetAssignmentWithDetails);

// GET /api/asset-assignments/dept/:dept_id - Get asset assignments by department
router.get("/dept/:dept_id", controller.getAssetAssignmentsByDept);

// GET /api/asset-assignments/employee/:employee_id - Get asset assignments by employee
router.get("/employee/:employee_id", controller.getAssetAssignmentsByEmployee);

// GET /api/asset-assignments/asset/:asset_id - Get asset assignments by asset
router.get("/asset/:asset_id", controller.getAssetAssignmentsByAsset);

// GET /api/asset-assignments/status/:status - Get asset assignments by status
router.get("/status/:status", controller.getAssetAssignmentsByStatus);

// GET /api/asset-assignments/org/:org_id - Get asset assignments by organization
router.get("/org/:org_id", controller.getAssetAssignmentsByOrg);

// PUT /api/asset-assignments/:id - Update asset assignment
router.put("/:id", controller.updateAssetAssignment);

// DELETE /api/asset-assignments/:id - Delete single asset assignment
router.delete("/:id", controller.deleteAssetAssignment);

// DELETE /api/asset-assignments - Delete multiple asset assignments
router.delete("/", controller.deleteMultipleAssetAssignments);

module.exports = router;
