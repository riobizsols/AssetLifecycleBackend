const { getDb } = require('../utils/dbContext');
const { sendEmail } = require('../utils/mailer');

/**
 * Default lead time (days) when esc_no_days is not set on the workflow step.
 * Used as fallback for overdue calculation: cutoff = due_date - default_lead_time.
 */
const DEFAULT_LEAD_DAYS = 5;

/**
 * Get lead time in days from asset type maint_lead_type (for fallback when esc_no_days is null).
 */
function parseLeadDays(maintLeadType) {
  if (maintLeadType == null || maintLeadType === '') return DEFAULT_LEAD_DAYS;
  if (typeof maintLeadType === 'string' && /^[0-9]+$/.test(maintLeadType.trim())) {
    return parseInt(maintLeadType.trim(), 10) || DEFAULT_LEAD_DAYS;
  }
  return DEFAULT_LEAD_DAYS;
}

/**
 * Get all workflows where the current approval step has exceeded its deadline.
 *
 * OVERDUE BY STEP (preferred):
 * - Deadline = date when current step became 'AP' + esc_no_days (from tblWFSteps).
 * - Step is linked via tblWFATSeqs: asset_type_id + sequence (seqs_no) -> wf_steps_id -> tblWFSteps.esc_no_days.
 * - If esc_no_days is NULL for that step, fallback: overdue when current date > (pl_sch_date - lead time).
 *
 * CRITERIA:
 * - Current step status = 'AP', header status IN ('IN','IP').
 * - Not already escalated (no [ESCALATED on] note on any detail for this workflow).
 * - One row per (wfamsh_id, sequence) so each step is escalated once.
 *
 * @param {string} orgId - Organization ID (default: 'ORG001')
 * @returns {Promise<Array>} - Overdue workflows with step and asset info
 */
const getOverdueWorkflows = async (orgId = 'ORG001') => {
  try {
    const query = `
      SELECT DISTINCT ON (wfd.wfamsh_id, wfd.sequence)
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.user_id,
        wfd.sequence,
        wfd.status as detail_status,
        wfd.org_id,
        wfd.created_on as step_created_on,
        wfd.changed_on as step_changed_on,
        wfh.asset_id,
        wfh.pl_sch_date as due_date,
        wfh.status as header_status,
        a.asset_type_id,
        at.text as asset_type_name,
        at.maint_lead_type,
        ws.wf_steps_id,
        ws.esc_no_days,
        (COALESCE((wfd.changed_on)[1], wfd.created_on)::date + (COALESCE(ws.esc_no_days, 0) || ' days')::interval)::date as step_deadline,
        (wfh.pl_sch_date - (COALESCE(
          CASE
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN $2
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE $2
          END, $2
        ) || ' days')::interval)::date as cutoff_date_fallback,
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
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id AND wfh.org_id = wfd.org_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblWFATSeqs" wfas ON wfas.asset_type_id = a.asset_type_id
        AND wfas.org_id = wfd.org_id
        AND CAST(wfas.seqs_no AS INTEGER) = wfd.sequence
      LEFT JOIN "tblWFSteps" ws ON ws.wf_steps_id = wfas.wf_steps_id
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
      WHERE wfd.org_id = $1
        AND wfd.status = 'AP'
        AND wfh.status IN ('IN', 'IP')
        AND (
          (ws.esc_no_days IS NOT NULL AND CURRENT_DATE > (COALESCE((wfd.changed_on)[1], wfd.created_on)::date + (ws.esc_no_days || ' days')::interval)::date)
          OR
          (ws.esc_no_days IS NULL AND CURRENT_DATE > (wfh.pl_sch_date - (COALESCE(
            CASE WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN $2
                 WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
                 ELSE $2 END, $2
          ) || ' days')::interval)::date)
        )
        AND NOT EXISTS (
          SELECT 1 FROM "tblWFAssetMaintSch_D" wfd2
          WHERE wfd2.wfamsh_id = wfd.wfamsh_id AND wfd2.org_id = wfd.org_id
            AND wfd2.notes IS NOT NULL AND wfd2.notes LIKE '%[ESCALATED on%'
        )
      ORDER BY wfd.wfamsh_id, wfd.sequence
    `;
    const result = await getDb().query(query, [orgId, DEFAULT_LEAD_DAYS]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching overdue workflows:', error);
    throw error;
  }
};

/**
 * Get the next approver(s) in sequence for a workflow.
 * Returns all detail rows for the next step (all job roles configured in tblWFJobRole for that step).
 * These rows are created from tblWFATSeqs + tblWFJobRole, so they are exactly the roles that should receive escalation.
 *
 * @param {string} wfamshId - Workflow header ID
 * @param {number} currentSequence - Current sequence number
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} - Next approver detail rows (may be multiple per step)
 */
const getNextApprovers = async (wfamshId, currentSequence, orgId = 'ORG001') => {
  try {
    const query = `
      SELECT
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.user_id,
        wfd.job_role_id,
        wfd.sequence,
        wfd.status,
        CASE WHEN u.full_name IS NOT NULL THEN u.full_name
             WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.full_name
             ELSE 'Unknown User' END as user_name,
        CASE WHEN u.email IS NOT NULL THEN u.email
             WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.email
             ELSE NULL END as user_email
      FROM "tblWFAssetMaintSch_D" wfd
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
      WHERE wfd.wfamsh_id = $1
        AND wfd.org_id = $2
        AND wfd.sequence > $3
        AND wfd.status = 'IN'
        AND wfd.sequence = (
          SELECT MIN(wfd2.sequence)
          FROM "tblWFAssetMaintSch_D" wfd2
          WHERE wfd2.wfamsh_id = $1 AND wfd2.org_id = $2
            AND wfd2.sequence > $3 AND wfd2.status = 'IN'
        )
      ORDER BY wfd.sequence ASC, wfd.wfamsd_id
    `;
    const result = await getDb().query(query, [wfamshId, orgId, currentSequence]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching next approvers:', error);
    throw error;
  }
};

/** @deprecated Use getNextApprovers. Kept for backward compatibility. */
const getNextApprover = async (wfamshId, currentSequence, orgId = 'ORG001') => {
  const rows = await getNextApprovers(wfamshId, currentSequence, orgId);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Escalate workflow to the next step(s).
 * Sets all next-step detail rows (per tblWFATSeqs sequence and tblWFJobRole) to 'AP' and adds escalation note.
 * Current approver remains 'AP' (both must approve).
 *
 * @param {string} currentWfamsdId - Current workflow detail ID (unchanged)
 * @param {string[]} nextWfamsdIds - Next approver workflow detail IDs (all job roles for next step)
 * @param {string} wfamshId - Workflow header ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} - Escalation result with updated rows
 */
const escalateWorkflow = async (currentWfamsdId, nextWfamsdIds, wfamshId, orgId = 'ORG001') => {
  const ids = Array.isArray(nextWfamsdIds) ? nextWfamsdIds : [nextWfamsdIds];
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    console.log(`   → Current approver (${currentWfamsdId}): Keeping status AP - still must approve`);

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const updateNextQuery = `
      UPDATE "tblWFAssetMaintSch_D"
      SET status = 'AP',
          notes = COALESCE(notes, '') || ' [ESCALATED on ' || CURRENT_TIMESTAMP || ' - Step deadline exceeded (esc_no_days)]'
      WHERE wfamsd_id IN (${placeholders})
        AND org_id = $${ids.length + 1}
      RETURNING *
    `;
    const nextResult = await client.query(updateNextQuery, [...ids, orgId]);

    await client.query('COMMIT');

    console.log(`✅ Escalation completed: ${nextResult.rows.length} next approver(s) set to AP`);

    return {
      success: true,
      message: 'Workflow escalated successfully',
      currentApprover: { wfamsd_id: currentWfamsdId, status: 'AP' },
      nextApprovers: nextResult.rows
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
 * Process workflow escalations: find overdue steps (by esc_no_days or fallback cutoff),
 * escalate to next approvers per tblWFATSeqs and notify only job roles from tblWFJobRole.
 *
 * @param {string} orgId - Organization ID (default: 'ORG001')
 * @returns {Promise<Object>} - Summary with escalated, noNextApprover, errors, details
 */
const processWorkflowEscalations = async (orgId = 'ORG001') => {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🚀 WORKFLOW ESCALATION (esc_no_days / step deadline) - Started');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📍 Organization ID:', orgId);
    console.log('⏰ Timestamp:', new Date().toISOString());

    const overdueWorkflows = await getOverdueWorkflows(orgId);
    console.log(`Found ${overdueWorkflows.length} overdue workflow step(s)`);

    const escalationResults = {
      total: overdueWorkflows.length,
      escalated: 0,
      noNextApprover: 0,
      errors: 0,
      details: []
    };

    for (const workflow of overdueWorkflows) {
      try {
        console.log(`\nProcessing workflow: ${workflow.wfamsh_id}, Sequence: ${workflow.sequence} (step deadline / esc_no_days)`);

        const nextApprovers = await getNextApprovers(
          workflow.wfamsh_id,
          workflow.sequence,
          orgId
        );

        if (nextApprovers.length > 0) {
          const nextIds = nextApprovers.map((a) => a.wfamsd_id);
          await escalateWorkflow(
            workflow.wfamsd_id,
            nextIds,
            workflow.wfamsh_id,
            orgId
          );

          const stepDeadline = workflow.step_deadline
            ? new Date(workflow.step_deadline).toLocaleDateString()
            : (workflow.cutoff_date_fallback && new Date(workflow.cutoff_date_fallback).toLocaleDateString()) || '-';

          for (const nextApprover of nextApprovers) {
            if (nextApprover.user_email) {
              try {
                await sendEmail({
                  to: nextApprover.user_email,
                  subject: `Urgent: Maintenance Approval Required - ${workflow.asset_type_name}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2 style="color: #d32f2f;">🚨 Urgent: Workflow Escalation</h2>
                      <p>Dear ${nextApprover.user_name},</p>
                      <p>This maintenance workflow has been escalated to you because the current approver did not complete approval within the allowed time (step deadline).</p>
                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> This workflow now requires approval from BOTH you AND the previous approver (${workflow.user_name}). Both approvals are needed for the workflow to proceed.</p>
                      </div>
                      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Asset Type:</strong> ${workflow.asset_type_name}</p>
                        <p><strong>Asset ID:</strong> ${workflow.asset_id}</p>
                        <p><strong>Workflow ID:</strong> ${workflow.wfamsh_id}</p>
                        <p><strong>Due Date:</strong> ${workflow.due_date ? new Date(workflow.due_date).toLocaleDateString() : '-'}</p>
                        <p><strong>Step deadline exceeded:</strong> ${stepDeadline}</p>
                        <p><strong>Also Pending Approval From:</strong> ${workflow.user_name}</p>
                      </div>
                      <p style="color: #d32f2f;"><strong>Action Required:</strong> Please review and approve this maintenance workflow as soon as possible.</p>
                      <p>
                        <a href="${process.env.FRONTEND_URL || ''}/approval-detail/${workflow.wfamsh_id}"
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

            try {
              const notificationIntegrationService = require('../services/notificationIntegrationService');
              await notificationIntegrationService.notifyWorkflowEscalated(
                {
                  workflowId: workflow.wfamsh_id,
                  assetTypeName: workflow.asset_type_name
                },
                nextApprover.job_role_id
              );
            } catch (notifyErr) {
              console.error('Error sending push notification:', notifyErr);
            }
          }

          escalationResults.escalated++;
          escalationResults.details.push({
            wfamshId: workflow.wfamsh_id,
            assetId: workflow.asset_id,
            fromUser: workflow.user_name,
            toUsers: nextApprovers.map((a) => a.user_name).filter(Boolean),
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

/**
 * Get all workflow steps with esc_no_days for an org (for status/verification).
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array<{ wf_steps_id, text, esc_no_days }>>}
 */
const getWorkflowStepsWithEscDays = async (orgId) => {
  const query = `
    SELECT wf_steps_id, text, esc_no_days
    FROM "tblWFSteps"
    WHERE org_id = $1
    ORDER BY text
  `;
  const result = await getDb().query(query, [orgId]);
  return result.rows;
};

module.exports = {
  getOverdueWorkflows,
  getNextApprover,
  getNextApprovers,
  escalateWorkflow,
  processWorkflowEscalations,
  getWorkflowStepsWithEscDays,
  parseLeadDays,
  DEFAULT_LEAD_DAYS
};
