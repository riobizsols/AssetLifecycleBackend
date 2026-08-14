const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getCategories,
  createCategory,
  getCategoryMappings,
  createCategoryMapping,
  getLots,
  createSparePartLot,
  getLotIndividuals,
  createVendorSpareMappings,
  getMaintenanceList,
  getMaintenanceDetail,
  getCategoriesByAssetType,
  createIssueRequests,
  getIssueApprovals,
  getIssueApprovalDetail,
  approveIssue,
  getAvailableQty,
} = require('../controllers/sparePartsController');

router.use(protect);

router.get('/categories', getCategories);
router.post('/categories', createCategory);

router.get('/category-mappings', getCategoryMappings);
router.post('/category-mappings', createCategoryMapping);
router.get('/category-mappings/by-asset-type/:asset_type_id', getCategoriesByAssetType);

router.post('/vendor-mappings', createVendorSpareMappings);

router.get('/lots', getLots);
router.post('/lots', createSparePartLot);
router.get('/lots/:spld_id/individuals', getLotIndividuals);

router.get('/maintenance-list', getMaintenanceList);
router.get('/maintenance-list/:ams_id', getMaintenanceDetail);

router.post('/issue-requests', createIssueRequests);
router.get('/issue-approvals', getIssueApprovals);
router.get('/issue-approvals/:si_id', getIssueApprovalDetail);
router.post('/issue-approvals/:si_id/approve', approveIssue);
router.get('/available-quantity/:spc_id', getAvailableQty);

module.exports = router;
