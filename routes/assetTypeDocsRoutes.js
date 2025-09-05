const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  uploadAssetTypeDoc,
  listDocs,
  getDownloadUrl,
  updateDocArchiveStatus,
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
router.post(['/upload', '/:asset_type_id/upload'], uploadAssetTypeDoc);

// List documents for an asset type
// GET /api/asset-type-docs/:asset_type_id
// GET /api/asset-type-docs/:asset_type_id?dto_id=DTO001
router.get('/:asset_type_id', listDocs);

// Get document details by ID
// GET /api/asset-type-docs/document/:atd_id
router.get('/document/:atd_id', getDocById);

// Get download/view URL for asset type document
// GET /api/asset-type-docs/:atd_id/download?mode=download
// GET /api/asset-type-docs/:atd_id/download?mode=view
// GET /api/asset-type-docs/asset-type/:asset_type_id/download?mode=download
// GET /api/asset-type-docs/asset-type/:asset_type_id/download?mode=view
router.get(['/:atd_id/download', '/asset-type/:asset_type_id/download'], getDownloadUrl);

// Update asset type document archive status
// PUT /api/asset-type-docs/:atd_id/archive-status
router.put('/:atd_id/archive-status', updateDocArchiveStatus);

// Archive asset type document
// PUT /api/asset-type-docs/:atd_id/archive
router.put('/:atd_id/archive', archiveDoc);

// Delete asset type document
// DELETE /api/asset-type-docs/:atd_id
router.delete('/:atd_id', deleteDoc);

module.exports = router;
