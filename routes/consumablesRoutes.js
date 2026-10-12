const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/consumablesController');

router.use(protect);

router.get('/lookups', ctrl.getLookups);
router.get('/alerts', ctrl.listStockAlerts);
router.get('/report/options', ctrl.getReportOptions);
router.get('/report', ctrl.getReport);

router.get('/items', ctrl.listConsumables);
router.post('/items', ctrl.createConsumable);
router.put('/items/:consumId', ctrl.updateConsumable);
router.delete('/items/:consumId', ctrl.deleteConsumable);

router.get('/inventory', ctrl.listInventory);
router.post('/inventory', ctrl.createInventory);
router.get('/inventory/:cinvenId/history', ctrl.getInventoryHistory);
router.put('/inventory/:cinvenId', ctrl.updateInventory);
router.delete('/inventory/:cinvenId', ctrl.deleteInventory);

router.get('/usage', ctrl.listUsage);
router.post('/usage', ctrl.createUsage);
router.put('/usage/:cusageId', ctrl.updateUsage);
router.delete('/usage/:cusageId', ctrl.deleteUsage);

module.exports = router;
