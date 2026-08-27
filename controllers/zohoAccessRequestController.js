/**
 * Zoho access requests:
 * - Public create (Zoho claim)
 * - Company ops list/approve/reject (ACCESS_REQUEST_OPS_PASSWORD) — not tenant JR001
 */
const { verifyZohoAccessClaim } = require('../utils/zohoAccessClaim');
const {
  getOpsPassword,
  isOpsConfigured,
  createOpsToken,
  verifyOpsToken,
  getNotifyEmails,
} = require('../utils/accessRequestApprovers');
const {
  createAccessRequest,
  listAccessRequests,
  getAccessRequestById,
  markAccessRequestApproved,
  markAccessRequestRejected,
} = require('../models/zohoAccessRequestModel');
const { createTenant, buildSubdomainUrl } = require('../services/tenantSetupService');
const { validateSubdomain } = require('../utils/subdomainUtils');
const {
  sendAccessRequestNotifyEmail,
  sendOrgProvisionedForZohoEmail,
} = require('../services/emailService');
const logger = require('../utils/logger');

const extractOpsToken = (req) => {
  const hdr = req.headers.authorization || req.headers['x-access-request-ops-token'] || '';
  if (typeof hdr === 'string' && hdr.toLowerCase().startsWith('bearer ')) {
    return hdr.slice(7).trim();
  }
  return String(hdr || req.body?.opsToken || req.query?.opsToken || '').trim();
};

const requireOps = (req, res) => {
  if (!isOpsConfigured()) {
    res.status(503).json({
      message:
        'Ops approve screen is not configured. Set ACCESS_REQUEST_OPS_PASSWORD on the server.',
    });
    return false;
  }
  if (!verifyOpsToken(extractOpsToken(req))) {
    res.status(401).json({ message: 'Ops login required' });
    return false;
  }
  return true;
};

const opsLogin = async (req, res) => {
  try {
    if (!isOpsConfigured()) {
      return res.status(503).json({
        message: 'Set ACCESS_REQUEST_OPS_PASSWORD in server env before using this screen.',
      });
    }
    const password = String(req.body?.password || '');
    if (!password || password !== getOpsPassword()) {
      return res.status(401).json({ message: 'Invalid ops password' });
    }
    return res.json({
      token: createOpsToken(),
      message: 'Ops session started',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Ops login failed' });
  }
};

const getClaimPreview = async (req, res) => {
  try {
    const claim = String(req.query.claim || req.body?.claim || '').trim();
    const verified = verifyZohoAccessClaim(claim);
    return res.json({
      email: verified.email,
      fullName: verified.fullName,
    });
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message });
  }
};

const submitAccessRequest = async (req, res) => {
  try {
    const {
      claim,
      companyName,
      subdomain,
      orgId,
      orgCity,
      phone,
      notes,
      fullName,
    } = req.body || {};

    const verified = verifyZohoAccessClaim(String(claim || '').trim());
    let normalizedSubdomain;
    try {
      normalizedSubdomain = validateSubdomain(subdomain);
    } catch (e) {
      return res.status(400).json({ message: e.message || 'Invalid subdomain' });
    }

    const row = await createAccessRequest({
      email: verified.email,
      fullName: fullName || verified.fullName,
      companyName,
      subdomain: normalizedSubdomain,
      orgId,
      orgCity,
      phone,
      notes,
    });

    const notifyTo = getNotifyEmails();
    if (notifyTo.length) {
      const platform = String(
        process.env.SSO_PLATFORM_FRONTEND_URL ||
          process.env.FRONTEND_URL ||
          `https://${process.env.MAIN_DOMAIN || 'rioassetmanagement.net'}`
      ).replace(/\/$/, '');
      sendAccessRequestNotifyEmail({
        to: notifyTo,
        request: row,
        approveUrl: `${platform}/ops/access-requests`,
      }).catch((e) => logger.warn('[AccessRequest] notify email failed:', e.message));
    } else {
      logger.warn(
        '[AccessRequest] Set ACCESS_REQUEST_NOTIFY_EMAILS to get notified of new requests'
      );
    }

    return res.status(201).json({
      message:
        'Access request submitted. We will email you when your organization is ready. Then open RIO EAM from Zoho to sign in.',
      request: {
        id: row.id,
        email: row.email_normalized,
        companyName: row.company_name,
        subdomain: row.subdomain,
        status: row.status,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    logger.warn('[AccessRequest] submit failed:', err.message);
    return res.status(status).json({
      message: err.message || 'Could not submit access request',
      requestId: err.requestId,
    });
  }
};

const listRequests = async (req, res) => {
  try {
    if (!requireOps(req, res)) return;
    const status = req.query.status ? String(req.query.status) : null;
    const rows = await listAccessRequests({ status });
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[AccessRequest] list failed:', err);
    return res.status(500).json({ message: err.message || 'Failed to list requests' });
  }
};

const approveRequest = async (req, res) => {
  try {
    if (!requireOps(req, res)) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }

    const existing = await getAccessRequestById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (existing.status !== 'pending') {
      return res.status(409).json({ message: `Request is already ${existing.status}` });
    }

    const overrides = req.body || {};
    const companyName = String(overrides.companyName || existing.company_name).trim();
    const subdomainInput = String(overrides.subdomain || existing.subdomain).trim();
    const orgCity = overrides.orgCity != null ? overrides.orgCity : existing.org_city;
    const orgIdInput = String(overrides.orgId || existing.org_id || subdomainInput)
      .trim()
      .toUpperCase()
      .slice(0, 10);

    let subdomain;
    try {
      subdomain = validateSubdomain(subdomainInput);
    } catch (e) {
      return res.status(400).json({ message: e.message || 'Invalid subdomain' });
    }

    const tenantResult = await createTenant({
      orgId: orgIdInput,
      orgName: companyName,
      subdomain,
      orgCity: orgCity || '',
      adminUser: {
        email: existing.email_normalized,
        fullName: existing.full_name || 'System Administrator',
        phone: existing.phone || '',
      },
    });

    const createdSubdomain = tenantResult.subdomain || subdomain;
    const createdOrgId = tenantResult.generatedOrgId || tenantResult.orgId || orgIdInput;

    const updated = await markAccessRequestApproved(id, {
      approvedByEmail: 'ops@platform',
      createdOrgId: String(createdOrgId),
      createdSubdomain,
    });

    const subdomainUrl =
      tenantResult.subdomainUrl || buildSubdomainUrl(createdSubdomain);
    const zohoLoginUrl = `${String(
      process.env.SSO_PLATFORM_FRONTEND_URL ||
        process.env.FRONTEND_URL ||
        `https://${process.env.MAIN_DOMAIN || 'rioassetmanagement.net'}`
    ).replace(/\/$/, '')}/api/auth/zoho/login`;

    sendOrgProvisionedForZohoEmail({
      to: existing.email_normalized,
      fullName: existing.full_name || 'there',
      companyName,
      subdomain: createdSubdomain,
      subdomainUrl,
      zohoLoginUrl,
      passwordHint: tenantResult.adminCredentials?.password || 'Initial1',
    }).catch((e) => logger.warn('[AccessRequest] provision email failed:', e.message));

    return res.json({
      message: 'Organization created. Requester has been emailed.',
      request: updated,
      tenant: {
        orgId: createdOrgId,
        subdomain: createdSubdomain,
        subdomainUrl,
        adminEmail: existing.email_normalized,
      },
    });
  } catch (err) {
    console.error('[AccessRequest] approve failed:', err);
    return res.status(500).json({
      message: err.message || 'Failed to approve and create organization',
    });
  }
};

const rejectRequest = async (req, res) => {
  try {
    if (!requireOps(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'Invalid request id' });
    }
    const reason = req.body?.reason ? String(req.body.reason).trim() : null;
    const updated = await markAccessRequestRejected(id, {
      rejectedByEmail: 'ops@platform',
      reason,
    });
    if (!updated) {
      return res.status(404).json({ message: 'Pending request not found' });
    }
    return res.json({ message: 'Request rejected', request: updated });
  } catch (err) {
    console.error('[AccessRequest] reject failed:', err);
    return res.status(500).json({ message: err.message || 'Failed to reject request' });
  }
};

module.exports = {
  opsLogin,
  getClaimPreview,
  submitAccessRequest,
  listRequests,
  approveRequest,
  rejectRequest,
};
