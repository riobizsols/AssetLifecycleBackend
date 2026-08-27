/**
 * Short-lived signed claim proving Zoho SSO verified an email
 * before the user submits an access request.
 */
const jwt = require('jsonwebtoken');

const CLAIM_TYPE = 'zoho_access_request';
const CLAIM_TTL = process.env.ZOHO_ACCESS_CLAIM_TTL || '30m';

function claimSecret() {
  return process.env.JWT_SECRET || process.env.ZOHO_CLIENT_SECRET || 'zoho-access-claim';
}

function createZohoAccessClaim({ email, fullName = null }) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('Valid email required for access claim');
  }
  return jwt.sign(
    {
      typ: CLAIM_TYPE,
      email: normalized,
      full_name: fullName ? String(fullName).trim() : null,
    },
    claimSecret(),
    { expiresIn: CLAIM_TTL }
  );
}

function verifyZohoAccessClaim(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('Missing access claim. Sign in with Zoho again.');
    err.status = 401;
    throw err;
  }
  let decoded;
  try {
    decoded = jwt.verify(token, claimSecret());
  } catch {
    const err = new Error('Access claim expired or invalid. Sign in with Zoho again.');
    err.status = 401;
    throw err;
  }
  if (decoded?.typ !== CLAIM_TYPE || !decoded?.email) {
    const err = new Error('Invalid access claim.');
    err.status = 401;
    throw err;
  }
  return {
    email: String(decoded.email).trim().toLowerCase(),
    fullName: decoded.full_name ? String(decoded.full_name).trim() : null,
  };
}

module.exports = {
  createZohoAccessClaim,
  verifyZohoAccessClaim,
};
