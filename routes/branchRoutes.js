const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect } = require('../middlewares/authMiddleware');


router.use(protect);

router.get('/', branchController.getBranches);
router.post('/', branchController.createBranch);
router.delete('/', branchController.deleteBranches);
router.put('/:branch_id', branchController.updateBranch);

module.exports = router;
