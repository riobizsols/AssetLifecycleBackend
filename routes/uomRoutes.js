const express = require('express');
const router = express.Router();
const UOMController = require('../controllers/uomController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all UOM values
router.get('/', UOMController.getAllUOM);

// Get UOM by ID
router.get('/:id', UOMController.getUOMById);

module.exports = router;

