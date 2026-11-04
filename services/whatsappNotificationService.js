const crypto = require('crypto');
const { getDbFromContext } = require('../utils/dbContext');
const { ensureWhatsAppSchema } = require('../utils/ensureWhatsAppSchema');
const { normalizeWhatsAppPhone, maskWhatsAppPhone } = require('../utils/whatsappPhone');
const whatsappCloud = require('./whatsappCloudService');
const { registerFromRequestContext } = require('./tenantWhatsAppRegistryService');

const APPROVAL_TYPES = new Set([
  'workflow_approval',
  'breakdown_approval',
  'workflow_rejection_reverted',
  'inspection_approval',
]);

const MAINTENANCE_KINDS = new Set([
  'workflow_approval',
  'breakdown_approval',
  'workflow_rejection_reverted',
]);

function getDb() {
  return getDbFromContext();
}

function newId(prefix) {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`.slice(0, 24).toUpperCase();
}

function approvalKind(notificationType) {
  if (notificationType === 'inspection_approval') return 'inspection';
  if (MAINTENANCE_KINDS.has(notificationType)) return 'maintenance';
  return null;
}

async function getUserWhatsAppProfile(userId) {
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  const result = await dbPool.query(
    `SELECT user_id, org_id, emp_int_id, full_name, phone, email,
            whatsapp_phone, whatsapp_opted_in, whatsapp_opted_on
     FROM "tblUsers"
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function isWhatsAppEnabledForType(userId, notificationType) {
  const type = notificationType || 'general';
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  const existing = await dbPool.query(
    `SELECT is_enabled, whatsapp_enabled FROM "tblNotificationPreferences"
     WHERE user_id = $1 AND notification_type = $2`,
    [userId, type],
  );
  if (!existing.rows.length) {
    await dbPool.query(
      `INSERT INTO "tblNotificationPreferences" (
          preference_id, user_id, notification_type,
          is_enabled, email_enabled, push_enabled, whatsapp_enabled
       ) VALUES ($1, $2, $3, true, true, true, true)`,
      [newId('PREF'), userId, type],
    );
    return true;
  }
  const row = existing.rows[0];
  if (row.is_enabled === false) return false;
  return row.whatsapp_enabled !== false;
}

async function logMessage(row) {
  const dbPool = getDb();
  await dbPool.query(
    `INSERT INTO "tblWhatsAppMessages" (
        message_id, user_id, org_id, direction, phone, notification_type,
        title, body, payload, wamid, template_name, status, error_message
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      row.messageId,
      row.userId || null,
      row.orgId || null,
      row.direction || 'out',
      row.phone,
      row.notificationType || null,
      row.title || null,
      row.body || null,
      row.payload ? JSON.stringify(row.payload) : null,
      row.wamid || null,
      row.templateName || null,
      row.status || 'queued',
      row.errorMessage || null,
    ],
  );
}

async function createApprovalToken({ userId, orgId, notificationType, data = {} }) {
  const kind = approvalKind(notificationType);
  if (!kind) return null;
  const token = crypto.randomBytes(12).toString('hex');
  const hours = Number(process.env.WHATSAPP_APPROVAL_TTL_HOURS || 72);
  const dbPool = getDb();
  await dbPool.query(
    `INSERT INTO "tblWhatsAppApprovals" (
        token, user_id, org_id, kind, notification_type,
        wfamsh_id, wfamsd_id, wfaiish_id, wfaiisd_id,
        asset_id, asset_name, status, expires_on
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending', CURRENT_TIMESTAMP + ($12::text || ' hours')::interval)`,
    [
      token,
      userId,
      orgId,
      kind,
      notificationType,
      data.wfamsh_id || null,
      data.wfamsd_id || null,
      data.wfaiish_id || null,
      data.wfaiisd_id || null,
      data.asset_id || null,
      data.asset_name || null,
      Number.isFinite(hours) && hours > 0 ? hours : 72,
    ],
  );
  return token;
}

async function sendToUser({ userId, title, body, data = {}, notificationType }) {
  try {
    if (!userId) return { success: false, reason: 'userId required' };
    if (!whatsappCloud.isConfigured()) {
      return { success: false, reason: 'WhatsApp Cloud API is not configured' };
    }

    const profile = await getUserWhatsAppProfile(userId);
    if (!profile) return { success: false, reason: 'User not found' };
    if (!profile.whatsapp_opted_in) {
      return { success: false, reason: 'WhatsApp not opted in' };
    }

    const phone = normalizeWhatsAppPhone(profile.whatsapp_phone || profile.phone);
    if (!phone) return { success: false, reason: 'No WhatsApp number on file' };

    const enabled = await isWhatsAppEnabledForType(userId, notificationType);
    if (!enabled) return { success: false, reason: 'WhatsApp disabled for this notification type' };

    const messageTitle = title || 'Asset Lifecycle';
    const messageBody = body || '';
    const isApproval = APPROVAL_TYPES.has(notificationType);
    let token = null;
    if (isApproval) {
      token = await createApprovalToken({
        userId,
        orgId: profile.org_id,
        notificationType,
        data,
      });
    }

    const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
    let result;
    let templateName = null;

    if (isApproval && token) {
      templateName = process.env.WHATSAPP_TEMPLATE_APPROVAL || 'alm_workflow_approval';
      result = await whatsappCloud.sendTemplateMessage({
        to: phone,
        templateName,
        languageCode: templateLang,
        bodyParams: [data.asset_name || messageTitle, messageBody],
        buttonPayloads: [`APPROVE:${token}`, `DENY:${token}`],
      });
      if (!result.success) {
        result = await whatsappCloud.sendInteractiveButtons({
          to: phone,
          body: `${messageTitle}\n\n${messageBody}`,
          buttons: [
            { id: `APPROVE:${token}`, title: 'Approve' },
            { id: `DENY:${token}`, title: 'Deny' },
          ],
        });
        templateName = result.success ? null : templateName;
      }
      if (!result.success) {
        result = await whatsappCloud.sendTextMessage({
          to: phone,
          body: `${messageTitle}\n\n${messageBody}\n\nReply APPROVE or DENY.`,
        });
      }
    } else {
      templateName = process.env.WHATSAPP_TEMPLATE_NOTIFICATION || 'alm_notification';
      result = await whatsappCloud.sendTemplateMessage({
        to: phone,
        templateName,
        languageCode: templateLang,
        bodyParams: [messageTitle, messageBody],
      });
      if (!result.success) {
        result = await whatsappCloud.sendTextMessage({
          to: phone,
          body: `${messageTitle}\n\n${messageBody}`,
        });
        templateName = result.success ? null : templateName;
      }
    }

    const wamid = result.data?.messages?.[0]?.id || null;
    await logMessage({
      messageId: newId('WAM'),
      userId,
      orgId: profile.org_id,
      direction: 'out',
      phone,
      notificationType,
      title: messageTitle,
      body: messageBody,
      payload: { data, token },
      wamid,
      templateName,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.success ? null : (result.message || result.reason),
    });

    if (result.success) {
      console.log(`[WhatsApp] Sent ${notificationType || 'general'} to ${maskWhatsAppPhone(phone)} (${userId})`);
    } else {
      console.warn(`[WhatsApp] Send failed for ${userId}: ${result.message || result.reason}`);
    }

    return {
      success: !!result.success,
      wamid,
      phone: maskWhatsAppPhone(phone),
      approvalToken: token,
      error: result.success ? null : (result.message || result.reason),
    };
  } catch (error) {
    console.error('[WhatsApp] sendToUser error:', error.message);
    return { success: false, reason: error.message };
  }
}

async function upsertProfile({ userId, orgId, phone, optedIn }) {
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  const current = await getUserWhatsAppProfile(userId);
  if (!current) throw new Error('User not found');

  const nextPhone = phone === undefined
    ? current.whatsapp_phone
    : (phone ? normalizeWhatsAppPhone(phone) : null);
  if (phone && !nextPhone) {
    throw new Error('Enter a valid WhatsApp number with country code');
  }
  const nextOptedIn = optedIn === undefined ? !!current.whatsapp_opted_in : !!optedIn;
  if (nextOptedIn && !nextPhone) {
    throw new Error('Save a WhatsApp number before enabling notifications');
  }

  const result = await dbPool.query(
    `UPDATE "tblUsers"
     SET whatsapp_phone = $1,
         whatsapp_opted_in = $2,
         whatsapp_opted_on = CASE
           WHEN $2 = true AND COALESCE(whatsapp_opted_in, false) = false THEN CURRENT_TIMESTAMP
           WHEN $2 = false THEN NULL
           ELSE whatsapp_opted_on
         END
     WHERE user_id = $3
     RETURNING user_id, org_id, phone, whatsapp_phone, whatsapp_opted_in, whatsapp_opted_on`,
    [nextPhone, nextOptedIn, userId],
  );

  const row = result.rows[0];
  if (nextOptedIn && nextPhone) {
    await registerFromRequestContext({
      phone: nextPhone,
      userId,
      orgId: orgId || row.org_id,
    });
  } else {
    const { unregisterTenantWhatsApp } = require('./tenantWhatsAppRegistryService');
    await unregisterTenantWhatsApp({
      phone: current.whatsapp_phone || nextPhone,
      userId,
      orgId: orgId || row.org_id,
    });
  }
  return row;
}

async function listMessages(userId, limit = 20) {
  const dbPool = getDb();
  await ensureWhatsAppSchema(dbPool);
  const result = await dbPool.query(
    `SELECT message_id, direction, notification_type, title, body, status, created_on, wamid
     FROM "tblWhatsAppMessages"
     WHERE user_id = $1
     ORDER BY created_on DESC
     LIMIT $2`,
    [userId, Math.min(Number(limit) || 20, 100)],
  );
  return result.rows;
}

module.exports = {
  APPROVAL_TYPES,
  sendToUser,
  getUserWhatsAppProfile,
  upsertProfile,
  listMessages,
  isWhatsAppEnabledForType,
};
