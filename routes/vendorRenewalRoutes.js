const express = require('express');
const router = express.Router();
const {
  getVendorRenewals,
  getVendorRenewal,
  getVendorRenewalsByVendor,
  initializeVendorRenewalTable
} = require('../controllers/vendorRenewalController');

// Middleware imports (adjust based on your authentication setup)
// const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/vendor-renewals
 * @desc    Get all vendor renewal records
 * @access  Private
 */
router.get('/', getVendorRenewals);

/**
 * @route   GET /api/vendor-renewals/vendor/:vendorId
 * @desc    Get vendor renewal records by vendor ID
 * @access  Private
 */
router.get('/vendor/:vendorId', getVendorRenewalsByVendor);

/**
 * @route   GET /api/vendor-renewals/:vrId
 * @desc    Get vendor renewal record by ID
 * @access  Private
 */
router.get('/:vrId', getVendorRenewal);

/**
 * @route   POST /api/vendor-renewals/initialize
 * @desc    Initialize vendor renewal table (admin only)
 * @access  Private/Admin
 */
router.post('/initialize', initializeVendorRenewalTable);

module.exports = router;
