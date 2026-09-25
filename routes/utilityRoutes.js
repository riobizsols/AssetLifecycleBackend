const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/utilityController');

router.use(protect);

router.get('/lookups', ctrl.getLookups);

router.get('/headers', ctrl.listHeaders);
router.get('/headers/:utilId', ctrl.getHeader);
router.post('/headers', ctrl.createHeader);
router.put('/headers/:utilId', ctrl.updateHeader);
router.delete('/headers/:utilId', ctrl.deleteHeader);

router.get('/details', ctrl.listDetails);
router.post('/details', ctrl.createDetail);
router.put('/details/:utildId', ctrl.updateDetail);
router.delete('/details/:utildId', ctrl.deleteDetail);

router.get('/asset-types', ctrl.listAssetTypes);
router.get('/mappings', ctrl.listMappings);
router.post('/mappings', ctrl.createMapping);
router.delete('/mappings/:atumId', ctrl.deleteMapping);

router.get('/consumptions', ctrl.listConsumptions);
router.post('/consumptions/preview', ctrl.previewConsumption);
router.post('/consumptions', ctrl.createConsumption);

// Mobile — assigned-asset utility readings (bus km / meter start–end)
router.get('/mobile/my-assets', ctrl.listMyAssignedUtilityAssets);
router.get('/mobile/assets/:assetId/consumptions', ctrl.listMyAssetConsumptions);
router.post('/mobile/consumptions', ctrl.createAssetConsumption);

module.exports = router;
