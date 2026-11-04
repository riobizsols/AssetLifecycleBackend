const { getTenantContext } = require('../utils/tenantRequestContext');
const { maskWhatsAppPhone } = require('../utils/whatsappPhone');
const whatsappCloud = require('../services/whatsappCloudService');
const whatsappNotificationService = require('../services/whatsappNotificationService');

function currentUserId(req) {
  return req.user?.user_id || null;
}

async function getStatus(req, res) {
  try {
    const userId = currentUserId(req);
    const profile = userId
      ? await whatsappNotificationService.getUserWhatsAppProfile(userId)
      : null;
    return res.json({
      success: true,
      data: {
        cloud: whatsappCloud.getConfigStatus(),
        profile: profile
          ? {
              phone: profile.whatsapp_phone || '',
              phoneMasked: maskWhatsAppPhone(profile.whatsapp_phone),
              optedIn: !!profile.whatsapp_opted_in,
              optedOn: profile.whatsapp_opted_on,
              fallbackPhone: profile.phone || '',
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[WhatsApp] getStatus:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }
    const ctx = getTenantContext() || {};
    const row = await whatsappNotificationService.upsertProfile({
      userId,
      orgId: req.user?.org_id || ctx.registryOrgId,
      phone: req.body?.phone,
      optedIn: req.body?.optedIn,
    });
    return res.json({
      success: true,
      message: row.whatsapp_opted_in
        ? 'WhatsApp notifications enabled'
        : 'WhatsApp notifications disabled',
      data: {
        phone: row.whatsapp_phone || '',
        phoneMasked: maskWhatsAppPhone(row.whatsapp_phone),
        optedIn: !!row.whatsapp_opted_in,
        optedOn: row.whatsapp_opted_on,
      },
    });
  } catch (error) {
    console.error('[WhatsApp] updateProfile:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
}

async function sendTest(req, res) {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }
    const result = await whatsappNotificationService.sendToUser({
      userId,
      title: req.body?.title || 'Test WhatsApp notification',
      body: req.body?.body || 'WhatsApp is connected to Asset Lifecycle. You will receive maintenance and approval alerts here.',
      data: { type: 'test' },
      notificationType: 'test_notification',
    });
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason || result.error || 'Failed to send WhatsApp test',
        data: result,
      });
    }
    return res.json({
      success: true,
      message: 'WhatsApp test message sent',
      data: result,
    });
  } catch (error) {
    console.error('[WhatsApp] sendTest:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function listMessages(req, res) {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User authentication required' });
    }
    const rows = await whatsappNotificationService.listMessages(userId, req.query?.limit);
    return res.json({ success: true, data: { messages: rows } });
  } catch (error) {
    console.error('[WhatsApp] listMessages:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getStatus,
  updateProfile,
  sendTest,
  listMessages,
};
