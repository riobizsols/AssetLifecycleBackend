const express = require('express');
const router = express.Router();
const controller = require('../controllers/branchDeptMappingController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/', controller.listMappings);
router.post('/', controller.createMapping);
router.delete('/', controller.deleteMapping);

module.exports = router;
