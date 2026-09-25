const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
  uploadVendorDoc,
  listDocs,
  getDownloadUrl,
  streamVendorDocFile,
  archiveDoc,
  deleteDoc,
  getDocById,
  updateDocArchiveStatus
} = require('../controllers/vendorDocsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload document for vendor
// POST /api/vendor-docs/upload
// POST /api/vendor-docs/:vendor_id/upload
router.post(['/upload', '/:vendor_id/upload'], authorize(['JR001']), uploadVendorDoc);

// Stream file (local / MinIO proxy) — before /:vendor_id list
router.get('/:vd_id/file', authorize(['JR001']), streamVendorDocFile);

// Get download/view URL for vendor document
router.get('/:vd_id/download', authorize(['JR001']), getDownloadUrl);

// Get document details by ID
router.get('/document/:vd_id', authorize(['JR001']), getDocById);

// List documents for a vendor
router.get('/:vendor_id', authorize(['JR001']), listDocs);

// Archive vendor document
router.put('/:vd_id/archive', authorize(['JR001']), archiveDoc);

// Update vendor document archive status
router.put('/:vd_id/archive-status', authorize(['JR001']), updateDocArchiveStatus);

// Delete vendor document
router.delete('/:vd_id', authorize(['JR001']), deleteDoc);

module.exports = router;
