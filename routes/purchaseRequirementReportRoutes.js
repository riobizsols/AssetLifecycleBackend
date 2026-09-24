const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const controller = require('../controllers/purchaseRequirementReportController');

router.use(protect);

router.get('/options', controller.getOptions);
router.get('/view', controller.viewReport);
router.post('/view', controller.viewReport);
router.post('/export', controller.exportReport);

module.exports = router;
