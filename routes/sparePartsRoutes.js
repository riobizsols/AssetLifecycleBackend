const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getCategories,
  createCategory,
  getCategoryMappings,
  createCategoryMapping,
  createSparePartLot,
  getLotIndividuals,
} = require('../controllers/sparePartsController');

router.use(protect);

router.get('/categories', getCategories);
router.post('/categories', createCategory);

router.get('/category-mappings', getCategoryMappings);
router.post('/category-mappings', createCategoryMapping);

router.post('/lots', createSparePartLot);
router.get('/lots/:spld_id/individuals', getLotIndividuals);

module.exports = router;
