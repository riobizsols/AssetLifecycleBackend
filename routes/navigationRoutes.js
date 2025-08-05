const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
    getUserNavigationData,
    getJobRoleNavigation,
    getAllNavigation,
    createNavigation,
    updateNavigation,
    deleteNavigation,
    getUserJobRoleData,
    assignJobRole,
    getAllUsersJobRoles
} = require('../controllers/navigationController');

const router = express.Router();

// User routes (require authentication)
router.get('/user/navigation', protect, getUserNavigationData);
router.get('/user/job-role', protect, getUserJobRoleData);

// Admin routes (require authentication and admin role)
router.get('/job-role/:job_role_id/navigation', protect, authorize(['JR001']), getJobRoleNavigation);
router.get('/all-navigation', protect, authorize(['JR001']), getAllNavigation);
router.post('/navigation', protect, authorize(['JR001']), createNavigation);
router.put('/navigation/:id', protect, authorize(['JR001']), updateNavigation);
router.delete('/navigation/:id', protect, authorize(['JR001']), deleteNavigation);

// User management routes (admin only)
router.get('/users/job-roles', protect, authorize(['JR001']), getAllUsersJobRoles);
router.post('/users/assign-job-role', protect, authorize(['JR001']), assignJobRole);

module.exports = router; 