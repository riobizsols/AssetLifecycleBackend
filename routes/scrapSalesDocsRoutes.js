const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const authorize = require('../middlewares/authorize');
const {
  uploadScrapSalesDoc,
  listDocsByScrapSale,
  getDownloadUrl,
  archiveDoc,
  deleteDoc,
  getDocById,
  updateDocArchiveStatus
} = require('../controllers/scrapSalesDocsController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Upload document for scrap sales
// POST /api/scrap-sales-docs/upload
// POST /api/scrap-sales-docs/:ssh_id/upload
router.post(['/upload', '/:ssh_id/upload'], authorize(['JR001']), uploadScrapSalesDoc);

// List documents for a scrap sale
// GET /api/scrap-sales-docs/:ssh_id
// GET /api/scrap-sales-docs/:ssh_id?doc_type=invoice
router.get('/:ssh_id', authorize(['JR001']), listDocsByScrapSale);

// Get document details by ID
// GET /api/scrap-sales-docs/document/:ssdoc_id
router.get('/document/:ssdoc_id', authorize(['JR001']), getDocById);

// Get download/view URL for scrap sales document
// GET /api/scrap-sales-docs/:ssdoc_id/download?mode=download
// GET /api/scrap-sales-docs/:ssdoc_id/download?mode=view
router.get('/:ssdoc_id/download', authorize(['JR001']), getDownloadUrl);

// Archive scrap sales document
// PUT /api/scrap-sales-docs/:ssdoc_id/archive
router.put('/:ssdoc_id/archive', authorize(['JR001']), archiveDoc);

// Update scrap sales document archive status
// PUT /api/scrap-sales-docs/:ssdoc_id/archive-status
router.put('/:ssdoc_id/archive-status', authorize(['JR001']), updateDocArchiveStatus);

// Delete scrap sales document
// DELETE /api/scrap-sales-docs/:ssdoc_id
router.delete('/:ssdoc_id', authorize(['JR001']), deleteDoc);

module.exports = router;
