const crypto = require('crypto');
const { getDbFromContext } = require('../utils/dbContext');
const { ensureWhatsAppSchema } = require('../utils/ensureWhatsAppSchema');
const { normalizeWhatsAppPhone } = require('../utils/whatsappPhone');
const { collectUserJobRoleIds, userHasSystemAdminRole } = require('../utils/systemAdmin');
const { getUserRoles } = require('../models/userJobRoleModel');
const inspectionApprovalModel = require('../models/inspectionApprovalModel');
const workflowNotificationService = require('./workflowNotificationService');
const whatsappCloud = require('./whatsappCloudService');

function getDb() {
  return getDbFromContext();
}

function newId(prefix) {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`.slice(0, 24).toUpperCase();
}

function parseActionPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  const tokenMatch = text.match(/^(APPROVE|DENY|REJECT)[:\s-]+([A-Za-z0-9]+)$/i);
  if (tokenMatch) {
    return {
      action: tokenMatch[1].toUpperCase() === 'APPROVE' ? 'APPROVE' : 'REJECT',
      token: tokenMatch[2],
    };
  }
  if (upper === 'APPROVE' || upper === 'YES' || upper === 'OK') {
    return { action: 'APPROVE', token: null };
  }
  if (upper === 'DENY' || upper === 'REJECT' || upper === 'NO') {
    return { action: 'REJECT', token: null };
  }
  return null;
}

async function recordInbound({ userId, orgId, phone, wamid, body, payload }) {
  const dbPool = getDb();
  await dbPool.query(
    `INSERT INTO "tblWhatsAppMessages" (
        message_id, user_id, org_id, direction, phone, notification_type,
        title, body, payload, wamid, status
     ) VALUES ($1,$2,$3,'in',$4,'incoming_reply','WhatsApp reply',$5,$6,$7,'received')`,
    [
      newId('WAM'),
      userId || null,
      orgId || null,
      phone,
      body || null,
      payload ? JSON.stringify(payload) : null,
      wamid || null,
    ],
  );
}

async function claimEvent(wamid, eventType, phone, payload) {
  if (!wamid) return true;
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  try {
    const inserted = await dbPool.query(
      `INSERT INTO "tblWhatsAppEvents" (event_id, wamid, event_type, phone, payload, processed)
       VALUES ($1,$2,$3,$4,$5,false)
       ON CONFLICT (wamid, event_type) DO NOTHING
       RETURNING event_id`,
      [newId('WAE'), wamid, eventType, phone || null, payload ? JSON.stringify(payload) : null],
    );
    return inserted.rows.length > 0;
  } catch (err) {
    if (err.code === '23505') return false;
    throw err;
  }
}

async function markEventProcessed(wamid, eventType) {
  if (!wamid) return;
  await getDb().query(
    `UPDATE "tblWhatsAppEvents" SET processed = true WHERE wamid = $1 AND event_type = $2`,
    [wamid, eventType],
  );
}

async function updateDeliveryStatus(wamid, status) {
  if (!wamid) return;
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  await dbPool.query(
    `UPDATE "tblWhatsAppMessages"
     SET status = $1, updated_on = CURRENT_TIMESTAMP
     WHERE wamid = $2`,
    [status, wamid],
  );
}

async function findUserByPhone(phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  const result = await dbPool.query(
    `SELECT user_id, org_id, emp_int_id, full_name, phone, job_role_id,
            whatsapp_phone, whatsapp_opted_in
     FROM "tblUsers"
     WHERE whatsapp_phone = $1 AND int_status = 1
     LIMIT 1`,
    [normalized],
  );
  return result.rows[0] || null;
}

async function loadPendingApproval({ token, userId }) {
  const dbPool = getDb();
  if (token) {
    const byToken = await dbPool.query(
      `SELECT * FROM "tblWhatsAppApprovals" WHERE token = $1 LIMIT 1`,
      [token],
    );
    return byToken.rows[0] || null;
  }
  const latest = await dbPool.query(
    `SELECT * FROM "tblWhatsAppApprovals"
     WHERE user_id = $1 AND status = 'pending' AND expires_on > CURRENT_TIMESTAMP
     ORDER BY created_on DESC
     LIMIT 1`,
    [userId],
  );
  return latest.rows[0] || null;
}

async function applyInspectionAction({ orgId, user, approval, action, comments }) {
  const wfaiisdId = approval.wfaiisd_id;
  if (!wfaiisdId) throw new Error('Inspection approval is missing the workflow step');

  const step = await inspectionApprovalModel.getWorkflowStepById(orgId, wfaiisdId);
  if (!step) throw new Error('Inspection workflow step not found');
  if (step.status !== 'AP') {
    throw new Error(`This inspection is no longer waiting for approval (status ${step.status})`);
  }

  const roles = await getUserRoles(user.user_id);
  const actor = { ...user, roles, job_role_id: user.job_role_id };
  const canAct =
    userHasSystemAdminRole(actor) ||
    (step.job_role_id && collectUserJobRoleIds(actor).includes(step.job_role_id));
  if (!canAct) {
    throw new Error('You do not have the required role to act on this inspection');
  }

  const userId = user.user_id;
  if (action === 'APPROVE') {
    await inspectionApprovalModel.updateWorkflowStepStatus(orgId, wfaiisdId, 'UA', userId, comments);
    await inspectionApprovalModel.createWorkflowHistory({
      wfaiish_id: step.wfaiish_id,
      wfaiisd_id: wfaiisdId,
      action: 'UA',
      action_by: userId,
      notes: comments || 'Approved via WhatsApp',
      org_id: orgId,
    });
    const nextStep = await inspectionApprovalModel.getNextWorkflowStep(orgId, step.wfaiish_id, step.sequence);
    if (nextStep) {
      await inspectionApprovalModel.updateWorkflowStepStatus(
        orgId,
        nextStep.wfaiisd_id,
        'AP',
        'SYSTEM',
        'Activated by previous WhatsApp approval',
      );
      await workflowNotificationService.notifyNewInspectionDetail({
        wfaiisd_id: nextStep.wfaiisd_id,
        wfaiish_id: step.wfaiish_id,
        job_role_id: nextStep.job_role_id,
        status: 'AP',
        sequence: nextStep.sequence,
        org_id: orgId,
      });
      return 'Inspection approved. Next approver notified.';
    }
    const completed = await inspectionApprovalModel.createCompletedInspectionRecord(
      orgId,
      step.wfaiish_id,
      userId,
      null,
    );
    try {
      await workflowNotificationService.notifyInspectionDue({
        ais_id: completed?.ais_id,
        emp_int_id: completed?.emp_int_id || completed?.inspected_by,
        asset_id: completed?.asset_id,
        org_id: orgId,
      });
    } catch (notifyErr) {
      console.error('Failed to send inspection due after WhatsApp approval:', notifyErr.message);
    }
    await inspectionApprovalModel.updateHeaderStatus(orgId, step.wfaiish_id, 'CO', userId);
    await inspectionApprovalModel.createWorkflowHistory({
      wfaiish_id: step.wfaiish_id,
      wfaiisd_id: step.wfaiisd_id,
      action: 'CO',
      action_by: 'SYSTEM',
      notes: 'Workflow completed via WhatsApp',
      org_id: orgId,
    });
    return 'Inspection approved and recorded.';
  }

  await inspectionApprovalModel.updateWorkflowStepStatus(orgId, wfaiisdId, 'UR', userId, comments);
  await inspectionApprovalModel.createWorkflowHistory({
    wfaiish_id: step.wfaiish_id,
    wfaiisd_id: wfaiisdId,
    action: 'UR',
    action_by: userId,
    notes: comments || 'Rejected via WhatsApp',
    org_id: orgId,
  });
  const previousStep = await inspectionApprovalModel.getPreviousApprovedValues(
    orgId,
    step.wfaiish_id,
    step.sequence,
  );
  if (previousStep) {
    await inspectionApprovalModel.updateWorkflowStepStatus(
      orgId,
      previousStep.wfaiisd_id,
      'AP',
      userId,
      'Reverted due to WhatsApp rejection',
    );
    await workflowNotificationService.notifyInspectionRejectionReverted({
      wfaiisd_id: previousStep.wfaiisd_id,
      wfaiish_id: step.wfaiish_id,
      job_role_id: previousStep.job_role_id,
      org_id: orgId,
      rejection_reason: comments || 'Rejected via WhatsApp',
    });
    return 'Inspection sent back to the previous approver.';
  }
  await inspectionApprovalModel.updateHeaderStatus(orgId, step.wfaiish_id, 'RE', userId);
  return 'Inspection rejected.';
}

async function applyMaintenanceAction({ orgId, user, approval, action, comments }) {
  const { approveMaintenance, rejectMaintenance } = require('../models/approvalDetailModel');
  const targetId = approval.wfamsh_id || approval.asset_id;
  if (!targetId) throw new Error('Maintenance approval is missing the workflow id');
  if (!user.emp_int_id) throw new Error('Your user record is missing an employee id');

  if (action === 'APPROVE') {
    const result = await approveMaintenance(
      targetId,
      user.emp_int_id,
      comments || 'Approved via WhatsApp',
      orgId,
      null,
      null,
      user.user_id,
      null,
    );
    if (!result?.success) {
      throw new Error(result?.message || 'Maintenance approval failed');
    }
    return result.message || 'Maintenance approved.';
  }

  const result = await rejectMaintenance(
    targetId,
    user.emp_int_id,
    comments || 'Rejected via WhatsApp',
    orgId,
  );
  if (result && result.success === false) {
    throw new Error(result.message || 'Maintenance rejection failed');
  }
  return result?.message || 'Maintenance rejected.';
}

async function applyApproval({ user, parsed, comments }) {
  const approval = await loadPendingApproval({ token: parsed.token, userId: user.user_id });
  if (!approval) throw new Error('No pending WhatsApp approval was found');
  if (approval.user_id && approval.user_id !== user.user_id) {
    throw new Error('This approval belongs to a different user');
  }
  if (approval.status !== 'pending') {
    throw new Error(`This approval was already ${approval.status}`);
  }
  if (approval.expires_on && new Date(approval.expires_on) < new Date()) {
    await getDb().query(
      `UPDATE "tblWhatsAppApprovals" SET status = 'expired' WHERE token = $1 AND status = 'pending'`,
      [approval.token],
    );
    throw new Error('This approval link has expired. Open the app to act on it.');
  }

  const orgId = approval.org_id || user.org_id;
  let message;
  if (approval.kind === 'inspection') {
    message = await applyInspectionAction({
      orgId,
      user,
      approval,
      action: parsed.action,
      comments,
    });
  } else {
    message = await applyMaintenanceAction({
      orgId,
      user,
      approval,
      action: parsed.action,
      comments,
    });
  }

  await getDb().query(
    `UPDATE "tblWhatsAppApprovals"
     SET status = $1, result_message = $2, acted_on = CURRENT_TIMESTAMP
     WHERE token = $3`,
    [parsed.action === 'APPROVE' ? 'approved' : 'rejected', message, approval.token],
  );
  return message;
}

async function handleIncomingMessage({ from, wamid, type, text, buttonPayload, interactiveId }) {
  const phone = normalizeWhatsAppPhone(from);
  const raw = buttonPayload || interactiveId || text || '';
  const parsed = parseActionPayload(raw);

  const user = await findUserByPhone(phone);
  await recordInbound({
    userId: user?.user_id,
    orgId: user?.org_id,
    phone,
    wamid,
    body: raw,
    payload: { type, text, buttonPayload, interactiveId },
  });

  if (!parsed) {
    return { handled: false, reason: 'Not an approve/deny reply' };
  }
  if (!user) {
    await whatsappCloud.sendTextMessage({
      to: phone,
      body: 'This WhatsApp number is not linked to an Asset Lifecycle user. Open the mobile app → Notification Settings to register it.',
    });
    return { handled: false, reason: 'Unknown WhatsApp number' };
  }
  if (!user.whatsapp_opted_in) {
    await whatsappCloud.sendTextMessage({
      to: phone,
      body: 'WhatsApp approvals are turned off for this account. Enable them in the mobile app first.',
    });
    return { handled: false, reason: 'Not opted in' };
  }

  try {
    const message = await applyApproval({
      user,
      parsed,
      comments: `${parsed.action} via WhatsApp`,
    });
    await whatsappCloud.sendTextMessage({ to: phone, body: message });
    return { handled: true, message };
  } catch (error) {
    console.error('[WhatsApp] approval failed:', error.message);
    await whatsappCloud.sendTextMessage({
      to: phone,
      body: `Could not complete that action: ${error.message}`,
    });
    return { handled: false, reason: error.message };
  }
}

module.exports = {
  parseActionPayload,
  claimEvent,
  markEventProcessed,
  updateDeliveryStatus,
  handleIncomingMessage,
  findUserByPhone,
};
