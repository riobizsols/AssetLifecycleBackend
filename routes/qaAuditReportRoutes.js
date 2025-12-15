                                                                              const express = require('express');
const router = express.Router();
const {
  getCertificates,
  downloadCertificate,
  getFilterOptions
} = require('../controllers/qaAuditReportController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get QA/Audit certificates based on filters
router.post('/certificates', getCertificates);

// Download certificate
router.get('/certificates/:id/download', downloadCertificate);

// Get filter options (properties and values) for asset type
router.get('/filter-options/:assetTypeId', getFilterOptions);

module.exports = router;

