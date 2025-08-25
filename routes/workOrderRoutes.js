const express = require('express');
const router = express.Router();
const {
    getAllWorkOrders,
    getWorkOrderById
} = require('../controllers/workOrderController');
const { protect } = require('../middlewares/authMiddleware');

// Get all work orders (protected)
router.get('/all', protect, getAllWorkOrders);

// Get work order by ID (protected) - This must be last
router.get('/:id', protect, getWorkOrderById);

module.exports = router;
