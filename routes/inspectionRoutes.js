const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const inspectionScheduleController = require("../controllers/inspectionScheduleController");

/**
 * Inspection Routes
 * Phase 1: Schedule generation endpoints
 */

// Manual trigger for inspection schedule generation (for testing)
// POST /inspection/generate-cron
router.post(
  "/generate-cron",
  inspectionScheduleController.generateInspectionSchedules
);

// Alternative endpoint with auth protection (for admin use)
// GET /inspection/list
router.get(
  "/list",
  protect,
  inspectionScheduleController.getInspections
);

// GET /inspection/checklist/:assetTypeId
router.get(
  "/checklist/:assetTypeId",
  protect,
  inspectionScheduleController.getInspectionChecklist
);

// GET /inspection/:id/records
router.get(
  "/:id/records",
  protect,
  inspectionScheduleController.getInspectionRecords
);

// POST /inspection/records
router.post(
  "/records",
  protect,
  inspectionScheduleController.saveInspectionRecord
);

// GET /inspection/:id
router.get(
  "/:id",
  protect,
  inspectionScheduleController.getInspectionDetail
);

// PUT /inspection/:id
router.put(
  "/:id",
  protect,
  inspectionScheduleController.updateInspection
);

// POST /inspection/generate
router.post(
  "/generate",
  protect,
  inspectionScheduleController.generateInspectionSchedules
);

module.exports = router;

