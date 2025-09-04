const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  uploadAssetGroupDoc,
  listDocs,
  getDownloadUrl,
  archiveDoc,
  deleteDoc,
  getDocById
} = require('../controllers/assetGroupDocsController');

// Apply protect middleware to all routes
router.use(protect);

// Upload document for asset group
// POST /api/asset-group-docs/upload
// POST /api/asset-group-docs/:asset_group_id/upload
router.post('/upload', uploadAssetGroupDoc);
router.post('/:asset_group_id/upload', uploadAssetGroupDoc);

// List documents for an asset group
// GET /api/asset-group-docs/:asset_group_id
// GET /api/asset-group-docs/:asset_group_id?doc_type=invoice
router.get('/:asset_group_id', listDocs);

// Get document details by ID
// GET /api/asset-group-docs/document/:agd_id
router.get('/document/:agd_id', getDocById);

// Get download/view URL for document
// GET /api/asset-group-docs/:agd_id/download?mode=download
// GET /api/asset-group-docs/:agd_id/download?mode=view
router.get('/:agd_id/download', getDownloadUrl);

// Archive document
// PUT /api/asset-group-docs/:agd_id/archive
router.put('/:agd_id/archive', archiveDoc);

// Delete document
// DELETE /api/asset-group-docs/:agd_id
router.delete('/:agd_id', deleteDoc);

module.exports = router;
