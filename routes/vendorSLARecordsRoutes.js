const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const vendorSLARecordsController = require("../controllers/vendorSLARecordsController");

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/vendor-sla-records/maintenance/:maintenanceId - Get SLA records for a maintenance schedule
router.get("/maintenance/:maintenanceId", vendorSLARecordsController.getVendorSLARecordsByMaintenance);

// POST /api/vendor-sla-records/maintenance/:maintenanceId - Create or update SLA records for a maintenance schedule
router.post("/maintenance/:maintenanceId", vendorSLARecordsController.upsertVendorSLARecords);

module.exports = router;

