const express = require('express');
const router = express.Router();
const costCenterTransferController = require('../controllers/costCenterTransferController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Get all asset types
router.get('/asset-types', costCenterTransferController.getAssetTypes);

// Get assets by asset type
router.get('/assets/:asset_type_id', costCenterTransferController.getAssetsByType);

// Get asset details
router.get('/asset-details/:asset_id', costCenterTransferController.getAssetDetails);

// Get all branches
router.get('/branches', costCenterTransferController.getBranches);

// Get cost centers by branch
router.get('/cost-centers/:branch_id', costCenterTransferController.getCostCentersByBranch);

// Transfer asset to branch and optionally update cost center
router.post('/transfer', costCenterTransferController.transferAsset);

// Get transfer history for a specific asset
router.get('/history/:asset_id', costCenterTransferController.getTransferHistory);

// Get all transfer history with filters
router.get('/history', costCenterTransferController.getAllTransferHistory);

module.exports = router;
