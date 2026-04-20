const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { getSoftwareAssetType } = require('../controllers/orgSettingsController');

router.use(protect);

// GET /api/org-settings/software-asset-type
router.get('/software-asset-type', getSoftwareAssetType);

module.exports = router;

