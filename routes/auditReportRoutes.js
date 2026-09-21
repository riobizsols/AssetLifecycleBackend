const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const auditReportController = require('../controllers/auditReportController');

router.use(protect);

// Audit types
router.get('/audit-types', auditReportController.getAuditTypes);
router.post('/audit-types', auditReportController.createAuditType);
router.put('/audit-types/:audtpId', auditReportController.updateAuditType);

// Asset types + mappings
router.get('/all-asset-types', auditReportController.getAllAssetTypes);
router.get('/asset-types/:audtpId', auditReportController.getMappedAssetTypes);
router.put('/mappings/:audtpId', auditReportController.saveMappings);

// Report view
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
