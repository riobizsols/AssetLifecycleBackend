const express = require('express');
const router = express.Router();
const prodservController = require('../controllers/prodServController');

router.get('/prodserv', prodservController.getAllProdserv);
router.post('/prodserv', prodservController.addProdserv)


module.exports = router;
