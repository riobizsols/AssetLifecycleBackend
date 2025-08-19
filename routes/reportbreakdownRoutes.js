const express = require('express');
const router = express.Router();
const { getReasonCodes } = require('../controllers/reportbreakdownController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/reason-codes', protect, getReasonCodes);

module.exports = router;


