const express = require('express');
const router = express.Router();
const {
    login,
    tenantLogin,
    register,
    forgotPassword,
    resetPassword,
    refreshToken,
    updateOwnPassword,
    changePassword
} = require('../controllers/authController');

const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

// 🟢 Public routes
router.post('/login', login); // Original login (uses default database)
router.post('/tenant-login', tenantLogin); // Multi-tenant login (requires org_id)
router.post('/refresh', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 🔒 Protected routes
router.post('/register', protect, authorize(['super_admin']), register); // Only super_admin will be allowed (checked in controller)
router.put('/update-password', protect, authorize(['super_admin']), updateOwnPassword); // Super_admin updates their own password
router.put('/change-password', protect, changePassword); // Authenticated users can change their password

module.exports = router;


