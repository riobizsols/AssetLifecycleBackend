const express = require('express');
const router = express.Router();
const {
    getAllMaintTypes,
    getMaintTypeById,
    addMaintType,
    updateMaintType,
    deleteMaintType
} = require('../controllers/maintTypeController');
const { protect } = require('../middlewares/authMiddleware');

// Get all maintenance types (protected)
router.get('/', protect, getAllMaintTypes);

// Get maintenance type by ID (protected)
router.get('/:id', protect, getMaintTypeById);



module.exports = router; 