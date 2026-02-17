const express = require('express');
const router = express.Router();
const { fetchAllMappings, getMappedChecklists, updateMapping, removeMappingGroup } = require('../controllers/assetTypeChecklistMappingController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/all', protect, fetchAllMappings);
router.get('/:assetTypeId', protect, getMappedChecklists);
router.post('/', protect, updateMapping);
router.delete('/', protect, removeMappingGroup);

module.exports = router;
