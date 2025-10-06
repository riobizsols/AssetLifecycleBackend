const express = require('express');
const router = express.Router();
const prodservController = require('../controllers/prodServController');

router.get('/prodserv', prodservController.getAllProdserv);
router.post('/prodserv', prodservController.addProdserv)

// New endpoints for dropdowns
router.get('/brands', prodservController.getBrandsByAssetType);
router.get('/models', prodservController.getModelsByAssetTypeAndBrand);
router.get('/find-by-brand-model', prodservController.findByBrandAndModel);

router.delete('/prodserv/:prod_serv_id', prodservController.deleteProdserv);
router.delete('/prodserv', prodservController.deleteMultipleProdserv);

module.exports = router;
