const inspectionApprovalModel = require('../models/inspectionApprovalModel');
const workflowNotificationService = require('../services/workflowNotificationService');

/**
 * CHUNK 2.1 & 2.2: INSPECTION APPROVALS (CONTROLLER)
 * Handles read operations and approval actions
 */

/**
 * Get pending approvals for the current user
 */
async function getPendingApprovals(req, res) {
  try {
    const orgId = req.user?.org_id || req.body?.orgId || 'ORG001';
    const branchCode = req.user?.branch_code || req.body?.branchCode || 'BR001';
    let jobRoles = [];

    // Prioritize specific job role requested
    if (req.query.jobRoleId || req.body?.jobRoleId) {
        jobRoles = [req.query.jobRoleId || req.body?.jobRoleId];
    } else if (req.user?.roles && Array.isArray(req.user.roles) && req.user.roles.length > 0) {
        // If no specific role requested, check all user roles
        jobRoles = req.user.roles.map(r => r.job_role_id);
    } else if (req.user?.job_role_id) {
        // Fallback to single job role in token
        jobRoles = [req.user.job_role_id];
    }
    
    if (!jobRoles || jobRoles.length === 0) {
      // If no roles found, return empty list instead of error, as user might just have no relevant roles
      return res.json({ success: true, count: 0, data: [] });
    }
    
    // Remove duplicates and nulls
    jobRoles = [...new Set(jobRoles)].filter(Boolean);

    const approvals = await inspectionApprovalModel.getPendingInspectionApprovals(orgId, jobRoles);
    
    return res.json({ success: true, count: approvals.length, data: approvals });
  } catch (error) {
    console.error('Error getting pending approvals:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * Get detailed info for an inspection approval
 */
async function getInspectionDetail(req, res) {
  try {
    const orgId = req.user?.org_id || req.body?.orgId || 'ORG001';
    const branchCode = req.user?.branch_code || req.body?.branchCode || 'BR001';
    const { wfaiish_id } = req.params;
    
    console.log('Getting inspection detail for ID:', wfaiish_id, 'Org:', orgId);
    
    const detail = await inspectionApprovalModel.getInspectionApprovalDetail(orgId, wfaiish_id);
    
    if (!detail) {
      console.log('No detail found for ID:', wfaiish_id);
      return res.status(404).json({ success: false, message: 'Inspection not found.' });
    }
    
    console.log('Successfully retrieved detail for ID:', wfaiish_id);
    return res.json({ success: true, data: detail });
  } catch (error) {
    console.error('Error getting inspection detail for ID:', req.params?.wfaiish_id);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * Get history for an inspection
 */
async function getInspectionHistory(req, res) {
  try {
    const orgId = req.user?.org_id || req.body?.orgId || 'ORG001';
    const branchCode = req.user?.branch_code || req.body?.branchCode || 'BR001';
    const { wfaiish_id } = req.params;
    
    const history = await inspectionApprovalModel.getInspectionWorkflowHistory(orgId, wfaiish_id);
    
    return res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error('Error getting inspection history:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * Process an approval or rejection action
 * Logic:
 * - Validate current step status ('AP' required)
 * - If APPROVE ('AP' -> 'UA'):
 *   - Update current step to 'UA'
 *   - Find next step
 *   - If next step exists: Set its status to 'AP'
 *   - If no next step: Set Header status to 'AP' (Approved)
 * - If REJECT ('AP' -> 'UR'):
 *   - Update current step to 'UR'
 *   - Set Header status to 'RE' (Rejected)
 */
async function processApprovalAction(req, res) {
  try {
    // Extract user info (adapting to likely middleware structure)
    const orgId = req.user?.org_id || req.body?.orgId || 'ORG001';
    const userId = req.user?.user_id || req.user?.emp_int_id || 'UNKNOWN_USER'; 
    // In a real scenario, use middleware-provided ID. Fallback for testing/dev.
    
    // Ensure req.body exists
    const body = req.body || {};
    const { action, wfaiisd_id, comments, plannedDate, technicianId } = body;

    // Validate inputs
    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid action. Must be APPROVE or REJECT.' 
      });
    }

    if (!wfaiisd_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Workflow step ID (wfaiisd_id) is required.' 
      });
    }
    
    // Check if step exists
    const step = await inspectionApprovalModel.getWorkflowStepById(orgId, wfaiisd_id);
    if (!step) {
      return res.status(404).json({ 
        success: false, 
        message: 'Workflow step not found.' 
      });
    }
    
    // Validate current status
    // Expected status is 'AP' (Awaiting Approval)
    if (step.status !== 'AP') {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot process action. Current status is '${step.status}', expected 'AP'.` 
      });
    }
    
    const normalizedAction = action.toUpperCase();
    let nextStepMessage = '';
    
    if (normalizedAction === 'APPROVE') {
      
      // OPTIONAL: Update Header Date if provided
      if (plannedDate) {
         await inspectionApprovalModel.updateHeaderDetails(
             orgId, 
             step.wfaiish_id, 
             { pl_sch_date: plannedDate }, 
             userId
         );
      }

      // 1. Update current step to 'UA' (User Approved)
      await inspectionApprovalModel.updateWorkflowStepStatus(
        orgId, 
        wfaiisd_id, 
        'UA', 
        userId, 
        comments
      );
      
      // 2. Create History Record
      await inspectionApprovalModel.createWorkflowHistory({
        wfaiish_id: step.wfaiish_id,
        wfaiisd_id: wfaiisd_id,
        action: 'UA',
        action_by: userId,
        notes: comments || 'Approved',
        org_id: orgId
      });
      
      // 3. Find next step
      const nextStep = await inspectionApprovalModel.getNextWorkflowStep(
        orgId, 
        step.wfaiish_id, 
        step.sequence
      );
      
      if (nextStep) {
        // 4a. Activate next step ('AP')
        await inspectionApprovalModel.updateWorkflowStepStatus(
          orgId, 
          nextStep.wfaiisd_id, 
          'AP', 
          'SYSTEM', 
          'Activated by previous approval'
        );
        nextStepMessage = 'Next approver notified.';
      } else {
        // 4b. Workflow complete - Update Header to 'CO' (Completed)
        await inspectionApprovalModel.updateHeaderStatus(
          orgId, 
          step.wfaiish_id, 
          'CO', 
          userId
        );
        
        // 5. Create final inspection record in master table (tblAAT_Insp_Sch)
        try {
          await inspectionApprovalModel.createCompletedInspectionRecord(
            orgId,
            step.wfaiish_id,
            userId,
            technicianId
          );
          console.log('Created master inspection record for:', step.wfaiish_id, 'with technician:', technicianId);
        } catch (masterErr) {
          console.error('Failed to create master inspection record:', masterErr);
          // Non-blocking error, but should be noted
        }

        nextStepMessage = 'Workflow completed. Inspection approved and recorded.';
        
        // Add history for completion
        await inspectionApprovalModel.createWorkflowHistory({
          wfaiish_id: step.wfaiish_id,
          wfaiisd_id: step.wfaiisd_id, // Use current step ID since we can't be null
          action: 'CO', // Header Completed
          action_by: 'SYSTEM',
          notes: 'Workflow Completed & Recorded',
          org_id: orgId
        });
      }
      
    } else { // REJECT
      // 1. Update current step to 'UR' (User Rejected)
      await inspectionApprovalModel.updateWorkflowStepStatus(
        orgId, 
        wfaiisd_id, 
        'UR', 
        userId, 
        comments
      );

      // Create history for rejection
      await inspectionApprovalModel.createWorkflowHistory({
        wfaiish_id: step.wfaiish_id,
        wfaiisd_id: wfaiisd_id,
        action: 'UR',
        action_by: userId,
        notes: comments || 'Rejected',
        org_id: orgId
      });

      // 2. CHECK FOR PREVIOUS APPROVER (PUSH BACK LOGIC)
      // Find previous approved step
      const previousStep = await inspectionApprovalModel.getPreviousApprovedValues(orgId, step.wfaiish_id, step.sequence);

      if (previousStep) {
         // REVERT previous step to 'AP'
         await inspectionApprovalModel.updateWorkflowStepStatus(
            orgId,
            previousStep.wfaiisd_id,
            'AP',
            userId, // Changed by current rejector/system
            'Reverted due to rejection by next approver'
         );

         // Add history for reversion (Change last UA to AP)
         await inspectionApprovalModel.createWorkflowHistory({
            wfaiish_id: step.wfaiish_id,
            wfaiisd_id: previousStep.wfaiisd_id,
            action: 'AP', // Reverted to AP
            action_by: userId,
            notes: `Workflow Reverted: ${comments || 'No reason provided'}`,
            org_id: orgId
         });
         
         nextStepMessage = 'Inspection pushed back to previous approver.';

         // Notify previous approver
         try {
            await workflowNotificationService.notifyInspectionRejectionReverted({
                wfaiisd_id: previousStep.wfaiisd_id,
                wfaiish_id: step.wfaiish_id,
                job_role_id: previousStep.job_role_id,
                org_id: orgId,
                rejection_reason: comments || 'No reason provided'
            });
         } catch (e) {
             console.error('Failed to notify reversion:', e);
         }

      } else {
          // No previous approver -> This is the first person rejecting or system start
          // Update Header to 'RE' (Rejected) - Workflow Ends
          await inspectionApprovalModel.updateHeaderStatus(
            orgId, 
            step.wfaiish_id, 
            'RE', 
            userId
          );
          
          // Add history for header rejection
          await inspectionApprovalModel.createWorkflowHistory({
            wfaiish_id: step.wfaiish_id,
            wfaiisd_id: step.wfaiisd_id, // Use current step ID since we can't be null
            action: 'RE', // Header Rejected
            action_by: 'SYSTEM',
            notes: 'Workflow Rejected',
            org_id: orgId
          });
          
          nextStepMessage = 'Inspection rejected.';
      }
    }
    
    return res.json({
      success: true,
      message: `Action ${normalizedAction} processed successfully. ${nextStepMessage}`,
      data: {
        wfaiish_id: step.wfaiish_id,
        action: normalizedAction
      }
    });
    
  } catch (error) {
    console.error('Error processing approval action:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error processing approval.',
      error: error.message 
    });
  }
}

/**
 * Get certified technicians for a specific asset type
 */
async function getCertifiedTechnicians(req, res) {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const { assetTypeId } = req.params;
    
    if (!assetTypeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Asset type ID is required.' 
      });
    }
    
    console.log('Getting certified technicians for asset type:', assetTypeId, 'Org:', orgId);
    
    const technicians = await inspectionApprovalModel.getCertifiedTechnicians(orgId, assetTypeId);
    
    console.log(`Found ${technicians.length} certified technicians for asset type:`, assetTypeId);
    return res.json({ 
      success: true, 
      count: technicians.length, 
      data: technicians 
    });
  } catch (error) {
    console.error('Error getting certified technicians:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error.' 
    });
  }
}

/**
 * Get asset types for which certified technicians are available.
 * Lists asset_type_id, asset_type_name, and certified_technician_count.
 */
async function getAssetTypesWithCertifiedTechnicians(req, res) {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const rows = await inspectionApprovalModel.getAssetTypesWithCertifiedTechnicians(orgId);
    return res.json({
      success: true,
      data: rows,
      message: rows.length === 0
        ? 'No asset types have certified technicians yet. Assign certificates in Technician Certificates and get them approved.'
        : undefined
    });
  } catch (error) {
    console.error('Error getting asset types with certified technicians:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error.'
    });
  }
}

/**
 * Get technician details from workflow header (for inhouse maintained assets)
 */
async function getTechnicianFromHeader(req, res) {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const { empIntId } = req.params;
    
    if (!empIntId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Employee internal ID is required.' 
      });
    }
    
    console.log('Getting technician from workflow header:', empIntId, 'Org:', orgId);
    
    const technician = await inspectionApprovalModel.getTechnicianFromWorkflowHeader(orgId, empIntId);
    
    console.log(`Found technician for emp_int_id ${empIntId}:`, technician);
    return res.json({ 
      success: true, 
      data: technician 
    });
  } catch (error) {
    console.error('Error getting technician from workflow header:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error.' 
    });
  }
}

/**
 * Update inspection workflow header fields (vendor_id, pl_sch_date)
 */
async function updateWorkflowHeader(req, res) {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const userId = req.user?.user_id || req.user?.emp_int_id || 'SYSTEM';
    const { wfaiishId } = req.params;
    const { vendorId, pl_sch_date, technicianId } = req.body || {};

    if (!wfaiishId) return res.status(400).json({ success: false, message: 'Workflow header ID is required.' });

    const updated = await inspectionApprovalModel.updateHeaderDetails(orgId, wfaiishId, { vendorId, pl_sch_date, technicianId }, userId);
    if (!updated) return res.status(400).json({ success: false, message: 'No changes applied or update failed.' });

    return res.json({ success: true, data: updated, message: 'Workflow header updated.' });
  } catch (error) {
    console.error('Error updating workflow header:', error);
    return res.status(500).json({ success: false, message: 'Failed to update workflow header.' });
  }
}

module.exports = {
  getPendingApprovals,
  getInspectionDetail,
  getInspectionHistory,
  processApprovalAction,
  getCertifiedTechnicians,
  getAssetTypesWithCertifiedTechnicians,
  getTechnicianFromHeader,
  updateWorkflowHeader
};
