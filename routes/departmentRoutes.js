const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const assetAssignmentController = require("../controllers/assetAssignmentController");
const { protect } = require('../middlewares/authMiddleware');


router.use(protect);
router.get("/departments", departmentController.getAllDepartments);
router.post("/departments", departmentController.createDepartment);
router.delete("/departments", departmentController.deleteDepartment);
router.get('/departments/next-id', departmentController.getNextDepartmentId);
router.put("/departments", departmentController.updateDepartment);

// GET /api/departments/:dept_id/asset-assignments - Get asset assignments by department
router.get("/departments/:dept_id/asset-assignments", assetAssignmentController.getAssetAssignmentsByDept);



module.exports = router;
