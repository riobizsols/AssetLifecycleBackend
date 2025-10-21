const { getApprovalDetailByAssetId, getApprovalDetailByWfamshId, approveMaintenance, rejectMaintenance, getWorkflowHistory, getWorkflowHistoryByWfamshId, getMaintenanceApprovals, getAllMaintenanceWorkflowsByAssetId } = require('../models/approvalDetailModel');
const {
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // Detailed flow - Approve
    logApproveMaintenanceApiCalled,
    logValidatingApprovalRequest,
    logProcessingApproval,
    logMaintenanceApproved,
    // Detailed flow - Reject
    logRejectMaintenanceApiCalled,
    logValidatingRejectionReason,
    logProcessingRejection,
    logMaintenanceRejected,
    // INFO
    logApprovalsRetrieved,
    logApprovalDetailRetrieved,
    logWorkflowHistoryRetrieved,
    // WARNING
    logMissingRequiredFields,
    logApprovalNotFound,
    logNoApprovalsForEmployee,
    // ERROR
    logApprovalOperationError,
    logDataRetrievalError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation
} = require('../eventLoggers/maintenanceApprovalEventLogger');

// Get approval detail by asset ID
const getApprovalDetail = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params; // can be asset_id or wfamsh_id
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get Approval Detail',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_id: assetId, org_id: orgId },
      userId
    });

    if (!assetId) {
      await logMissingRequiredFields({
        operation: 'Get Approval Detail',
        missingFields: ['assetId'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const approvalDetail = await getApprovalDetailByAssetId(assetId, orgId);

    if (!approvalDetail) {
      await logApprovalNotFound({
        assetId,
        orgId,
        userId,
        duration: Date.now() - startTime
      });
      
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

    // Log success
    await logApprovalDetailRetrieved({
      assetId,
      wfamsdId: formattedDetail.wfamsdId,
      orgId,
      userId,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      message: 'Approval detail retrieved successfully',
      data: formattedDetail,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getApprovalDetail:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get Approval Detail',
      params: { asset_id: req.params.assetId, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve approval detail',
      error: error.message
    });
  }
};

// Approve maintenance
const approveMaintenanceAction = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params;
    const { empIntId, note } = req.body;
    const orgId = req.query.orgId || 'ORG001';

    // Step 1: Log API called with full request data
    await logApproveMaintenanceApiCalled({
      assetId,
      empIntId,
      note,
      orgId,
      method: req.method,
      url: req.originalUrl,
      userId
    });

    // Step 2: Validate required fields
    if (!assetId || !empIntId) {
      await logMissingRequiredFields({
        operation: 'Approve Maintenance',
        missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    // Step 3: Log validation success
    await logValidatingApprovalRequest({
      assetId,
      empIntId,
      userId
    });

    // Step 4: Log processing approval
    await logProcessingApproval({
      assetId,
      empIntId,
      userId
    });

    // Step 5: Execute approval
    const result = await approveMaintenance(assetId, empIntId, note, orgId);

    // Step 6: Log success
    await logMaintenanceApproved({
      assetId,
      empIntId,
      note,
      resultMessage: result.message,
      userId,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in approveMaintenanceAction:', error);
    
    // Determine if it's a critical error or just an error
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (isDbError) {
      if (error.code === 'ECONNREFUSED') {
        await logDatabaseConnectionFailure({
          operation: 'Approve Maintenance',
          error,
          userId,
          duration: Date.now() - startTime
        });
      } else {
        await logDatabaseConstraintViolation({
          operation: 'Approve Maintenance',
          error,
          assetId: req.params.assetId,
          userId,
          duration: Date.now() - startTime
        });
      }
    } else {
      await logApprovalOperationError({
        operation: 'Approve Maintenance',
        assetId: req.params.assetId,
        empIntId: req.body.empIntId,
        error,
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to approve maintenance',
      error: error.message
    });
  }
};

// Reject maintenance
const rejectMaintenanceAction = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params;
    const { empIntId, reason } = req.body;
    const orgId = req.query.orgId || 'ORG001';

    // Step 1: Log API called with full request data
    await logRejectMaintenanceApiCalled({
      assetId,
      empIntId,
      reason,
      orgId,
      method: req.method,
      url: req.originalUrl,
      userId
    });

    // Step 2: Validate required fields
    if (!assetId || !empIntId) {
      await logMissingRequiredFields({
        operation: 'Reject Maintenance',
        missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    // Step 3: Validate rejection reason
    const isReasonValid = reason && reason.trim() !== '';
    await logValidatingRejectionReason({
      assetId,
      reason,
      isValid: isReasonValid,
      userId
    });
    
    if (!isReasonValid) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Step 4: Log processing rejection
    await logProcessingRejection({
      assetId,
      empIntId,
      reason: reason.trim(),
      userId
    });

    // Step 5: Execute rejection
    const result = await rejectMaintenance(assetId, empIntId, reason.trim(), orgId);

    // Step 6: Log success
    await logMaintenanceRejected({
      assetId,
      empIntId,
      reason: reason.trim(),
      resultMessage: result.message,
      userId,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in rejectMaintenanceAction:', error);
    
    // Determine if it's a critical error or just an error
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (isDbError) {
      if (error.code === 'ECONNREFUSED') {
        await logDatabaseConnectionFailure({
          operation: 'Reject Maintenance',
          error,
          userId,
          duration: Date.now() - startTime
        });
      } else {
        await logDatabaseConstraintViolation({
          operation: 'Reject Maintenance',
          error,
          assetId: req.params.assetId,
          userId,
          duration: Date.now() - startTime
        });
      }
    } else {
      await logApprovalOperationError({
        operation: 'Reject Maintenance',
        assetId: req.params.assetId,
        empIntId: req.body.empIntId,
        error,
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to reject maintenance',
      error: error.message
    });
  }
};

// Get workflow history
const getWorkflowHistoryController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get Workflow History',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_id: assetId, org_id: orgId },
      userId
    });

    if (!assetId) {
      await logMissingRequiredFields({
        operation: 'Get Workflow History',
        missingFields: ['assetId'],
        userId,
        duration: Date.now() - startTime
      });
      
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

    // Log success
    await logWorkflowHistoryRetrieved({
      assetId,
      count: formattedHistory.length,
      orgId,
      userId,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: formattedHistory,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get Workflow History',
      params: { asset_id: req.params.assetId, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message
    });
  }
};

// Get maintenance approvals for the current user
const getMaintenanceApprovalsController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const empIntId = req.user.emp_int_id; // Get from auth middleware
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get Maintenance Approvals',
      method: req.method,
      url: req.originalUrl,
      requestData: { emp_int_id: empIntId, org_id: orgId },
      userId
    });

    if (!empIntId || empIntId === '') {
      // WARNING: No employee ID
      await logNoApprovalsForEmployee({
        empIntId: 'NOT_PROVIDED',
        orgId,
        userId,
        duration: Date.now() - startTime
      });
      
      return res.json({
        success: true,
        message: 'No maintenance approvals found - Employee ID not available',
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    const maintenanceApprovals = await getMaintenanceApprovals(empIntId, orgId);

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

    // Log success
    await logApprovalsRetrieved({
      empIntId,
      count: formattedData.length,
      orgId,
      userId,
      duration: Date.now() - startTime
    });

    res.json({
      success: true,
      message: 'Maintenance approvals retrieved successfully',
      data: formattedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getMaintenanceApprovals:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get Maintenance Approvals',
      params: { emp_int_id: req.user?.emp_int_id, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
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
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get All Maintenance Workflows',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_id: assetId, org_id: orgId },
      userId
    });

    if (!assetId) {
      await logMissingRequiredFields({
        operation: 'Get All Maintenance Workflows',
        missingFields: ['assetId'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const workflows = await getAllMaintenanceWorkflowsByAssetId(assetId, orgId);

    if (workflows.length === 0) {
      await logApprovalNotFound({
        assetId,
        orgId,
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(404).json({
        success: false,
        message: 'No maintenance workflows found for this asset'
      });
    }

    // Log success
    await logOperationSuccess({
      operation: 'Get All Maintenance Workflows',
      requestData: { asset_id: assetId, org_id: orgId },
      responseData: { workflows_count: workflows.length },
      duration: Date.now() - startTime,
      userId
    });

    res.json({
      success: true,
      message: 'Maintenance workflows retrieved successfully',
      data: workflows,
      count: workflows.length
    });

  } catch (error) {
    console.error('Error in getAllMaintenanceWorkflows:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get All Maintenance Workflows',
      params: { asset_id: req.params.assetId, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance workflows',
      error: error.message
    });
  }
};

// Get workflow history by wfamsh_id (specific workflow)
const getWorkflowHistoryByWfamshIdController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { wfamshId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get Workflow History By WfamshId',
      method: req.method,
      url: req.originalUrl,
      requestData: { wfamsh_id: wfamshId, org_id: orgId },
      userId
    });

    if (!wfamshId) {
      await logMissingRequiredFields({
        operation: 'Get Workflow History By WfamshId',
        missingFields: ['wfamshId'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'Workflow ID (wfamsh_id) is required'
      });
    }

    const history = await getWorkflowHistoryByWfamshId(wfamshId, orgId);

    // Log success
    await logOperationSuccess({
      operation: 'Get Workflow History By WfamshId',
      requestData: { wfamsh_id: wfamshId, org_id: orgId },
      responseData: { history_count: history.length },
      duration: Date.now() - startTime,
      userId
    });

    res.json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: history,
      count: history.length
    });

  } catch (error) {
    console.error('Error in getWorkflowHistoryByWfamshIdController:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get Workflow History By WfamshId',
      params: { wfamsh_id: req.params.wfamshId, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message
    });
  }
};

// Get approval detail by wfamsh_id (specific workflow)
const getApprovalDetailByWfamshIdController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { wfamshId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    // Log API called
    await logApiCall({
      operation: 'Get Approval Detail By WfamshId',
      method: req.method,
      url: req.originalUrl,
      requestData: { wfamsh_id: wfamshId, org_id: orgId },
      userId
    });

    if (!wfamshId || wfamshId.trim() === '') {
      await logMissingRequiredFields({
        operation: 'Get Approval Detail By WfamshId',
        missingFields: ['wfamshId'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID is required'
      });
    }

    // Validate that wfamshId is not empty and is a valid string
    if (typeof wfamshId !== 'string' || wfamshId.trim().length === 0) {
      await logMissingRequiredFields({
        operation: 'Get Approval Detail By WfamshId',
        missingFields: ['valid_wfamshId'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID must be a valid string'
      });
    }

    const approvalDetail = await getApprovalDetailByWfamshId(wfamshId, orgId);

    if (!approvalDetail) {
      await logApprovalNotFound({
        assetId: wfamshId,
        orgId,
        userId,
        duration: Date.now() - startTime
      });
      
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

    // Log success
    await logOperationSuccess({
      operation: 'Get Approval Detail By WfamshId',
      requestData: { wfamsh_id: wfamshId, org_id: orgId },
      responseData: { wfamsd_id: formattedDetail.wfamsdId, asset_id: formattedDetail.assetId },
      duration: Date.now() - startTime,
      userId
    });

    res.json({
      success: true,
      data: formattedDetail,
      message: 'Approval detail fetched successfully'
    });

  } catch (error) {
    console.error('Error in getApprovalDetailByWfamshId controller:', error);
    
    // Log error
    await logDataRetrievalError({
      operation: 'Get Approval Detail By WfamshId',
      params: { wfamsh_id: req.params.wfamshId, org_id: req.query.orgId },
      error,
      userId,
      duration: Date.now() - startTime
    });
    
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