const crypto = require('crypto');
const { normalizeWhatsAppPhone } = require('../utils/whatsappPhone');

function graphVersion() {
  return process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
}

function isConfigured() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    String(process.env.WHATSAPP_ENABLED || 'true').toLowerCase() !== 'false'
  );
}

function getConfigStatus() {
  return {
    enabled: String(process.env.WHATSAPP_ENABLED || 'true').toLowerCase() !== 'false',
    configured: isConfigured(),
    phoneNumberIdSet: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    wabaIdSet: Boolean(process.env.WHATSAPP_WABA_ID),
    accessTokenSet: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    appSecretSet: Boolean(process.env.WHATSAPP_APP_SECRET),
    webhookVerifyTokenSet: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    templateNotification: process.env.WHATSAPP_TEMPLATE_NOTIFICATION || 'alm_notification',
    templateApproval: process.env.WHATSAPP_TEMPLATE_APPROVAL || 'alm_workflow_approval',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en',
  };
}

function verifyWebhookChallenge(query = {}) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected) {
    return { ok: true, challenge: String(challenge || '') };
  }
  return { ok: false };
}

function validateMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn('[WhatsApp] WHATSAPP_APP_SECRET is not set — skipping signature validation');
    return true;
  }
  if (!rawBody || !signatureHeader) return false;
  const provided = String(signatureHeader).replace(/^sha256=/i, '').trim();
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  const providedBuf = Buffer.from(provided, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

async function graphPost(path, body) {
  if (!isConfigured()) {
    return { success: false, reason: 'WhatsApp Cloud API is not configured' };
  }
  const url = `https://graph.facebook.com/${graphVersion()}/${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    const message = json.error?.message || `WhatsApp API HTTP ${response.status}`;
    return { success: false, status: response.status, error: json.error || json, message };
  }
  return { success: true, data: json };
}

function textParams(values) {
  return (values || []).map((value) => ({
    type: 'text',
    text: String(value == null || value === '' ? '-' : value).slice(0, 1024),
  }));
}

async function sendTemplateMessage({ to, templateName, languageCode, bodyParams = [], buttonPayloads = [] }) {
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) return { success: false, reason: 'Invalid WhatsApp phone number' };

  const components = [];
  if (bodyParams.length) {
    components.push({ type: 'body', parameters: textParams(bodyParams) });
  }
  buttonPayloads.forEach((payload, index) => {
    components.push({
      type: 'button',
      sub_type: 'quick_reply',
      index: String(index),
      parameters: [{ type: 'payload', payload: String(payload).slice(0, 256) }],
    });
  });

  return graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
      components,
    },
  });
}

async function sendTextMessage({ to, body }) {
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) return { success: false, reason: 'Invalid WhatsApp phone number' };
  return graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { preview_url: false, body: String(body || '').slice(0, 4096) },
  });
}

async function sendInteractiveButtons({ to, body, buttons }) {
  const phone = normalizeWhatsAppPhone(to);
  if (!phone) return { success: false, reason: 'Invalid WhatsApp phone number' };
  return graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(body || '').slice(0, 1024) },
      action: {
        buttons: (buttons || []).slice(0, 3).map((button) => ({
          type: 'reply',
          reply: {
            id: String(button.id).slice(0, 256),
            title: String(button.title).slice(0, 20),
          },
        })),
      },
    },
  });
}

async function markMessageRead(wamid) {
  if (!wamid || !isConfigured()) return { success: false };
  return graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: wamid,
  });
}

module.exports = {
  isConfigured,
  getConfigStatus,
  verifyWebhookChallenge,
  validateMetaSignature,
  sendTemplateMessage,
  sendTextMessage,
  sendInteractiveButtons,
  markMessageRead,
};
