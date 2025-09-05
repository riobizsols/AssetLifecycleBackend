const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
  uploadAssetMaintDoc,
  listDocsByAsset,
  listDocsByWorkOrder,
  getDownloadUrl,
  archiveDoc,
  deleteDoc,
  getDocById,
  updateDocArchiveStatus
} = require('../controllers/assetMaintDocsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload document for asset maintenance
// POST /api/asset-maint-docs/upload
// POST /api/asset-maint-docs/:asset_id/upload
router.post(['/upload', '/:asset_id/upload'], authorize(['JR001']), uploadAssetMaintDoc);

// List documents for an asset
// GET /api/asset-maint-docs/asset/:asset_id
// GET /api/asset-maint-docs/asset/:asset_id?doc_type=qa_report
router.get('/asset/:asset_id', authorize(['JR001']), listDocsByAsset);

// List documents for a work order
// GET /api/asset-maint-docs/work-order/:ams_id
// GET /api/asset-maint-docs/work-order/:ams_id?doc_type=qa_report
router.get('/work-order/:ams_id', authorize(['JR001']), listDocsByWorkOrder);

// Get document details by ID
// GET /api/asset-maint-docs/document/:amd_id
router.get('/document/:amd_id', authorize(['JR001']), getDocById);

// Get download/view URL for asset maintenance document
// GET /api/asset-maint-docs/:amd_id/download?mode=download
// GET /api/asset-maint-docs/:amd_id/download?mode=view
router.get('/:amd_id/download', authorize(['JR001']), getDownloadUrl);

// Archive asset maintenance document
// PUT /api/asset-maint-docs/:amd_id/archive
router.put('/:amd_id/archive', authorize(['JR001']), archiveDoc);

// Update asset maintenance document archive status
// PUT /api/asset-maint-docs/:amd_id/archive-status
router.put('/:amd_id/archive-status', authorize(['JR001']), updateDocArchiveStatus);

// Delete asset maintenance document
// DELETE /api/asset-maint-docs/:amd_id
router.delete('/:amd_id', authorize(['JR001']), deleteDoc);

module.exports = router;
