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

// GET|POST /api/audit-report/coverage — AMC / CMC / warranty expiry
router.get('/coverage', auditReportController.viewCoverageExpiryReport);
router.post('/coverage', auditReportController.viewCoverageExpiryReport);

// GET /api/audit-report/asset/:assetId/vendor-renewals
router.get('/asset/:assetId/vendor-renewals', auditReportController.viewAssetVendorRenewals);

module.exports = router;
