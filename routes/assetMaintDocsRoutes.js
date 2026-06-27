const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
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

// Upload document for asset maintenance (authenticated users — same as maintenance-schedules)
// POST /api/asset-maint-docs/upload
// POST /api/asset-maint-docs/:asset_id/upload
router.post(['/upload', '/:asset_id/upload'], uploadAssetMaintDoc);

// List documents for an asset
// GET /api/asset-maint-docs/asset/:asset_id
router.get('/asset/:asset_id', listDocsByAsset);

// List documents for a work order
// GET /api/asset-maint-docs/work-order/:ams_id
router.get('/work-order/:ams_id', listDocsByWorkOrder);

// Get document details by ID
router.get('/document/:amd_id', getDocById);

// Get download/view URL for asset maintenance document
router.get('/:amd_id/download', getDownloadUrl);

// Archive asset maintenance document
router.put('/:amd_id/archive', archiveDoc);

// Update asset maintenance document archive status
router.put('/:amd_id/archive-status', updateDocArchiveStatus);

// Delete asset maintenance document
router.delete('/:amd_id', deleteDoc);

module.exports = router;
