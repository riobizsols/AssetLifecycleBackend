const express = require('express');
const router = express.Router();
const { getReasonCodes, getAllReports } = require('../controllers/reportbreakdownController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/reason-codes', protect, getReasonCodes);
router.get('/reports', protect, getAllReports);

module.exports = router;


