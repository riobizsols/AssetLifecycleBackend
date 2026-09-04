const accountDeletionService = require('../services/accountDeletionService');

function clientMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

/**
 * POST /api/account-deletion/lookup
 * Body: { identifier } — subdomain OR registered email
 */
const lookup = async (req, res) => {
  try {
    const { identifier } = req.body || {};
    const tenant = await accountDeletionService.lookupTenant(identifier);
    const session = await accountDeletionService.createDeletionRequest(tenant, clientMeta(req));

    return res.json({
      success: true,
      requestId: session.requestId,
      confirmationToken: session.confirmationToken,
      organizationName: session.organizationName,
      subdomain: session.subdomain,
      maskedEmail: session.maskedEmail,
      orgId: session.orgId,
      confirmationPhrase: session.confirmationPhrase,
      identifierType: session.identifierType,
      showEmail: session.showEmail,
      displayEmail: session.displayEmail,
    });
  } catch (err) {
    console.error('[AccountDeletion] lookup error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to look up organization',
    });
  }
};

/**
 * POST /api/account-deletion/confirm-statement
 */
const confirmStatement = async (req, res) => {
  try {
    const { requestId, confirmationToken, confirmationText } = req.body || {};
    const result = await accountDeletionService.confirmStatement(
      requestId,
      confirmationToken,
      confirmationText,
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Confirmation failed',
    });
  }
};

/**
 * POST /api/account-deletion/acknowledge-warning
 */
const acknowledgeWarning = async (req, res) => {
  try {
    const { requestId, confirmationToken } = req.body || {};
    const result = await accountDeletionService.acknowledgeWarning(requestId, confirmationToken);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Acknowledgement failed',
    });
  }
};

/**
 * POST /api/account-deletion/send-otp
 */
const sendOtp = async (req, res) => {
  try {
    const { requestId, confirmationToken } = req.body || {};
    const result = await accountDeletionService.issueOtp(requestId, confirmationToken);
    return res.json({ success: true, ...result });
  } catch (err) {
    const payload = {
      success: false,
      message: err.message || 'Failed to send verification code',
    };
    if (err.retryAfter) payload.retryAfter = err.retryAfter;
    return res.status(err.status || 500).json(payload);
  }
};

/**
 * POST /api/account-deletion/verify-otp
 */
const verifyOtp = async (req, res) => {
  try {
    const { requestId, confirmationToken, otp } = req.body || {};
    const result = await accountDeletionService.verifyOtp(requestId, confirmationToken, otp);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'OTP verification failed',
    });
  }
};

/**
 * POST /api/account-deletion/execute
 * Starts permanent deletion asynchronously. Poll GET /status for live progress.
 */
const execute = async (req, res) => {
  try {
    const { requestId, confirmationToken } = req.body || {};
    const result = await accountDeletionService.startDeletion(requestId, confirmationToken);
    return res.status(202).json({
      success: true,
      message: 'Organization deletion started.',
      ...result,
    });
  } catch (err) {
    console.error('[AccountDeletion] execute error:', err.message);
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Organization deletion failed',
    });
  }
};

/**
 * POST /api/account-deletion/status
 * Live progress for an in-flight (or finished) deletion job.
 */
const getStatus = async (req, res) => {
  try {
    const requestId = req.body?.requestId || req.query.requestId;
    const confirmationToken = req.body?.confirmationToken || req.query.confirmationToken;
    const result = await accountDeletionService.getDeletionStatus(requestId, confirmationToken);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Unable to load deletion status',
    });
  }
};

/**
 * GET /api/account-deletion/confirmation-phrase
 * Explains the dynamic confirmation format (subdomain + org name).
 */
const getConfirmationPhrase = (_req, res) => {
  res.json({
    success: true,
    format: '<subdomain> <organizationName>',
    description:
      'Type your organization subdomain and organization name exactly as shown, separated by a single space. Case-sensitive; do not trim.',
  });
};

module.exports = {
  lookup,
  confirmStatement,
  acknowledgeWarning,
  sendOtp,
  verifyOtp,
  execute,
  getStatus,
  getConfirmationPhrase,
};
