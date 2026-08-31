const express = require('express');
const router = express.Router();
const acmController = require('../controllers/acmController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/me', acmController.getMyAcmScope);
router.get('/rows', acmController.getMyAcmRows);
router.get('/options', acmController.getAcmOptions);

module.exports = router;
