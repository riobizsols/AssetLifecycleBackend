const express = require('express');
const router = express.Router();
const { getApprovalDetail, getApprovalDetailByWfamshId, approveMaintenanceAction, rejectMaintenanceAction, getWorkflowHistory, getWorkflowHistoryByWfamshId, getMaintenanceApprovals, getVendorRenewalApprovals, getAllMaintenanceWorkflows, updateWorkflowHeaderAction } = require('../controllers/approvalDetailController');
const { protect } = require('../middlewares/authMiddleware');

// DEBUG: Check WFAMSH data (before authentication middleware)
// GET /api/approval-detail/debug/:wfamshId
router.get('/debug/:wfamshId', async (req, res) => {
  try {
    const { wfamshId } = req.params;
    const { getDb } = require('../utils/dbContext');
    
    // Check header data
    const headerQuery = `
      SELECT wfamsh_id, asset_id, vendor_id, emp_int_id, at_main_freq_id
      FROM "tblWFAssetMaintSch_H"
      WHERE wfamsh_id = $1
    `;
    const headerResult = await getDb().query(headerQuery, [wfamshId]);
    
    // Check full query like in getApprovalDetailByWfamshId
    const fullQuery = `
      SELECT 
        wfd.wfamsd_id,
        wfh.emp_int_id as header_emp_int_id,
        wfh.vendor_id,
        a.service_vendor_id,
        CASE 
          WHEN COALESCE(wfh.vendor_id, a.service_vendor_id) IS NOT NULL AND COALESCE(wfh.vendor_id, a.service_vendor_id) != '' THEN 'Vendor'
          ELSE 'Inhouse'
        END as maintained_by
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      WHERE wfd.wfamsh_id = $1 AND wfd.org_id = 'ORG001'
      LIMIT 1
    `;
    const fullResult = await getDb().query(fullQuery, [wfamshId]);
    
    res.json({
      success: true,
      data: {
        headerData: headerResult.rows,
        fullQueryData: fullResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply authentication middleware to all other routes
router.use(protect);

// Get maintenance approvals for the current user
// GET /api/approval-detail/maintenance-approvals
router.get("/maintenance-approvals", getMaintenanceApprovals);

// Get vendor renewal approvals for the current user (MT005 only)
// GET /api/approval-detail/vendor-renewal-approvals
router.get("/vendor-renewal-approvals", getVendorRenewalApprovals);

// Get workflow history for an asset
router.get("/history/:assetId", getWorkflowHistory);

// Get workflow history by wfamsh_id (specific workflow)
router.get("/workflow-history/:wfamshId", getWorkflowHistoryByWfamshId);

// Get all maintenance workflows for an asset (separated by wfamsh_id)
// GET /api/approval-detail/workflows/:assetId
router.get('/workflows/:assetId', getAllMaintenanceWorkflows);

// Get approval detail by wfamsh_id (specific workflow)
// GET /api/approval-detail/workflow/:wfamshId
router.get('/workflow/:wfamshId', getApprovalDetailByWfamshId);

// Get approval detail by asset ID
// GET /api/approval-detail/:assetId
router.get('/:assetId', getApprovalDetail);

// Approve maintenance
// POST /api/approval-detail/:assetId/approve
router.post('/:assetId/approve', approveMaintenanceAction);

// Reject maintenance
// POST /api/approval-detail/:assetId/reject
router.post('/:assetId/reject', rejectMaintenanceAction);

// Update workflow header (vendor and/or maintenance date) independently
// PUT /api/approval-detail/workflow-header/:wfamshId
router.put('/workflow-header/:wfamshId', updateWorkflowHeaderAction);

module.exports = router; 