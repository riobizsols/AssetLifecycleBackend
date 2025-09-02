const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
  uploadVendorDoc,
  listDocs,
  getDownloadUrl,
  archiveDoc,
  deleteDoc,
  getDocById
} = require('../controllers/vendorDocsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload document for vendor
// POST /api/vendor-docs/upload
// POST /api/vendor-docs/:vendor_id/upload
router.post(['/upload', '/:vendor_id/upload'], authorize(['JR001']), uploadVendorDoc);

// List documents for a vendor
// GET /api/vendor-docs/:vendor_id
// GET /api/vendor-docs/:vendor_id?doc_type=invoice
router.get('/:vendor_id', authorize(['JR001']), listDocs);

// Get document details by ID
// GET /api/vendor-docs/document/:vd_id
router.get('/document/:vd_id', authorize(['JR001']), getDocById);

// Get download/view URL for vendor document
// GET /api/vendor-docs/:vd_id/download?mode=download
// GET /api/vendor-docs/:vd_id/download?mode=view
router.get('/:vd_id/download', authorize(['JR001']), getDownloadUrl);

// Archive vendor document
// PUT /api/vendor-docs/:vd_id/archive
router.put('/:vd_id/archive', authorize(['JR001']), archiveDoc);

// Delete vendor document
// DELETE /api/vendor-docs/:vd_id
router.delete('/:vd_id', authorize(['JR001']), deleteDoc);

module.exports = router;
