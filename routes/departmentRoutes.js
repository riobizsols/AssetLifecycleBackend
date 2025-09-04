const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const assetAssignmentController = require("../controllers/assetAssignmentController");
const { protect } = require('../middlewares/authMiddleware');


router.use(protect);
router.get("/", departmentController.getAllDepartments);
router.post("/", departmentController.createDepartment);
router.delete("/", departmentController.deleteDepartment);
router.get('/next-id', departmentController.getNextDepartmentId);
router.put("/", departmentController.updateDepartment);

// GET /api/departments/:dept_id/asset-assignments - Get asset assignments by department
router.get("/:dept_id/asset-assignments", assetAssignmentController.getAssetAssignmentsByDept);



module.exports = router;
