const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/opcController');

router.use(protect);

router.get('/lookups', ctrl.getLookups);
router.get('/assets', ctrl.listAssets);

router.get('/components', ctrl.listComponents);
router.get('/components/assets', ctrl.listAssetsWithComponents);
router.post('/components', ctrl.createComponent);
router.put('/components/:compId', ctrl.updateComponent);
router.delete('/components/:compId', ctrl.deleteComponent);

router.get('/servers', ctrl.listServers);
router.get('/servers/:serverId/browsed-tags', ctrl.listBrowsedTags);
router.post('/servers/:serverId/browsed-tags', ctrl.uploadBrowsedTags);
router.get('/servers/:serverId/cbm-tags', ctrl.listCbmTags);
router.post('/servers/:serverId/readings', ctrl.postReadings);

router.get('/tags', ctrl.listTags);

router.get('/comp-tags', ctrl.listCompTags);
router.post('/comp-tags', ctrl.createCompTag);
router.delete('/comp-tags/:ctId', ctrl.deleteCompTag);

router.get('/cbm', ctrl.listCbmRules);
router.post('/cbm', ctrl.createCbmRule);
router.put('/cbm/:cbmId', ctrl.updateCbmRule);
router.delete('/cbm/:cbmId', ctrl.deleteCbmRule);

module.exports = router;
