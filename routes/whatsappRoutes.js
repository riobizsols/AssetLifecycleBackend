const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const whatsappController = require('../controllers/whatsappController');

router.use(protect);

router.get('/status', whatsappController.getStatus);
router.put('/profile', whatsappController.updateProfile);
router.post('/test', whatsappController.sendTest);
router.get('/messages', whatsappController.listMessages);

module.exports = router;
