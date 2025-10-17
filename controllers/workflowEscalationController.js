const {
  getOverdueWorkflows,
  getNextApprover,
  escalateWorkflow,
  processWorkflowEscalations
} = require('../models/workflowEscalationModel');

/**
 * Get all overdue workflows
 * GET /api/workflow-escalation/overdue
 */
const getOverdueWorkflowsController = async (req, res) => {
  try {
    const orgId = req.query.orgId || 'ORG001';
    const overdueWorkflows = await getOverdueWorkflows(orgId);

    res.status(200).json({
      success: true,
      message: 'Overdue workflows retrieved successfully',
      data: overdueWorkflows,
      count: overdueWorkflows.length
    });
  } catch (error) {
    console.error('Error in getOverdueWorkflowsController:', error);
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
  try {
    const orgId = req.body.orgId || req.query.orgId || 'ORG001';
    
    console.log('Manual escalation process triggered by:', req.user?.email || 'SYSTEM');
    
    const results = await processWorkflowEscalations(orgId);

    res.status(200).json({
      success: true,
      message: 'Escalation process completed',
      data: results
    });
  } catch (error) {
    console.error('Error in triggerEscalationProcessController:', error);
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
  try {
    const { wfamshId } = req.params;
    const { currentSequence } = req.query;
    const orgId = req.query.orgId || 'ORG001';

    if (!wfamshId) {
      return res.status(400).json({
        success: false,
        message: 'WFAMSH ID is required'
      });
    }

    if (!currentSequence) {
      return res.status(400).json({
        success: false,
        message: 'Current sequence is required'
      });
    }

    const nextApprover = await getNextApprover(wfamshId, parseInt(currentSequence, 10), orgId);

    if (nextApprover) {
      res.status(200).json({
        success: true,
        message: 'Next approver found',
        data: nextApprover
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No next approver found for this workflow'
      });
    }
  } catch (error) {
    console.error('Error in getNextApproverController:', error);
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
  try {
    const { wfamsdId, nextWfamsdId, wfamshId } = req.body;
    const orgId = req.body.orgId || 'ORG001';

    if (!wfamsdId || !nextWfamsdId || !wfamshId) {
      return res.status(400).json({
        success: false,
        message: 'wfamsdId, nextWfamsdId, and wfamshId are required'
      });
    }

    const result = await escalateWorkflow(wfamsdId, nextWfamsdId, wfamshId, orgId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in manualEscalateWorkflowController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to escalate workflow',
      error: error.message
    });
  }
};

module.exports = {
  getOverdueWorkflowsController,
  triggerEscalationProcessController,
  getNextApproverController,
  manualEscalateWorkflowController
};

