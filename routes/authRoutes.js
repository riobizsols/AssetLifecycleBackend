const express = require('express');
const router = express.Router();
const {
    login,
    register,
    forgotPassword,
    resetPassword,
    updateOwnPassword
} = require('../controllers/authController');

const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');

// 🟢 Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 🔒 Protected routes
router.post('/register', protect, authorize(['super_admin']), register); // Only super_admin will be allowed (checked in controller)
router.put('/update-password', protect, authorize(['super_admin']), updateOwnPassword); // Super_admin updates their own password

module.exports = router;


