const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const consolidatedAssetRegisterController = require('../controllers/consolidatedAssetRegisterController');

router.use(protect);

// GET /api/consolidated-asset-register/filter-options
router.get('/filter-options', consolidatedAssetRegisterController.getFilterOptions);

// GET /api/consolidated-asset-register/summary
router.get('/summary', consolidatedAssetRegisterController.getSummary);

// GET /api/consolidated-asset-register/register
router.get('/register', consolidatedAssetRegisterController.getRegister);

// GET /api/consolidated-asset-register/register/export
router.get('/register/export', consolidatedAssetRegisterController.getRegisterExport);

module.exports = router;
