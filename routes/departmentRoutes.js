const express = require("express");
const router = express.Router();
const departmentController = require("../controllers/departmentController");
const { protect } = require('../middlewares/authMiddleware');


router.use(protect);
router.get("/departments", departmentController.getAllDepartments);
router.post("/departments", departmentController.createDepartment);
router.delete("/departments", departmentController.deleteDepartment);
router.get('/departments/next-id', departmentController.getNextDepartmentId);
router.put("/departments", departmentController.updateDepartment);



module.exports = router;
