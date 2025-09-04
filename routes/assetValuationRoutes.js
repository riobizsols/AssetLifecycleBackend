const express = require('express');
const router = express.Router();
const AssetValuationController = require('../controllers/assetValuationController');
const { protect } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(protect);

// Asset valuation endpoints
router.get('/', AssetValuationController.getAssetValuationData);
router.get('/summary', AssetValuationController.getAssetValuationSummary);
router.get('/filter-options', AssetValuationController.getFilterOptions);

// Export endpoints
router.get('/export/excel', AssetValuationController.exportToExcel);
router.get('/export/csv', AssetValuationController.exportToCSV);
router.get('/export/json', AssetValuationController.exportToJSON);

module.exports = router;
