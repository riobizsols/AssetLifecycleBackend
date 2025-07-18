const express = require('express');
const router = express.Router();
const prodservController = require('../controllers/prodServController');

router.get('/prodserv', prodservController.getAllProdserv);
router.post('/prodserv', prodservController.addProdserv)

// New endpoints for dropdowns
router.get('/brands', prodservController.getBrandsByAssetType);
router.get('/models', prodservController.getModelsByAssetTypeAndBrand);


module.exports = router;
