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

// Import supervisor approval logger
const supervisorApprovalLogger = require('../eventLoggers/supervisorApprovalEventLogger');

// Get approval detail by asset ID
const getApprovalDetail = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { assetId } = req.params; // can be asset_id or wfamsh_id
    const orgId = req.query.orgId || 'ORG001';
    const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL

    // Log API called (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalDetailApiCalled({
        method: req.method,
        url: req.originalUrl,
        wfamshId: assetId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logApiCall({
        operation: 'Get Approval Detail',
        method: req.method,
        url: req.originalUrl,
        requestData: { asset_id: assetId, org_id: orgId },
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    if (!assetId) {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logMissingRequiredFields({
          operation: 'Get Supervisor Approval Detail',
          missingFields: ['assetId'],
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logMissingRequiredFields({
          operation: 'Get Approval Detail',
          missingFields: ['assetId'],
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    // Detect if assetId is a WFAMSH ID (starts with 'WFAMSH_')
    const isWfamshId = String(assetId || '').startsWith('WFAMSH_');
    
    let approvalDetail;
    if (isWfamshId) {
      // Use the workflow-specific endpoint for WFAMSH IDs
      approvalDetail = await getApprovalDetailByWfamshId(assetId, orgId);
    } else {
      // Use asset-based endpoint for asset IDs
      approvalDetail = await getApprovalDetailByAssetId(assetId, orgId);
    }

    if (!approvalDetail) {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logApprovalNotFound({
          wfamshId: assetId,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logApprovalNotFound({
          assetId,
          orgId,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
      
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
      maint_type_id: approvalDetail.maint_type_id || null,
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

    // Log success (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalDetailRetrieved({
        wfamshId: assetId,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    } else {
      logApprovalDetailRetrieved({
        assetId,
        wfamsdId: formattedDetail.wfamsdId,
        orgId,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    }

    res.json({
      success: true,
      message: 'Approval detail retrieved successfully',
      data: formattedDetail,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getApprovalDetail:', error);
    
    const { context } = req.query;
    
    // Log error (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logDataRetrievalError({
        operation: 'Get Supervisor Approval Detail',
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    } else {
      logDataRetrievalError({
        operation: 'Get Approval Detail',
        params: { asset_id: req.params.assetId, org_id: req.query.orgId },
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    }
    
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
    const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL

    // Step 1: Log API called with full request data (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalActionApiCalled({
        method: req.method,
        url: req.originalUrl,
        wfamshId: assetId,
        action: 'approve',
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logApproveMaintenanceApiCalled({
        assetId,
        empIntId,
        note,
        orgId,
        method: req.method,
        url: req.originalUrl,
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    // Step 2: Validate required fields
    if (!assetId || !empIntId) {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logMissingRequiredFields({
          operation: 'Supervisor Approve Maintenance',
          missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logMissingRequiredFields({
          operation: 'Approve Maintenance',
          missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    // Step 3: Log validation success
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logValidationSuccess({
        operation: 'Supervisor Approve Maintenance',
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logValidatingApprovalRequest({
        assetId,
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    // Step 4: Log processing approval
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logProcessingSupervisorApproval({
        wfamshId: assetId,
        action: 'approve',
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logProcessingApproval({
        assetId,
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    // Step 5: Execute approval
    const result = await approveMaintenance(assetId, empIntId, note, orgId);

    // Step 6: Log success (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalCompleted({
        wfamshId: assetId,
        action: 'approve',
        empIntId,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    } else {
      logMaintenanceApproved({
        assetId,
        empIntId,
        note,
        resultMessage: result.message,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    }

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in approveMaintenanceAction:', error);
    
    const { context } = req.query;
    
    // Determine if it's a critical error or just an error
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (isDbError) {
      if (error.code === 'ECONNREFUSED') {
        if (context === 'SUPERVISORAPPROVAL') {
          supervisorApprovalLogger.logDatabaseConnectionFailure({
            operation: 'Supervisor Approve Maintenance',
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        } else {
          logDatabaseConnectionFailure({
            operation: 'Approve Maintenance',
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        }
      } else {
        if (context === 'SUPERVISORAPPROVAL') {
          supervisorApprovalLogger.logDatabaseConstraintViolation({
            operation: 'Supervisor Approve Maintenance',
            wfamshId: req.params.assetId,
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        } else {
          logDatabaseConstraintViolation({
            operation: 'Approve Maintenance',
            error,
            assetId: req.params.assetId,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        }
      }
    } else {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logSupervisorApprovalOperationError({
          operation: 'Supervisor Approve Maintenance',
          wfamshId: req.params.assetId,
          empIntId: req.body.empIntId,
          error,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logApprovalOperationError({
          operation: 'Approve Maintenance',
          assetId: req.params.assetId,
          empIntId: req.body.empIntId,
          error,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
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
    const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL

    // Step 1: Log API called with full request data (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalActionApiCalled({
        method: req.method,
        url: req.originalUrl,
        wfamshId: assetId,
        action: 'reject',
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logRejectMaintenanceApiCalled({
        assetId,
        empIntId,
        reason,
        orgId,
        method: req.method,
        url: req.originalUrl,
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    // Step 2: Validate required fields
    if (!assetId || !empIntId) {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logMissingRequiredFields({
          operation: 'Supervisor Reject Maintenance',
          missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logMissingRequiredFields({
          operation: 'Reject Maintenance',
          missingFields: [!assetId && 'assetId', !empIntId && 'empIntId'].filter(Boolean),
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
      
      return res.status(400).json({
        success: false,
        message: 'Asset ID and Employee ID are required'
      });
    }

    // Step 3: Validate rejection reason
    const isReasonValid = reason && reason.trim() !== '';
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logValidationSuccess({
        operation: 'Supervisor Reject Maintenance',
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logValidatingRejectionReason({
        assetId,
        reason,
        isValid: isReasonValid,
        userId
      }).catch(err => console.error('Logging error:', err));
    }
    
    if (!isReasonValid) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Step 4: Log processing rejection
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logProcessingSupervisorApproval({
        wfamshId: assetId,
        action: 'reject',
        empIntId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      logProcessingRejection({
        assetId,
        empIntId,
        reason: reason.trim(),
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    // Step 5: Execute rejection
    const result = await rejectMaintenance(assetId, empIntId, reason.trim(), orgId);

    // Step 6: Log success (context-aware)
    if (context === 'SUPERVISORAPPROVAL') {
      supervisorApprovalLogger.logSupervisorApprovalCompleted({
        wfamshId: assetId,
        action: 'reject',
        empIntId,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    } else {
      logMaintenanceRejected({
        assetId,
        empIntId,
        reason: reason.trim(),
        resultMessage: result.message,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
    }

    res.json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in rejectMaintenanceAction:', error);
    
    const { context } = req.query;
    
    // Determine if it's a critical error or just an error
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (isDbError) {
      if (error.code === 'ECONNREFUSED') {
        if (context === 'SUPERVISORAPPROVAL') {
          supervisorApprovalLogger.logDatabaseConnectionFailure({
            operation: 'Supervisor Reject Maintenance',
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        } else {
          logDatabaseConnectionFailure({
            operation: 'Reject Maintenance',
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        }
      } else {
        if (context === 'SUPERVISORAPPROVAL') {
          supervisorApprovalLogger.logDatabaseConstraintViolation({
            operation: 'Supervisor Reject Maintenance',
            wfamshId: req.params.assetId,
            error,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        } else {
          logDatabaseConstraintViolation({
            operation: 'Reject Maintenance',
            error,
            assetId: req.params.assetId,
            userId,
            duration: Date.now() - startTime
          }).catch(err => console.error('Logging error:', err));
        }
      }
    } else {
      if (context === 'SUPERVISORAPPROVAL') {
        supervisorApprovalLogger.logSupervisorApprovalOperationError({
          operation: 'Supervisor Reject Maintenance',
          wfamshId: req.params.assetId,
          empIntId: req.body.empIntId,
          error,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      } else {
        logApprovalOperationError({
          operation: 'Reject Maintenance',
          assetId: req.params.assetId,
          empIntId: req.body.empIntId,
          error,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }
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
    const orgId = req.query.orgId || req.user?.org_id || 'ORG001';
    
    // Get user's branch information to get branch_code
    const userModel = require("../models/userModel");
    const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
    const userBranchId = userWithBranch?.branch_id;
    
    console.log('=== Maintenance Approval Controller Debug ===');
    console.log('User org_id:', orgId);
    console.log('User branch_id:', userBranchId);
    
    // Get branch_code from tblBranches
    let userBranchCode = null;
    if (userBranchId) {
      const dbPool = req.db || require("../config/db");
      const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;

      const branchResult = await dbPool.query(branchQuery, [userBranchId]);
      if (branchResult.rows.length > 0) {
        userBranchCode = branchResult.rows[0].branch_code;
        console.log('User branch_code:', userBranchCode);
      } else {
        console.log('Branch not found for branch_id:', userBranchId);
      }
    }

    // Log API called
    await logApiCall({
      operation: 'Get Maintenance Approvals',
      method: req.method,
      url: req.originalUrl,
      requestData: { emp_int_id: empIntId, org_id: orgId, branch_code: userBranchCode },
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

    const maintenanceApprovals = await getMaintenanceApprovals(empIntId, orgId, userBranchCode, req.user?.hasSuperAccess || false);

    // Format the data for frontend
    const formattedData = maintenanceApprovals.map(record => ({
      wfamsh_id: record.wfamsh_id,
      asset_id: record.asset_id,
      asset_type_id: record.asset_type_id,
      asset_type_name: record.asset_type_name,
      serial_number: record.serial_number,
      asset_description: record.asset_description,
      scheduled_date: record.scheduled_date,
      actual_date: record.act_sch_date,
      vendor: record.vendor_name || '-',
      department: record.department_name || '-',
      employee: record.employee_name || '-',
      maintenance_type: record.maintenance_type_name || '-',
      status: record.header_status,
      days_until_due: record.days_until_due,
      days_until_cutoff: record.days_until_cutoff,
      maintenance_created_on: record.maintenance_created_on,
      maintenance_changed_on: record.maintenance_changed_on,
      branch_code: record.branch_code,
      org_id: orgId
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
      count: formattedData.length,
      user_context: {
        org_id: orgId,
        branch_id: userBranchId,
        branch_code: userBranchCode
      },
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
      assetName: approvalDetail.assetName,
      assetSerialNumber: approvalDetail.assetSerialNumber,
      assetTypeId: approvalDetail.assetTypeId,
      assetTypeName: approvalDetail.assetTypeName,
      vendorId: approvalDetail.vendorId,
      vendorName: approvalDetail.vendorName,
      maintenanceType: approvalDetail.maintenanceType,
      maint_type_id: approvalDetail.maint_type_id || null,
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
      workflowDetails: approvalDetail.workflowDetails,
      // Group asset maintenance information
      groupId: approvalDetail.groupId || null,
      groupName: approvalDetail.groupName || null,
      groupAssetCount: approvalDetail.groupAssetCount || null,
      isGroupMaintenance: approvalDetail.isGroupMaintenance || false,
      groupAssets: approvalDetail.groupAssets || [] // All assets in the group
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