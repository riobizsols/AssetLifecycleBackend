const {
  getOverdueWorkflows,
  getNextApprover,
  escalateWorkflow,
  processWorkflowEscalations,
  getWorkflowStepsWithEscDays
} = require('../models/workflowEscalationModel');
 const workflowEscalationLogger = require('../eventLoggers/workflowEscalationEventLogger');

/**
 * Get all overdue workflows
 * GET /api/workflow-escalation/overdue
 */
const getOverdueWorkflowsController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const orgId = req.query.orgId || 'ORG001';
  
  try {
    workflowEscalationLogger.logGetOverdueWorkflowsApiCalled({
      orgId,
      requestData: { operation: 'get_overdue_workflows' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    workflowEscalationLogger.logQueryingOverdueWorkflows({
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));
    
    const overdueWorkflows = await getOverdueWorkflows(orgId);
    
    if (overdueWorkflows.length === 0) {
      workflowEscalationLogger.logNoOverdueWorkflowsFound({
        orgId,
        userId
      }).catch(err => console.error('Logging error:', err));
    } else {
      workflowEscalationLogger.logOverdueWorkflowsRetrieved({
        orgId,
        count: overdueWorkflows.length,
        userId
      }).catch(err => console.error('Logging error:', err));
    }

    res.status(200).json({
      success: true,
      message: 'Overdue workflows retrieved successfully',
      data: overdueWorkflows,
      count: overdueWorkflows.length
    });
  } catch (error) {
    console.error('Error in getOverdueWorkflowsController:', error);
    workflowEscalationLogger.logOverdueWorkflowsRetrievalError({
      orgId,
      error,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve overdue workflows',
      error: error.message
    });
  }
};

/**
 * Manually trigger workflow escalation process
 * POST /api/workflow-escalation/process
 */
const triggerEscalationProcessController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const orgId = req.body.orgId || req.query.orgId || 'ORG001';
  const triggeredBy = req.user?.email || 'SYSTEM';
  
  try {
    workflowEscalationLogger.logTriggerEscalationProcessApiCalled({
      orgId,
      requestData: { operation: 'trigger_escalation_process', triggeredBy },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    workflowEscalationLogger.logManualEscalationTriggered({
      orgId,
      triggeredBy,
      userId
    }).catch(err => console.error('Logging error:', err));
    
    console.log('Manual escalation process triggered by:', triggeredBy);
    
    workflowEscalationLogger.logProcessingEscalationWorkflows({
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));
    
    const results = await processWorkflowEscalations(orgId);
    
    workflowEscalationLogger.logEscalationProcessCompleted({
      orgId,
      results,
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    res.status(200).json({
      success: true,
      message: 'Escalation process completed',
      data: results
    });
  } catch (error) {
    console.error('Error in triggerEscalationProcessController:', error);
    workflowEscalationLogger.logEscalationProcessError({
      orgId,
      error,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    res.status(500).json({
      success: false,
      message: 'Failed to process escalations',
      error: error.message
    });
  }
};

/**
 * Get next approver for a specific workflow
 * GET /api/workflow-escalation/next-approver/:wfamshId
 */
const getNextApproverController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const { wfamshId } = req.params;
  const { currentSequence } = req.query;
  const orgId = req.query.orgId || 'ORG001';
  
  try {
    workflowEscalationLogger.logGetNextApproverApiCalled({
      wfamshId,
      currentSequence,
      orgId,
      requestData: { operation: 'get_next_approver' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    workflowEscalationLogger.logValidatingNextApproverParams({
      wfamshId,
      currentSequence,
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));

    if (!wfamshId) {
      workflowEscalationLogger.logMissingWfamshId({ userId }).catch(err => console.error('Logging error:', err));
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID is required'
      });
    }

    if (!currentSequence) {
      workflowEscalationLogger.logMissingCurrentSequence({ userId }).catch(err => console.error('Logging error:', err));
      return res.status(400).json({
        success: false,
        message: 'Current sequence is required'
      });
    }

    workflowEscalationLogger.logQueryingNextApprover({
      wfamshId,
      currentSequence,
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));

    const nextApprover = await getNextApprover(wfamshId, parseInt(currentSequence, 10), orgId);

    if (nextApprover) {
      workflowEscalationLogger.logNextApproverFound({
        wfamshId,
        nextApprover,
        userId
      }).catch(err => console.error('Logging error:', err));
      
      res.status(200).json({
        success: true,
        message: 'Next approver found',
        data: nextApprover
      });
    } else {
      workflowEscalationLogger.logNoNextApproverFound({
        wfamshId,
        userId
      }).catch(err => console.error('Logging error:', err));
      
      res.status(404).json({
        success: false,
        message: 'No next approver found for this workflow'
      });
    }
  } catch (error) {
    console.error('Error in getNextApproverController:', error);
    workflowEscalationLogger.logNextApproverRetrievalError({
      wfamshId,
      error,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    res.status(500).json({
      success: false,
      message: 'Failed to get next approver',
      error: error.message
    });
  }
};

/**
 * Manually escalate a specific workflow
 * POST /api/workflow-escalation/escalate
 */
const manualEscalateWorkflowController = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const { wfamsdId, nextWfamsdId, wfamshId } = req.body;
  const orgId = req.body.orgId || 'ORG001';
  
  try {
    workflowEscalationLogger.logManualEscalateWorkflowApiCalled({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      requestData: { operation: 'manual_escalate_workflow' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    workflowEscalationLogger.logValidatingEscalationParams({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));

    if (!wfamsdId || !nextWfamsdId || !wfamshId) {
      const missingParams = [];
      if (!wfamsdId) missingParams.push('wfamsdId');
      if (!nextWfamsdId) missingParams.push('nextWfamsdId');
      if (!wfamshId) missingParams.push('wfamshId');
      
      workflowEscalationLogger.logMissingEscalationParams({
        missingParams,
        userId
      }).catch(err => console.error('Logging error:', err));
      
      return res.status(400).json({
        success: false,
        message: 'wfamsdId, nextWfamsdId, and wfamshId are required'
      });
    }

    workflowEscalationLogger.logProcessingWorkflowEscalation({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));

    workflowEscalationLogger.logEscalatingToNextApprover({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      userId
    }).catch(err => console.error('Logging error:', err));

    const result = await escalateWorkflow(wfamsdId, nextWfamsdId, wfamshId, orgId);
    
    workflowEscalationLogger.logWorkflowEscalated({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      result,
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in manualEscalateWorkflowController:', error);
    workflowEscalationLogger.logWorkflowEscalationError({
      wfamsdId,
      nextWfamsdId,
      wfamshId,
      orgId,
      error,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    res.status(500).json({
      success: false,
      message: 'Failed to escalate workflow',
      error: error.message
    });
  }
};

/**
 * Get escalation status: overdue count, whether escalation is applicable, and esc_no_days per step.
 * GET /api/workflow-escalation/status
 */
const getEscalationStatusController = async (req, res) => {
  const orgId = req.query.orgId || req.user?.org_id || 'ORG001';
  try {
    const [overdueWorkflows, stepsWithEscDays] = await Promise.all([
      getOverdueWorkflows(orgId),
      getWorkflowStepsWithEscDays(orgId)
    ]);
    res.status(200).json({
      success: true,
      data: {
        overdueCount: overdueWorkflows.length,
        willEscalate: overdueWorkflows.length > 0,
        overdueSummary: overdueWorkflows.map((w) => ({
          wfamsh_id: w.wfamsh_id,
          wfamsd_id: w.wfamsd_id,
          sequence: w.sequence,
          step_deadline: w.step_deadline || w.cutoff_date_fallback,
          esc_no_days: w.esc_no_days,
          asset_type_name: w.asset_type_name
        })),
        stepsWithEscDays: stepsWithEscDays.map((s) => ({
          wf_steps_id: s.wf_steps_id,
          text: s.text,
          esc_no_days: s.esc_no_days
        })),
        note: 'Cron runs daily at 9:00 AM to process escalations. Use POST /process to run manually.'
      }
    });
  } catch (error) {
    console.error('Error in getEscalationStatusController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escalation status',
      error: error.message
    });
  }
};

module.exports = {
  getOverdueWorkflowsController,
  triggerEscalationProcessController,
  getNextApproverController,
  manualEscalateWorkflowController,
  getEscalationStatusController
};

