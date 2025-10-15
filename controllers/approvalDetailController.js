const { getApprovalDetailByAssetId, getApprovalDetailByWfamshId, approveMaintenance, rejectMaintenance, getWorkflowHistory, getWorkflowHistoryByWfamshId, getMaintenanceApprovals, getAllMaintenanceWorkflowsByAssetId } = require('../models/approvalDetailModel');

// Get approval detail by asset ID
const getApprovalDetail = async (req, res) => {
  try {
    const { assetId } = req.params; // can be asset_id or wfamsh_id
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const approvalDetail = await getApprovalDetailByAssetId(assetId, orgId);

    if (!approvalDetail) {
      return res.status(404).json({
        success: false,
        message: 'No approval detail found for this asset'
      });
    }

    // Format the response for frontend
    const formattedDetail = {
      // Basic info
      wfamsdId: approvalDetail.wfamsd_id,
      wfamshId: approvalDetail.wfamsh_id,
      assetId: approvalDetail.asset_id,
      assetTypeId: approvalDetail.asset_type_id,
      assetTypeName: approvalDetail.asset_type_name,
      vendorId: approvalDetail.vendor_id,
      vendorName: approvalDetail.vendor_name,
      
      // Maintenance info
      maintenanceType: approvalDetail.maint_type_name || 'Regular Maintenance',
      dueDate: approvalDetail.pl_sch_date,
      cutoffDate: approvalDetail.cutoff_date,
      
      // User info
      actionBy: approvalDetail.user_name || 'Unassigned',
      userId: approvalDetail.user_id,
      userEmail: approvalDetail.user_email,
      
      // Status info
      status: approvalDetail.detail_status,
      sequence: approvalDetail.sequence,
      
      // Calculated fields
      daysUntilDue: Math.floor(approvalDetail.days_until_due || 0),
      daysUntilCutoff: Math.floor(approvalDetail.days_until_cutoff || 0),
      isUrgent: approvalDetail.days_until_cutoff <= 2,
      isOverdue: approvalDetail.days_until_due <= 0,
      
      // Additional fields
      notes: null, // As requested, notes is null for now
      checklist: approvalDetail.checklist || [], // Include checklist items from database
      workflowSteps: approvalDetail.workflowSteps || [], // Include workflow steps
      vendorDetails: approvalDetail.vendorDetails || null // Include vendor details
    };

    res.json({
      success: true,
      message: 'Approval detail retrieved successfully',
      data: formattedDetail,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getApprovalDetail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve approval detail',
      error: error.message
    });
  }
};

// Approve maintenance
const approveMaintenanceAction = async (req, res) => {
  try {
    const { assetId } = req.params;
      const { empIntId, note } = req.body;
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId || !empIntId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    const result = await approveMaintenance(assetId, empIntId, note, orgId);

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in approveMaintenanceAction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve maintenance',
      error: error.message
    });
  }
};

// Reject maintenance
const rejectMaintenanceAction = async (req, res) => {
  try {
    const { assetId } = req.params;
    const { empIntId, reason } = req.body;
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId || !empIntId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const result = await rejectMaintenance(assetId, empIntId, reason.trim(), orgId);

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in rejectMaintenanceAction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject maintenance',
      error: error.message
    });
  }
};

// Get workflow history
const getWorkflowHistoryController = async (req, res) => {
  try {
    const { assetId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const history = await getWorkflowHistory(assetId, orgId);

    // Format the history data for frontend
    const formattedHistory = history.map(record => ({
      id: record.wfamsd_id,
      date: new Date(record.action_on).toLocaleString(),
      action: getActionText(record.action),
      actionType: getActionType(record.action),
      user: record.affected_user_name || 'Unknown User',
      actionBy: record.user_name || 'System',
      notes: record.notes || '',
      jobRole: record.job_role_name || '',
      department: record.dept_name || '',
      sequence: record.sequence,
      status: record.action
    }));

    res.json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: formattedHistory,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message
    });
  }
};

// Get maintenance approvals for the current user
const getMaintenanceApprovalsController = async (req, res) => {
  try {
    const empIntId = req.user.emp_int_id; // Get from auth middleware
    const orgId = req.query.orgId || 'ORG001';

    console.log('=== getMaintenanceApprovalsController ===');
    console.log('empIntId:', empIntId);
    console.log('orgId:', orgId);
    console.log('req.user:', req.user);

    if (!empIntId || empIntId === '') {
      console.log('ERROR: Employee ID is missing or empty');
      return res.json({
        success: true,
        message: 'No maintenance approvals found - Employee ID not available',
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    const maintenanceApprovals = await getMaintenanceApprovals(empIntId, orgId);
    console.log('Found maintenance approvals:', maintenanceApprovals.length);

    // Format the data for frontend
    const formattedData = maintenanceApprovals.map(record => ({
      wfamsh_id: record.wfamsh_id,
      asset_id: record.asset_id,
      asset_type_id: record.asset_type_id,
      asset_type_name: record.asset_type_name,
      serial_number: record.serial_number,
      asset_description: record.asset_description,
      scheduled_date: record.pl_sch_date,
      actual_date: record.act_sch_date,
      vendor: record.vendor_name || '-',
      department: record.department_name || '-',
      employee: record.employee_name || '-',
      maintenance_type: record.maintenance_type_name || '-',
      status: record.header_status,
      days_until_due: record.days_until_due,
      days_until_cutoff: record.days_until_cutoff,
      maintenance_created_on: record.maintenance_created_on,
      maintenance_changed_on: record.maintenance_changed_on
    }));

    res.json({
      success: true,
      message: 'Maintenance approvals retrieved successfully',
      data: formattedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getMaintenanceApprovals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance approvals',
      error: error.message
    });
  }
};

// Helper function to get action text
const getActionText = (status) => {
  switch (status) {
    case 'IN':
      return 'Initiated';
    case 'AP':
      return 'Approval Pending';
    case 'UA':
      return 'Approved';
    case 'UR':
      return 'Rejected';
    case 'IP':
      return 'In Progress';
    default:
      return 'Unknown';
  }
};

// Helper function to get action type for styling
const getActionType = (status) => {
  switch (status) {
    case 'UA':
      return 'approved';
    case 'UR':
      return 'rejected';
    case 'AP':
      return 'pending';
    case 'IN':
      return 'initiated';
    default:
      return 'unknown';
  }
};

// Get all maintenance workflows for an asset (separated by wfamsh_id)
const getAllMaintenanceWorkflows = async (req, res) => {
  try {
    const { assetId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const workflows = await getAllMaintenanceWorkflowsByAssetId(assetId, orgId);

    if (workflows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No maintenance workflows found for this asset'
      });
    }

    res.json({
      success: true,
      message: 'Maintenance workflows retrieved successfully',
      data: workflows,
      count: workflows.length
    });

  } catch (error) {
    console.error('Error in getAllMaintenanceWorkflows:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance workflows',
      error: error.message
    });
  }
};

// Get workflow history by wfamsh_id (specific workflow)
const getWorkflowHistoryByWfamshIdController = async (req, res) => {
  try {
    const { wfamshId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    if (!wfamshId) {
      return res.status(400).json({
        success: false,
        message: 'Workflow ID (wfamsh_id) is required'
      });
    }

    const history = await getWorkflowHistoryByWfamshId(wfamshId, orgId);

    res.json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: history,
      count: history.length
    });

  } catch (error) {
    console.error('Error in getWorkflowHistoryByWfamshIdController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message
    });
  }
};

// Get approval detail by wfamsh_id (specific workflow)
const getApprovalDetailByWfamshIdController = async (req, res) => {
  try {
    const { wfamshId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    if (!wfamshId || wfamshId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID is required'
      });
    }

    // Validate that wfamshId is a valid integer
    const wfamshIdNum = parseInt(wfamshId, 10);
    if (isNaN(wfamshIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID must be a valid integer'
      });
    }

    const approvalDetail = await getApprovalDetailByWfamshId(wfamshIdNum, orgId);

    if (!approvalDetail) {
      return res.status(404).json({
        success: false,
        message: 'No approval detail found for this workflow'
      });
    }

    // Format the response for frontend
    const formattedDetail = {
      // Basic info
      wfamsdId: approvalDetail.wfamsdId,
      wfamshId: approvalDetail.wfamshId,
      assetId: approvalDetail.assetId,
      assetTypeId: approvalDetail.assetTypeId,
      assetTypeName: approvalDetail.assetTypeName,
      vendorId: approvalDetail.vendorId,
      vendorName: approvalDetail.vendorName,
      maintenanceType: approvalDetail.maintenanceType,
      dueDate: approvalDetail.dueDate,
      cutoffDate: approvalDetail.cutoffDate,
      actionBy: approvalDetail.actionBy,
      userId: approvalDetail.userId,
      userEmail: approvalDetail.userEmail,
      status: approvalDetail.status,
      sequence: approvalDetail.sequence,
      daysUntilDue: approvalDetail.daysUntilDue,
      daysUntilCutoff: approvalDetail.daysUntilCutoff,
      isUrgent: approvalDetail.isUrgent,
      isOverdue: approvalDetail.isOverdue,
      notes: approvalDetail.notes,
      checklist: approvalDetail.checklist,
      vendorDetails: approvalDetail.vendorDetails,
      workflowSteps: approvalDetail.workflowSteps,
      workflowDetails: approvalDetail.workflowDetails
    };

    res.json({
      success: true,
      data: formattedDetail,
      message: 'Approval detail fetched successfully'
    });

  } catch (error) {
    console.error('Error in getApprovalDetailByWfamshId controller:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getApprovalDetail,
  getApprovalDetailByWfamshId: getApprovalDetailByWfamshIdController,
  approveMaintenanceAction,
  rejectMaintenanceAction,
  getWorkflowHistory: getWorkflowHistoryController,
  getWorkflowHistoryByWfamshId: getWorkflowHistoryByWfamshIdController,
  getMaintenanceApprovals: getMaintenanceApprovalsController,
  getAllMaintenanceWorkflows
}; 