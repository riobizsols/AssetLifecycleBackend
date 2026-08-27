/**
 * Zoho → ALM access requests (registry DB).
 * Pending Zoho users request an org; company ops approve via /ops/access-requests → createTenant.
 */
const { initTenantRegistryPool } = require('../services/tenantService');
const logger = require('../utils/logger');

let tableEnsured = false;

async function ensureAccessRequestsTable(pool = null) {
  if (tableEnsured) return;
  const registry = pool || initTenantRegistryPool();
  await registry.query(`
    CREATE TABLE IF NOT EXISTS zoho_access_requests (
      id SERIAL PRIMARY KEY,
      email_normalized VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      company_name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(63) NOT NULL,
      org_id VARCHAR(10),
      org_city VARCHAR(255),
      phone VARCHAR(50),
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_by_email VARCHAR(255),
      approved_at TIMESTAMPTZ,
      rejected_reason TEXT,
      created_org_id VARCHAR(20),
      created_subdomain VARCHAR(63)
    )
  `);
  await registry.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_zoho_access_requests_pending_email
    ON zoho_access_requests (email_normalized)
    WHERE status = 'pending'
  `);
  await registry.query(`
    CREATE INDEX IF NOT EXISTS idx_zoho_access_requests_status_created
    ON zoho_access_requests (status, created_at DESC)
  `);
  tableEnsured = true;
  logger.log('[AccessRequests] Table zoho_access_requests ready');
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

async function createAccessRequest(data) {
  const pool = initTenantRegistryPool();
  await ensureAccessRequestsTable(pool);

  const email = normalizeEmail(data.email);
  const companyName = String(data.companyName || '').trim();
  const subdomain = String(data.subdomain || '')
    .trim()
    .toLowerCase();
  if (!email.includes('@')) throw new Error('Valid email is required');
  if (!companyName) throw new Error('Company / organization name is required');
  if (!subdomain) throw new Error('Desired subdomain is required');

  const existingPending = await pool.query(
    `SELECT id FROM zoho_access_requests
     WHERE email_normalized = $1 AND status = 'pending'
     LIMIT 1`,
    [email]
  );
  if (existingPending.rows[0]) {
    const err = new Error(
      'You already have a pending access request. We will email you when it is approved.'
    );
    err.status = 409;
    err.requestId = existingPending.rows[0].id;
    throw err;
  }

  const result = await pool.query(
    `INSERT INTO zoho_access_requests (
       email_normalized, full_name, company_name, subdomain, org_id,
       org_city, phone, notes, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
     RETURNING *`,
    [
      email,
      data.fullName ? String(data.fullName).trim() : null,
      companyName,
      subdomain,
      data.orgId ? String(data.orgId).trim().toUpperCase().slice(0, 10) : null,
      data.orgCity ? String(data.orgCity).trim() : null,
      data.phone ? String(data.phone).trim() : null,
      data.notes ? String(data.notes).trim() : null,
    ]
  );
  return result.rows[0];
}

async function listAccessRequests({ status = null, limit = 100 } = {}) {
  const pool = initTenantRegistryPool();
  await ensureAccessRequestsTable(pool);
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (status) {
    const result = await pool.query(
      `SELECT * FROM zoho_access_requests
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, lim]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT * FROM zoho_access_requests
     ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $1`,
    [lim]
  );
  return result.rows;
}

async function getAccessRequestById(id) {
  const pool = initTenantRegistryPool();
  await ensureAccessRequestsTable(pool);
  const result = await pool.query(
    `SELECT * FROM zoho_access_requests WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function markAccessRequestApproved(id, { approvedByEmail, createdOrgId, createdSubdomain }) {
  const pool = initTenantRegistryPool();
  await ensureAccessRequestsTable(pool);
  const result = await pool.query(
    `UPDATE zoho_access_requests
     SET status = 'approved',
         approved_by_email = $2,
         approved_at = NOW(),
         updated_at = NOW(),
         created_org_id = $3,
         created_subdomain = $4
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, approvedByEmail, createdOrgId || null, createdSubdomain || null]
  );
  return result.rows[0] || null;
}

async function markAccessRequestRejected(id, { rejectedByEmail, reason }) {
  const pool = initTenantRegistryPool();
  await ensureAccessRequestsTable(pool);
  const result = await pool.query(
    `UPDATE zoho_access_requests
     SET status = 'rejected',
         approved_by_email = $2,
         approved_at = NOW(),
         updated_at = NOW(),
         rejected_reason = $3
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, rejectedByEmail, reason || null]
  );
  return result.rows[0] || null;
}

module.exports = {
  ensureAccessRequestsTable,
  createAccessRequest,
  listAccessRequests,
  getAccessRequestById,
  markAccessRequestApproved,
  markAccessRequestRejected,
};
