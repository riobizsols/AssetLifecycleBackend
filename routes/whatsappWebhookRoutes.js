const express = require('express');
const router = express.Router();
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

router.get('/', whatsappWebhookController.verify);
router.post('/', whatsappWebhookController.receive);

module.exports = router;
