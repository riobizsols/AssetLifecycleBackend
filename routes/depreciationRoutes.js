const express = require('express');
const router = express.Router();
const DepreciationController = require('../controllers/depreciationController');

/**
 * Depreciation Routes
 * All routes are prefixed with /api/depreciation
 */

// Calculate depreciation for a single asset
router.post('/calculate/:asset_id', DepreciationController.calculateAssetDepreciation);

// Calculate depreciation for multiple assets
router.post('/calculate-bulk', DepreciationController.calculateBulkDepreciation);

// Get depreciation history for an asset
router.get('/history/:asset_id', DepreciationController.getAssetDepreciationHistory);

// Get depreciation summary for an organization
router.get('/summary/:org_id', DepreciationController.getDepreciationSummary);

// Get assets by depreciation method
router.get('/assets/:org_id/:method', DepreciationController.getAssetsByDepreciationMethod);

// Get depreciation settings for an organization
router.get('/settings/:org_id', DepreciationController.getDepreciationSettings);

// Update depreciation settings
router.put('/settings/:setting_id', DepreciationController.updateDepreciationSettings);

// Generate depreciation schedule for an asset
router.post('/schedule/:asset_id', DepreciationController.generateDepreciationSchedule);

// Get assets eligible for depreciation
router.get('/eligible-assets/:org_id', async (req, res) => {
    try {
        const { org_id } = req.params;
        const DepreciationModel = require('../models/depreciationModel');
        const assetsResult = await DepreciationModel.getAssetsForDepreciation(org_id);
        
        res.status(200).json({
            org_id: org_id,
            assets: assetsResult.rows,
            total_assets: assetsResult.rows.length
        });
    } catch (error) {
        console.error('Error getting eligible assets:', error);
        res.status(500).json({
            error: 'Failed to get eligible assets',
            message: error.message
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Depreciation service is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
