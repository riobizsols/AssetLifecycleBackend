const pool = require('../config/db');
const { sendEmail } = require('../utils/mailer');

/**
 * Get all workflows that have exceeded their cutoff date and are still pending approval
 * 
 * CUTOFF DATE CALCULATION:
 * Cutoff Date = Due Date (pl_sch_date) - Lead Time (maint_lead_type)
 * Default Lead Time: 5 days if not specified
 * 
 * CRITERIA FOR OVERDUE WORKFLOWS:
 * - Current approver status = 'AP' (Approval Pending)
 * - Workflow header status = 'IN' or 'IP' (In Progress)
 * - Current Date > Cutoff Date
 * 
 * @param {string} orgId - Organization ID (default: 'ORG001')
 * @returns {Promise<Array>} - Array of overdue workflows with approver details
 */
const getOverdueWorkflows = async (orgId = 'ORG001') => {
  try {
    const query = `
      SELECT DISTINCT
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.user_id,
        wfd.sequence,
        wfd.status as detail_status,
        wfd.org_id,
        wfh.asset_id,
        wfh.pl_sch_date as due_date,
        wfh.status as header_status,
        a.asset_type_id,
        at.text as asset_type_name,
        at.maint_lead_type,
        -- Calculate cutoff date
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 5
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 5
          END, 5
        )) as cutoff_date,
        -- Get user details
        CASE 
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.full_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN u.email IS NOT NULL THEN u.email
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.email
          ELSE NULL
        END as user_email
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
      WHERE wfd.org_id = $1
        AND wfd.status = 'AP'  -- Current approver is in Approval Pending status
        AND wfh.status IN ('IN', 'IP')  -- Workflow header is still In Progress
        -- Check if cutoff date has passed
        AND (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 5
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 5
          END, 5
        )) < CURRENT_DATE
        -- Only escalate if this workflow hasn't been escalated yet (check for escalation note)
        AND NOT EXISTS (
          SELECT 1 FROM "tblWFAssetMaintSch_D" wfd2 
          WHERE wfd2.wfamsh_id = wfd.wfamsh_id 
            AND wfd2.org_id = wfd.org_id 
            AND (wfd2.notes IS NOT NULL AND wfd2.notes LIKE '%[ESCALATED on%')
        )
      ORDER BY wfd.wfamsh_id, wfd.sequence
    `;

    const result = await pool.query(query, [orgId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching overdue workflows:', error);
    throw error;
  }
};

/**
 * Get the next approver in sequence for a workflow
 * @param {string} wfamshId - Workflow header ID
 * @param {number} currentSequence - Current sequence number
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object|null>} - Next approver details or null if none exists
 */
const getNextApprover = async (wfamshId, currentSequence, orgId = 'ORG001') => {
  try {
    const query = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.user_id,
        wfd.sequence,
        wfd.status,
        CASE 
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.full_name
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN u.email IS NOT NULL THEN u.email
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.email
          ELSE NULL
        END as user_email
      FROM "tblWFAssetMaintSch_D" wfd
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
      WHERE wfd.wfamsh_id = $1
        AND wfd.org_id = $2
        AND wfd.sequence > $3
        AND wfd.status = 'IN'  -- Next approver should be in Inactive status
      ORDER BY wfd.sequence ASC
      LIMIT 1
    `;

    const result = await pool.query(query, [wfamshId, orgId, currentSequence]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error fetching next approver:', error);
    throw error;
  }
};

/**
 * Escalate workflow to next approver
 * 
 * IMPORTANT: This does NOT change the current approver's status!
 * - Current approver remains 'AP' (Approval Pending) - they still need to approve
 * - Next approver changes from 'IN' to 'AP' - now they also need to approve
 * - BOTH approvers must approve for the workflow to proceed
 * 
 * @param {string} wfamsdId - Current workflow detail ID (not modified)
 * @param {string} nextWfamsdId - Next approver's workflow detail ID
 * @param {string} wfamshId - Workflow header ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} - Escalation result
 */
const escalateWorkflow = async (wfamsdId, nextWfamsdId, wfamshId, orgId = 'ORG001') => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Current approver keeps status 'AP' (no change needed - they still must approve!)
    // Just log that escalation occurred
    console.log(`   → Current approver (${wfamsdId}): Keeping status AP - still must approve`);

    // Update next approver status to 'AP' (Approval Pending)
    // Now BOTH approvers have AP status and both must approve
    // Add a note indicating escalation occurred
    const updateNextQuery = `
      UPDATE "tblWFAssetMaintSch_D"
      SET status = 'AP',
          notes = COALESCE(notes, '') || ' [ESCALATED on ' || CURRENT_TIMESTAMP || ' - Cutoff date exceeded]'
      WHERE wfamsd_id = $1
        AND org_id = $2
      RETURNING *
    `;
    
    const nextResult = await client.query(updateNextQuery, [nextWfamsdId, orgId]);

    // Commit the transaction
    await client.query('COMMIT');
    
    console.log('✅ Escalation completed successfully');
    console.log(`   → Next approver (${nextWfamsdId}): IN → AP - now also must approve`);

    return {
      success: true,
      message: 'Workflow escalated successfully',
      currentApprover: { wfamsd_id: wfamsdId, status: 'AP' },
      nextApprover: nextResult.rows[0]
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error escalating workflow:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ==================================================================================
 * PROCESS WORKFLOW CUTOFF DATE ESCALATIONS - MAIN FUNCTION
 * ==================================================================================
 * 
 * This is the main function that orchestrates the entire workflow escalation process.
 * It should be called by the automated cron job daily at 9:00 AM IST.
 * 
 * PROCESS FLOW:
 * 1. Find all workflows that have exceeded their cutoff date
 * 2. For each overdue workflow:
 *    a. Verify current approver still has status 'AP' (Approval Pending)
 *    b. Find the next approver in sequence (status 'IN' - Inactive)
 *    c. Update current approver: 'AP' → 'UA' (Unapproved/Escalated)
 *    d. Update next approver: 'IN' → 'AP' (Approval Pending)
 *    e. Send email notification to next approver
 *    f. Log the escalation in tblWorkflowEscalationLog
 * 3. Return summary of escalations performed
 * 
 * @param {string} orgId - Organization ID (default: 'ORG001')
 * @returns {Promise<Object>} - Escalation summary with counts and details
 */
const processWorkflowEscalations = async (orgId = 'ORG001') => {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 WORKFLOW CUTOFF DATE ESCALATION - Process Started');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 Organization ID:', orgId);
    console.log('⏰ Timestamp:', new Date().toISOString());

    const overdueWorkflows = await getOverdueWorkflows(orgId);
    console.log(`Found ${overdueWorkflows.length} overdue workflows`);

    const escalationResults = {
      total: overdueWorkflows.length,
      escalated: 0,
      noNextApprover: 0,
      errors: 0,
      details: []
    };

    for (const workflow of overdueWorkflows) {
      try {
        console.log(`\nProcessing workflow: ${workflow.wfamsh_id}, Sequence: ${workflow.sequence}`);
        
        // Get next approver
        const nextApprover = await getNextApprover(
          workflow.wfamsh_id,
          workflow.sequence,
          orgId
        );

        if (nextApprover) {
          console.log(`Next approver found: ${nextApprover.user_name} (${nextApprover.user_email})`);
          
          // Escalate workflow
          const escalationResult = await escalateWorkflow(
            workflow.wfamsd_id,
            nextApprover.wfamsd_id,
            workflow.wfamsh_id,
            orgId
          );

          // Send notification email to next approver
          if (nextApprover.user_email) {
            try {
              await sendEmail({
                to: nextApprover.user_email,
                subject: `Urgent: Maintenance Approval Required - ${workflow.asset_type_name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">🚨 Urgent: Workflow Escalation</h2>
                    <p>Dear ${nextApprover.user_name},</p>
                    <p>A maintenance workflow has been escalated to you due to the cutoff date being exceeded.</p>
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                      <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> This workflow now requires approval from BOTH you AND the previous approver (${workflow.user_name}). Both approvals are needed for the workflow to proceed.</p>
                    </div>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <p><strong>Asset Type:</strong> ${workflow.asset_type_name}</p>
                      <p><strong>Asset ID:</strong> ${workflow.asset_id}</p>
                      <p><strong>Workflow ID:</strong> ${workflow.wfamsh_id}</p>
                      <p><strong>Due Date:</strong> ${new Date(workflow.due_date).toLocaleDateString()}</p>
                      <p><strong>Cutoff Date:</strong> ${new Date(workflow.cutoff_date).toLocaleDateString()}</p>
                      <p><strong>Also Pending Approval From:</strong> ${workflow.user_name}</p>
                    </div>
                    <p style="color: #d32f2f;"><strong>Action Required:</strong> Please review and approve this maintenance workflow as soon as possible. The previous approver must also approve.</p>
                    <p>
                      <a href="${process.env.FRONTEND_URL}/approval-detail/${workflow.wfamsh_id}" 
                         style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Review & Approve Workflow
                      </a>
                    </p>
                    <p style="margin-top: 30px; color: #666; font-size: 12px;">
                      This is an automated notification from the Asset Lifecycle Management System.
                    </p>
                  </div>
                `
              });
              console.log(`Notification email sent to ${nextApprover.user_email}`);
            } catch (emailError) {
              console.error('Error sending notification email:', emailError);
            }
          }

          escalationResults.escalated++;
          escalationResults.details.push({
            wfamshId: workflow.wfamsh_id,
            assetId: workflow.asset_id,
            fromUser: workflow.user_name,
            toUser: nextApprover.user_name,
            status: 'escalated'
          });
        } else {
          console.log(`No next approver found for workflow ${workflow.wfamsh_id}`);
          escalationResults.noNextApprover++;
          escalationResults.details.push({
            wfamshId: workflow.wfamsh_id,
            assetId: workflow.asset_id,
            fromUser: workflow.user_name,
            status: 'no_next_approver'
          });
        }
      } catch (error) {
        console.error(`Error processing workflow ${workflow.wfamsh_id}:`, error);
        escalationResults.errors++;
        escalationResults.details.push({
          wfamshId: workflow.wfamsh_id,
          assetId: workflow.asset_id,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('\n=== Escalation Process Complete ===');
    console.log('Summary:', escalationResults);

    return escalationResults;
  } catch (error) {
    console.error('Error in processWorkflowEscalations:', error);
    throw error;
  }
};

module.exports = {
  getOverdueWorkflows,
  getNextApprover,
  escalateWorkflow,
  processWorkflowEscalations
};

