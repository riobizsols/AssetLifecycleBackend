const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getCategories,
  createCategory,
  getSpBrands,
  createSpBrand,
  getSpModels,
  createSpModel,
  getCategoryMappings,
  createCategoryMapping,
  getModCatCategories,
  getProdServAssetTypes,
  getProdServBrands,
  getProdServModels,
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
  confirmIssue,
  getAvailableQty,
  getLotCategoriesByVendor,
  getLotBrandsByCategory,
  getLotModelsByCategoryAndBrand,
  getLotPartNumber,
  getSparePartMasters,
  createSparePartMaster,
  getPropertyListValues,
} = require('../controllers/sparePartsController');

router.use(protect);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.get('/brands', getSpBrands);
router.post('/brands', createSpBrand);
router.get('/models', getSpModels);
router.post('/models', createSpModel);

router.get('/category-mappings', getCategoryMappings);
router.post('/category-mappings', createCategoryMapping);
router.get('/category-mappings/by-asset-type/:asset_type_id', getCategoriesByAssetType);
router.get('/mapping-options/categories', getModCatCategories);
router.get('/mapping-options/asset-types', getProdServAssetTypes);
router.get('/mapping-options/asset-brands', getProdServBrands);
router.get('/mapping-options/asset-models', getProdServModels);

router.post('/vendor-mappings', createVendorSpareMappings);

router.get('/lots', getLots);
router.post('/lots', createSparePartLot);
router.get('/lots/:spld_id/individuals', getLotIndividuals);

router.get('/lot-options/categories', getLotCategoriesByVendor);
router.get('/lot-options/brands', getLotBrandsByCategory);
router.get('/lot-options/models', getLotModelsByCategoryAndBrand);
router.get('/lot-options/part-number', getLotPartNumber);

router.get('/property-values/:prop_id', getPropertyListValues);

router.get('/master', getSparePartMasters);
router.post('/master', createSparePartMaster);

router.get('/maintenance-list', getMaintenanceList);
router.get('/maintenance-list/:ams_id', getMaintenanceDetail);

router.post('/issue-requests', createIssueRequests);
router.get('/issue-approvals', getIssueApprovals);
router.get('/issue-approvals/:si_id', getIssueApprovalDetail);
router.post('/issue-approvals/:si_id/approve', approveIssue);
router.post('/maintenance-list/:ams_id/issue', confirmIssue);
router.get('/available-quantity/:spc_id', getAvailableQty);

module.exports = router;
