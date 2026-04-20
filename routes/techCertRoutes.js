const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const techCertController = require('../controllers/techCertController');

router.use(protect);

router.get('/tech-certificates', techCertController.getAllCertificates);
router.post('/tech-certificates', techCertController.createCertificate);
router.put('/tech-certificates/:id', techCertController.updateCertificate);
router.delete('/tech-certificates/:id', techCertController.deleteCertificate);

module.exports = router;
