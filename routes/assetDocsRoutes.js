const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { uploadAssetDoc, listDocs, getDownloadUrl, updateDocArchiveStatus } = require('../controllers/assetDocsController');

// Apply authentication to all routes
router.use(protect);

router.post('/assets/:asset_id/docs/upload', (req, res, next) => {
  req.body = req.body || {};
  req.body.asset_id = req.params.asset_id;
  next();
}, uploadAssetDoc);

router.get('/assets/:asset_id/docs', listDocs);
router.get('/asset-docs/:a_d_id/download-url', getDownloadUrl);
router.put('/asset-docs/:a_d_id/archive-status', updateDocArchiveStatus);

module.exports = router;  


