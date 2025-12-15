const express = require('express');
const router = express.Router();
const BreakdownReasonCodesController = require('../controllers/breakdownReasonCodesController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all breakdown reason codes
router.get('/', BreakdownReasonCodesController.getAllReasonCodes);

// Get breakdown reason codes by asset type
router.get('/asset-type/:assetTypeId', BreakdownReasonCodesController.getReasonCodesByAssetType);

// Create a new breakdown reason code
router.post('/', BreakdownReasonCodesController.createReasonCode);

// Update breakdown reason code
router.put('/:id', BreakdownReasonCodesController.updateReasonCode);

// Delete breakdown reason code
router.delete('/:id', BreakdownReasonCodesController.deleteReasonCode);

module.exports = router;

