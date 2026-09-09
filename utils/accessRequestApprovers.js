/**
 * Company-only ops gate for Zoho access-request approve screen.
 * Not tied to tenant JR001 — uses ACCESS_REQUEST_OPS_PASSWORD.
 */
const jwt = require('jsonwebtoken');

const OPS_TYP = 'access_request_ops';

function getOpsPassword() {
  return String(process.env.ACCESS_REQUEST_OPS_PASSWORD || '').trim();
}

function isOpsConfigured() {
  return Boolean(getOpsPassword());
}

function opsSecret() {
  return process.env.JWT_SECRET || process.env.ACCESS_REQUEST_OPS_PASSWORD || 'access-ops';
}

function createOpsToken() {
  return jwt.sign({ typ: OPS_TYP }, opsSecret(), {
    expiresIn: process.env.ACCESS_REQUEST_OPS_TTL || '12h',
  });
}

function verifyOpsToken(token) {
  if (!token) return false;
  try {
    const decoded = jwt.verify(String(token).replace(/^Bearer\s+/i, ''), opsSecret());
    return decoded?.typ === OPS_TYP;
  } catch {
    return false;
  }
}

function getNotifyEmails() {
  return String(process.env.ACCESS_REQUEST_NOTIFY_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  getOpsPassword,
  isOpsConfigured,
  createOpsToken,
  verifyOpsToken,
  getNotifyEmails,
};
