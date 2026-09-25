const express = require("express");
const router = express.Router();
const sparePartsReportController = require("../controllers/sparePartsReportController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/", sparePartsReportController.getSparePartsReport);
router.get("/filter-options", sparePartsReportController.getSparePartsReportFilterOptions);

module.exports = router;
