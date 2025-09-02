const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
  uploadAssetTypeDoc,
  listDocs,
  getDownloadUrl,
  archiveDoc,
  deleteDoc,
  getDocById
} = require('../controllers/assetTypeDocsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload document for asset type
// POST /api/asset-type-docs/upload
// POST /api/asset-type-docs/:asset_type_id/upload
router.post(['/upload', '/:asset_type_id/upload'], authorize(['JR001']), uploadAssetTypeDoc);

// List documents for an asset type
// GET /api/asset-type-docs/:asset_type_id
// GET /api/asset-type-docs/:asset_type_id?doc_type=invoice
router.get('/:asset_type_id', authorize(['JR001']), listDocs);

// Get document details by ID
// GET /api/asset-type-docs/document/:atd_id
router.get('/document/:atd_id', authorize(['JR001']), getDocById);

// Get download/view URL for asset type document
// GET /api/asset-type-docs/:atd_id/download?mode=download
// GET /api/asset-type-docs/:atd_id/download?mode=view
router.get('/:atd_id/download', authorize(['JR001']), getDownloadUrl);

// Archive asset type document
// PUT /api/asset-type-docs/:atd_id/archive
router.put('/:atd_id/archive', authorize(['JR001']), archiveDoc);

// Delete asset type document
// DELETE /api/asset-type-docs/:atd_id
router.delete('/:atd_id', authorize(['JR001']), deleteDoc);

module.exports = router;
