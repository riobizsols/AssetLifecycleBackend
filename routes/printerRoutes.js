const express = require('express');
const router = express.Router();
const PrinterController = require('../controllers/printerController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/printers - Get all printers
router.get('/', PrinterController.getAllPrinters);

// GET /api/printers/active - Get active printers
router.get('/active', PrinterController.getActivePrinters);

// GET /api/printers/stats - Get printer statistics
router.get('/stats', PrinterController.getPrinterStats);

// GET /api/printers/type/:printerType - Get printers by type
router.get('/type/:printerType', PrinterController.getPrintersByType);

// GET /api/printers/:printerId - Get printer by ID
router.get('/:printerId', PrinterController.getPrinterById);

// POST /api/printers - Create new printer
router.post('/', PrinterController.createPrinter);

// PUT /api/printers/:printerId - Update printer
router.put('/:printerId', PrinterController.updatePrinter);

// DELETE /api/printers/:printerId - Delete printer
router.delete('/:printerId', PrinterController.deletePrinter);

module.exports = router;
