const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const auditReportController = require('../controllers/auditReportController');

router.use(protect);

// GET /api/audit-report/audit-types
router.get('/audit-types', auditReportController.getAuditTypes);

// GET /api/audit-report/asset-types/:audtpId
router.get('/asset-types/:audtpId', auditReportController.getMappedAssetTypes);

// GET|POST /api/audit-report/view
router.get('/view', auditReportController.viewAuditReport);
router.post('/view', auditReportController.viewAuditReport);

// GET|POST /api/audit-report/pm-compliance
router.get('/pm-compliance', auditReportController.getPmCompliance);
router.post('/pm-compliance', auditReportController.getPmCompliance);

// GET|POST /api/audit-report/calibration-detail
router.get('/calibration-detail', auditReportController.getCalibrationDetail);
router.post('/calibration-detail', auditReportController.getCalibrationDetail);
router.get('/calibration-detail/:amsId', auditReportController.getCalibrationDetail);

module.exports = router;
