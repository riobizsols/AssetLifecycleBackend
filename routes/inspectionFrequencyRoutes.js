const express = require('express');
const router = express.Router();
const InspectionFrequencyController = require('../controllers/inspectionFrequencyController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', InspectionFrequencyController.getAllInspectionFrequencies);
router.post('/', InspectionFrequencyController.createInspectionFrequency);
router.put('/:id', InspectionFrequencyController.updateInspectionFrequency);
router.delete('/:id', InspectionFrequencyController.deleteInspectionFrequency);

module.exports = router;
