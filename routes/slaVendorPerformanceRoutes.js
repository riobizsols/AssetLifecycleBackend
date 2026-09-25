const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/slaVendorPerformanceController');

router.use(protect);

router.get('/filter-options', ctrl.getFilterOptions);
router.get('/summary', ctrl.getSummary);
router.get('/trends', ctrl.getTrends);
router.get('/breaches', ctrl.getBreaches);
router.get('/vendors', ctrl.getVendors);
router.get('/vendors/:vendorId', ctrl.getVendorDetail);
router.get('/repeat-failures', ctrl.getRepeatFailures);
router.get('/service-quality', ctrl.getServiceQuality);
router.get('/details', ctrl.getDetails);

module.exports = router;
