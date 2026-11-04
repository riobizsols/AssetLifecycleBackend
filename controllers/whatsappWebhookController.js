const { runWithDb } = require('../utils/dbContext');
const { runWithTenantContext } = require('../utils/tenantRequestContext');
const { getTenantPool } = require('../services/tenantService');
const { getTenantFromWhatsAppPhone } = require('../services/tenantWhatsAppRegistryService');
const { ensureWhatsAppSchema } = require('../utils/ensureWhatsAppSchema');
const whatsappCloud = require('../services/whatsappCloudService');
const whatsappApprovalService = require('../services/whatsappApprovalService');

async function verify(req, res) {
  const result = whatsappCloud.verifyWebhookChallenge(req.query || {});
  if (!result.ok) {
    return res.status(403).send('Forbidden');
  }
  return res.status(200).send(result.challenge);
}

function extractInbound(changeValue = {}) {
  const messages = Array.isArray(changeValue.messages) ? changeValue.messages : [];
  return messages.map((message) => {
    const interactive = message.interactive || {};
    const buttonReply = interactive.button_reply || interactive.list_reply || {};
    return {
      from: message.from,
      wamid: message.id,
      type: message.type,
      text: message.text?.body || message.button?.text || '',
      buttonPayload: message.button?.payload || null,
      interactiveId: buttonReply.id || null,
    };
  });
}

async function withTenantForPhone(phone, fn) {
  const mapping = await getTenantFromWhatsAppPhone(phone);
  if (!mapping?.org_id) return { mapped: false };
  const pool = await getTenantPool(mapping.org_id);
  await ensureWhatsAppSchema(pool);
  const result = await runWithDb(pool, () =>
    runWithTenantContext(
      { registryOrgId: mapping.org_id, subdomain: mapping.subdomain },
      fn,
    ),
  );
  return { mapped: true, result };
}

async function receive(req, res) {
  const signature = req.get('x-hub-signature-256') || req.get('X-Hub-Signature-256');
  if (!whatsappCloud.validateMetaSignature(req.rawBody, signature)) {
    return res.status(403).json({ success: false, message: 'Invalid Meta signature' });
  }

  res.status(200).json({ success: true });

  const body = req.body || {};
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change.value || {};

      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        try {
          await withTenantForPhone(status.recipient_id, async () => {
            const isNew = await whatsappApprovalService.claimEvent(
              status.id,
              `status:${status.status}`,
              status.recipient_id,
              status,
            );
            if (isNew) {
              await whatsappApprovalService.updateDeliveryStatus(status.id, status.status);
            }
          });
        } catch (err) {
          console.error('[WhatsApp webhook] status error:', err.message);
        }
      }

      for (const inbound of extractInbound(value)) {
        try {
          const scoped = await withTenantForPhone(inbound.from, async () => {
            const isNew = await whatsappApprovalService.claimEvent(
              inbound.wamid,
              'message',
              inbound.from,
              inbound,
            );
            if (!isNew) return { duplicate: true };
            const result = await whatsappApprovalService.handleIncomingMessage(inbound);
            if (inbound.wamid) {
              await whatsappCloud.markMessageRead(inbound.wamid).catch(() => {});
              await whatsappApprovalService.markEventProcessed(inbound.wamid, 'message');
            }
            return result;
          });
          if (!scoped.mapped) {
            await whatsappCloud.sendTextMessage({
              to: inbound.from,
              body: 'This WhatsApp number is not linked yet. Open Asset Lifecycle on mobile → Notification Settings and save your WhatsApp number.',
            }).catch(() => {});
          }
        } catch (err) {
          console.error('[WhatsApp webhook] inbound error:', err.message);
        }
      }
    }
  }
}

module.exports = {
  verify,
  receive,
};
