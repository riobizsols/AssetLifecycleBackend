const express = require('express');
const router = express.Router();
const controller = require('../controllers/deptAdminController');
const { protect } = require('../middlewares/authMiddleware');

// Use auth middleware
router.use(protect);

// Department dropdown
router.get('/departments', controller.fetchDepartments);

// Get dept_id from dept name
router.get('/departments/:name/id', controller.fetchDeptIdByName);

// Admin list by dept_id
router.get('/dept-admins/:dept_id', controller.fetchAdminsForDept);

// Fetch users of department (for assigning as admin)
router.get('/dept-users/:dept_id', controller.fetchUsersForDept);

// Create new admin entry
router.post('/dept-admins', controller.createDeptAdmin);

// Delete admin from department
router.delete('/dept-admins', controller.deleteDeptAdmin);
// GET /admin/dept-admins
router.get('/dept-admins', controller.fetchAllAdmins);


module.exports = router;
