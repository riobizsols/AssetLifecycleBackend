const express = require('express');
const router = express.Router();
const AssetSerialPrintController = require('../controllers/assetSerialPrintController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Add serial number to print queue
router.post('/', AssetSerialPrintController.addToPrintQueue);

// Get all serial numbers in print queue
router.get('/', AssetSerialPrintController.getAllPrintQueue);

// Get print queue by status
router.get('/status/:status', AssetSerialPrintController.getPrintQueueByStatus);

// Get print queue item by ID
router.get('/:psnqId', AssetSerialPrintController.getPrintQueueById);

// Update print status
router.put('/:psnqId/status', AssetSerialPrintController.updatePrintStatus);

// Delete from print queue
router.delete('/:psnqId', AssetSerialPrintController.deleteFromPrintQueue);

module.exports = router;
