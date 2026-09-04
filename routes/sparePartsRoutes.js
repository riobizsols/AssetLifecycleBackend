const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getCategories,
  createCategory,
  getCategoryById,
  updateCategory,
  getSpBrands,
  createSpBrand,
  getSpModels,
  createSpModel,
  getCategoryMappings,
  createCategoryMapping,
  saveCategoryMappingsBulk,
  getModCatCategories,
  getProdServAssetTypes,
  getProdServBrands,
  getProdServModels,
  getIspModels,
  getLots,
  getLotById,
  createSparePartLot,
  updateSparePartLot,
  getLotIndividuals,
  getVendorSpareMappings,
  createVendorSpareMappings,
  getMaintenanceList,
  getMaintenanceDetail,
  getRequiredSpareCategories,
  getCategoriesByAssetType,
  createIssueRequests,
  getIssueApprovals,
  getIssueApprovalDetail,
  approveIssue,
  confirmIssue,
  getAvailableQty,
  getLotVendors,
  getLotCategoriesByVendor,
  getLotBrandsByCategory,
  getLotModelsByCategoryAndBrand,
  getLotPartNumber,
  getSparePartMasters,
  createSparePartMaster,
  getSparePartMasterByPartNumber,
  updateSparePartMaster,
  getPropertyListValues,
} = require('../controllers/sparePartsController');

router.use(protect);

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.get('/categories/:spc_id', getCategoryById);
router.put('/categories/:spc_id', updateCategory);
router.get('/brands', getSpBrands);
router.post('/brands', createSpBrand);
router.get('/models', getSpModels);
router.post('/models', createSpModel);

router.get('/category-mappings', getCategoryMappings);
router.post('/category-mappings', createCategoryMapping);
router.post('/category-mappings/bulk', saveCategoryMappingsBulk);
router.get('/isp-models', getIspModels);
router.get('/category-mappings/by-asset-type/:asset_type_id', getCategoriesByAssetType);
router.get('/mapping-options/categories', getModCatCategories);
router.get('/mapping-options/asset-types', getProdServAssetTypes);
router.get('/mapping-options/asset-brands', getProdServBrands);
router.get('/mapping-options/asset-models', getProdServModels);

router.get('/vendor-mappings', getVendorSpareMappings);
router.post('/vendor-mappings', createVendorSpareMappings);

router.get('/lots', getLots);
router.post('/lots', createSparePartLot);
router.get('/lots/:spld_id/individuals', getLotIndividuals);
router.get('/lots/:spld_id', getLotById);
router.put('/lots/:spld_id', updateSparePartLot);

router.get('/lot-options/vendors', getLotVendors);
router.get('/lot-options/categories', getLotCategoriesByVendor);
router.get('/lot-options/brands', getLotBrandsByCategory);
router.get('/lot-options/models', getLotModelsByCategoryAndBrand);
router.get('/lot-options/part-number', getLotPartNumber);

router.get('/property-values/:prop_id', getPropertyListValues);

router.get('/master', getSparePartMasters);
router.post('/master', createSparePartMaster);
router.get('/master/:partNumber', getSparePartMasterByPartNumber);
router.put('/master/:partNumber', updateSparePartMaster);

router.get('/maintenance-list', getMaintenanceList);
router.get('/maintenance-list/:ams_id/required-categories', getRequiredSpareCategories);
router.get('/maintenance-list/:ams_id', getMaintenanceDetail);

router.post('/issue-requests', createIssueRequests);
router.get('/issue-approvals', getIssueApprovals);
router.get('/issue-approvals/:si_id', getIssueApprovalDetail);
router.post('/issue-approvals/:si_id/approve', approveIssue);
router.post('/maintenance-list/:ams_id/issue', confirmIssue);
router.get('/available-quantity/:spc_id', getAvailableQty);

module.exports = router;
