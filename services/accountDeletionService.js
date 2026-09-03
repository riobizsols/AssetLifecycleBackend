/**
 * Organization / Tenant Account Deletion Service
 * Apple App Store Guideline 5.1.1(v) — Account Deletion
 *
 * Hard-deletes an entire tenant (DROP DATABASE + remove registry rows).
 * Not for individual employee/user deletion.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { initTenantRegistryPool, getTenantCredentials, clearTenantPoolCache } = require('./tenantService');
const { buildPoolConfig } = require('../utils/pgSsl');
const logger = require('../utils/logger');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_RESENDS = 5;
const REQUEST_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 10;

const PROTECTED_DB_NAMES = new Set([
  'postgres',
  'template0',
  'template1',
  'assetlifecycle',
  'assetLifecycle',
]);

let deletionTableReady = false;

/**
 * Confirmation phrase = "<subdomain> <organizationName>"
 * Exact match required (case-sensitive, no trim).
 */
function buildConfirmationPhrase(subdomain, orgName) {
  return `${subdomain} ${orgName}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateRequestId() {
  return `TDR_${crypto.randomBytes(16).toString('hex')}`;
}

function generateConfirmationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

function maskEmail(email) {
  const value = String(email || '');
  const [local, domain] = value.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function getRegistryAdminUrl() {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) {
    throw new Error('TENANT_DATABASE_URL is not configured');
  }
  // Connect to maintenance DB (postgres) for DROP DATABASE
  return base.replace(/\/([^/?]+)(\?.*)?$/i, '/postgres$2');
}

async function ensureDeletionTable(pool = null) {
  if (deletionTableReady) return;
  const registry = pool || initTenantRegistryPool();
  const sqlPath = path.join(__dirname, '../migrations/create_tenant_deletion_requests.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await registry.query(sql);
  deletionTableReady = true;
  logger.log('[AccountDeletion] tenant_deletion_requests table ready');
}

function isEmailIdentifier(value) {
  // Detect email vs subdomain (e.g. user@gmail.com / admin@acme.org)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

let tenantsEmailColumnReady = false;

async function ensureTenantsEmailColumn(pool = null) {
  if (tenantsEmailColumnReady) return;
  const registry = pool || initTenantRegistryPool();
  const sqlPath = path.join(__dirname, '../migrations/add_tenants_email_column.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await registry.query(sql);
  tenantsEmailColumnReady = true;
}

async function persistTenantEmail(orgId, email) {
  if (!orgId || !email) return;
  try {
    const pool = initTenantRegistryPool();
    await ensureTenantsEmailColumn(pool);
    await pool.query(
      `UPDATE "tenants"
       SET email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE grouped_org_id = $1
         AND (email IS NULL OR LOWER(TRIM(email)) <> LOWER(TRIM($2)))`,
      [orgId, String(email).trim()],
    );
  } catch (err) {
    logger.warn(`[AccountDeletion] Could not persist tenants.email: ${err.message}`);
  }
}

/**
 * Email always comes from tenants.email only — never tblUsers / tenant_user_emails.
 * Organization display name may be enriched from the tenant DB (name only).
 */
async function resolveOrgEmailAndName(tenant) {
  const orgEmail = tenant.email ? String(tenant.email).trim() : null;
  let orgName = tenant.org_name || tenant.subdomain || tenant.org_id;

  try {
    const credentials = await getTenantCredentials(tenant.org_id);
    if (credentials) {
      const { getTenantConnectionString } = require('./tenantService');
      const client = new Client(
        buildPoolConfig(getTenantConnectionString(credentials), {
          connectionTimeoutMillis: 10000,
        }),
      );
      await client.connect();
      try {
        const orgRes = await client.query(
          `SELECT text FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1`,
        );
        if (orgRes.rows[0]?.text) {
          orgName = String(orgRes.rows[0].text);
        }
      } finally {
        await client.end().catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(`[AccountDeletion] Could not load org name from tenant DB: ${err.message}`);
  }

  return { orgEmail, orgName };
}

/**
 * Find tenant by email — tenants.email column only.
 */
async function findTenantByEmail(email) {
  const pool = initTenantRegistryPool();
  await ensureTenantsEmailColumn(pool);
  const normalized = String(email).trim().toLowerCase();

  const direct = await pool.query(
    `SELECT grouped_org_id AS org_id, org_name, db_name, subdomain, email, is_active
     FROM "tenants"
     WHERE is_active = true
       AND email IS NOT NULL
       AND LOWER(TRIM(email)) = $1
     LIMIT 1`,
    [normalized],
  );
  return direct.rows[0] || null;
}

/**
 * Lookup tenant by subdomain OR organization email.
 * All identity fields come from the "tenants" table only.
 */
async function lookupTenant(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) {
    const err = new Error('Organization subdomain or email is required');
    err.status = 400;
    throw err;
  }

  const pool = initTenantRegistryPool();
  await ensureDeletionTable(pool);
  await ensureTenantsEmailColumn(pool);

  const enteredAsEmail = isEmailIdentifier(raw);
  let tenant = null;

  if (enteredAsEmail) {
    tenant = await findTenantByEmail(raw);
  } else {
    const subdomain = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!subdomain) {
      const err = new Error('Organization not found.');
      err.status = 404;
      throw err;
    }
    const result = await pool.query(
      `SELECT grouped_org_id AS org_id, org_name, db_name, subdomain, email, is_active
       FROM "tenants"
       WHERE LOWER(subdomain) = LOWER($1) AND is_active = true
       LIMIT 1`,
      [subdomain],
    );
    tenant = result.rows[0] || null;
  }

  if (!tenant) {
    const err = new Error('Organization not found.');
    err.status = 404;
    throw err;
  }

  if (!tenant.db_name || PROTECTED_DB_NAMES.has(String(tenant.db_name))) {
    const err = new Error('This organization cannot be deleted through self-service.');
    err.status = 403;
    throw err;
  }

  const { orgEmail, orgName } = await resolveOrgEmailAndName(tenant);
  if (!orgEmail) {
    const err = new Error(
      'No email is registered on this tenant. Update tenants.email or contact support.',
    );
    err.status = 422;
    throw err;
  }

  if (enteredAsEmail && String(orgEmail).trim().toLowerCase() !== String(raw).trim().toLowerCase()) {
    const err = new Error('Organization not found.');
    err.status = 404;
    throw err;
  }

  return {
    org_id: tenant.org_id,
    subdomain: tenant.subdomain,
    db_name: tenant.db_name,
    org_email: orgEmail,
    org_name: orgName,
    confirmation_phrase: buildConfirmationPhrase(tenant.subdomain, orgName),
    identifier_type: enteredAsEmail ? 'email' : 'subdomain',
    show_email: enteredAsEmail,
    display_email: enteredAsEmail ? String(raw).trim() : null,
  };
}

async function createDeletionRequest(tenantInfo, meta = {}) {
  const pool = initTenantRegistryPool();
  await ensureDeletionTable(pool);

  // Prevent duplicate in-flight deletions for same org
  const existing = await pool.query(
    `SELECT request_id, status, created_at
     FROM "tenant_deletion_requests"
     WHERE org_id = $1
       AND status NOT IN ('completed', 'failed', 'expired', 'cancelled')
       AND created_at > NOW() - INTERVAL '1 hour'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantInfo.org_id],
  );

  if (existing.rows[0]) {
    // Expire old open request and create fresh (safer than reusing partially completed)
    await pool.query(
      `UPDATE "tenant_deletion_requests"
       SET status = 'expired', updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1 AND status NOT IN ('completed')`,
      [existing.rows[0].request_id],
    );
  }

  const requestId = generateRequestId();
  const confirmationToken = generateConfirmationToken();
  const confirmationTokenHash = hashToken(confirmationToken);

  const auditPayload = {
    event: 'ACCOUNT_DELETION_STARTED',
    org_id: tenantInfo.org_id,
    subdomain: tenantInfo.subdomain,
    db_name: tenantInfo.db_name,
    org_email_masked: maskEmail(tenantInfo.org_email),
    ip: meta.ipAddress || null,
    user_agent: meta.userAgent || null,
    at: new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO "tenant_deletion_requests" (
       request_id, confirmation_token_hash, org_id, subdomain, db_name,
       org_email, org_name, status, ip_address, user_agent, audit_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10::jsonb)`,
    [
      requestId,
      confirmationTokenHash,
      tenantInfo.org_id,
      tenantInfo.subdomain,
      tenantInfo.db_name,
      tenantInfo.org_email,
      tenantInfo.org_name,
      meta.ipAddress || null,
      meta.userAgent || null,
      JSON.stringify(auditPayload),
    ],
  );

  logger.log(
    `[AccountDeletion] Request ${requestId} created for org ${tenantInfo.org_id} (${tenantInfo.subdomain})`,
  );

  return {
    requestId,
    confirmationToken,
    organizationName: tenantInfo.org_name,
    subdomain: tenantInfo.subdomain,
    maskedEmail: maskEmail(tenantInfo.org_email),
    orgId: tenantInfo.org_id,
    dbName: tenantInfo.db_name,
    confirmationPhrase: tenantInfo.confirmation_phrase
      || buildConfirmationPhrase(tenantInfo.subdomain, tenantInfo.org_name),
    identifierType: tenantInfo.identifier_type || 'subdomain',
    showEmail: Boolean(tenantInfo.show_email),
    displayEmail: tenantInfo.show_email ? (tenantInfo.display_email || tenantInfo.org_email) : null,
  };
}

async function loadRequest(requestId, confirmationToken) {
  const pool = initTenantRegistryPool();
  await ensureDeletionTable(pool);

  const result = await pool.query(
    `SELECT * FROM "tenant_deletion_requests" WHERE request_id = $1 LIMIT 1`,
    [requestId],
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Deletion request not found or expired.');
    err.status = 404;
    throw err;
  }

  if (row.status === 'completed') {
    const err = new Error('This organization has already been deleted.');
    err.status = 410;
    throw err;
  }

  if (['expired', 'cancelled', 'failed'].includes(row.status)) {
    const err = new Error('This deletion request is no longer valid. Please start again.');
    err.status = 410;
    throw err;
  }

  // Do not expire in-flight deletions (large DBs can take longer than request TTL)
  if (row.status !== 'deleting') {
    const createdAt = new Date(row.created_at).getTime();
    if (Date.now() - createdAt > REQUEST_TTL_MS) {
      await pool.query(
        `UPDATE "tenant_deletion_requests"
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1`,
        [requestId],
      );
      const err = new Error('This deletion request has expired. Please start again.');
      err.status = 410;
      throw err;
    }
  }

  const tokenHash = hashToken(confirmationToken || '');
  if (tokenHash !== row.confirmation_token_hash) {
    const err = new Error('Invalid confirmation token.');
    err.status = 401;
    throw err;
  }

  return row;
}

async function confirmStatement(requestId, confirmationToken, confirmationText) {
  const row = await loadRequest(requestId, confirmationToken);
  const expected = buildConfirmationPhrase(row.subdomain, row.org_name);
  // Exact match — no trim, no case fold
  if (confirmationText !== expected) {
    const err = new Error(
      'Confirmation text does not match. Type your organization subdomain and name exactly as shown.',
    );
    err.status = 400;
    throw err;
  }

  const pool = initTenantRegistryPool();

  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET status = 'statement_ok',
         statement_confirmed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [row.request_id],
  );

  return { ok: true, next: 'final_warning' };
}

async function acknowledgeWarning(requestId, confirmationToken) {
  const row = await loadRequest(requestId, confirmationToken);
  if (!row.statement_confirmed_at && row.status !== 'statement_ok') {
    const err = new Error('Complete the confirmation statement first.');
    err.status = 400;
    throw err;
  }

  const pool = initTenantRegistryPool();
  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET status = 'warning_ok',
         warning_acknowledged_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [row.request_id],
  );

  return { ok: true, next: 'otp' };
}

async function issueOtp(requestId, confirmationToken) {
  const row = await loadRequest(requestId, confirmationToken);

  if (!row.warning_acknowledged_at && !['warning_ok', 'otp_sent', 'otp_verified'].includes(row.status)) {
    const err = new Error('Acknowledge the final warning before requesting an OTP.');
    err.status = 400;
    throw err;
  }

  if (row.resend_count >= OTP_MAX_RESENDS && row.otp_sent_at) {
    const err = new Error('Maximum OTP resend limit reached. Start a new deletion request.');
    err.status = 429;
    throw err;
  }

  if (row.otp_sent_at) {
    const elapsed = Date.now() - new Date(row.otp_sent_at).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      const err = new Error(`Please wait ${waitSec} seconds before requesting another code.`);
      err.status = 429;
      err.retryAfter = waitSec;
      throw err;
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const pool = initTenantRegistryPool();

  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET status = 'otp_sent',
         otp_hash = $2,
         otp_expires_at = $3,
         otp_sent_at = CURRENT_TIMESTAMP,
         otp_attempts = 0,
         resend_count = COALESCE(resend_count, 0) + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [row.request_id, otpHash, expiresAt.toISOString()],
  );

  const { sendOrganizationDeletionOtpEmail } = require('../utils/mailer');
  await sendOrganizationDeletionOtpEmail({
    to: row.org_email,
    organizationName: row.org_name || row.subdomain || row.org_id,
    subdomain: row.subdomain,
    otp,
  });

  logger.log(`[AccountDeletion] OTP sent for request ${requestId} to ${maskEmail(row.org_email)}`);

  return {
    ok: true,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendAvailableIn: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
    maskedEmail: maskEmail(row.org_email),
  };
}

async function verifyOtp(requestId, confirmationToken, otp) {
  const row = await loadRequest(requestId, confirmationToken);
  const pool = initTenantRegistryPool();

  if (!row.otp_hash || !row.otp_expires_at) {
    const err = new Error('No OTP has been sent. Request a verification code first.');
    err.status = 400;
    throw err;
  }

  if (row.otp_attempts >= OTP_MAX_ATTEMPTS) {
    await pool.query(
      `UPDATE "tenant_deletion_requests"
       SET status = 'failed',
           error_message = 'Maximum OTP attempts exceeded',
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1`,
      [row.request_id],
    );
    const err = new Error('Too many invalid OTP attempts. Please start again.');
    err.status = 429;
    throw err;
  }

  if (new Date(row.otp_expires_at).getTime() < Date.now()) {
    const err = new Error('OTP has expired. Please request a new code.');
    err.status = 400;
    throw err;
  }

  const otpStr = String(otp || '');
  if (!/^\d{6}$/.test(otpStr)) {
    const err = new Error('Enter the 6-digit verification code.');
    err.status = 400;
    throw err;
  }

  const match = await bcrypt.compare(otpStr, row.otp_hash);
  if (!match) {
    await pool.query(
      `UPDATE "tenant_deletion_requests"
       SET otp_attempts = otp_attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1`,
      [row.request_id],
    );
    const remaining = OTP_MAX_ATTEMPTS - (row.otp_attempts + 1);
    const err = new Error(
      remaining > 0
        ? `Invalid verification code. ${remaining} attempt(s) remaining.`
        : 'Invalid verification code. No attempts remaining.',
    );
    err.status = 400;
    throw err;
  }

  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET status = 'otp_verified',
         otp_verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [row.request_id],
  );

  return {
    ok: true,
    deletionAuthorized: true,
    organizationName: row.org_name,
    subdomain: row.subdomain,
    registeredEmail: maskEmail(row.org_email),
    dbName: row.db_name,
  };
}

async function terminateConnections(adminClient, dbName) {
  await adminClient
    .query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    )
    .catch(() => {});
}

async function dropTenantDatabase(dbName) {
  if (!dbName || PROTECTED_DB_NAMES.has(String(dbName))) {
    throw new Error(`Refusing to drop protected database: ${dbName}`);
  }
  // Only allow simple identifiers
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    throw new Error('Invalid database name');
  }

  const admin = new Client(
    buildPoolConfig(getRegistryAdminUrl(), { connectionTimeoutMillis: 30000 }),
  );
  await admin.connect();
  try {
    await terminateConnections(admin, dbName);
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    logger.log(`[AccountDeletion] DROP DATABASE completed: ${dbName}`);
  } finally {
    await admin.end().catch(() => {});
  }
}

async function removeRegistryRows(orgId) {
  const pool = initTenantRegistryPool();
  try {
    const { ensureTenantUserEmailsTable } = require('./tenantEmailRegistryService');
    await ensureTenantUserEmailsTable(pool);
    await pool.query(`DELETE FROM "tenant_user_emails" WHERE org_id = $1`, [orgId]);
  } catch (err) {
    logger.warn(`[AccountDeletion] tenant_user_emails cleanup skipped: ${err.message}`);
  }
  await pool.query(`DELETE FROM "tenants" WHERE grouped_org_id = $1`, [orgId]);

  try {
    clearTenantPoolCache(orgId);
  } catch (_) {
    /* ignore */
  }

  try {
    const cacheService = require('./cacheService');
    await cacheService.del(cacheService.buildKey('tenant', 'credentials', orgId));
    await cacheService.del(cacheService.buildKey('tenant', 'exists', orgId));
  } catch (_) {
    /* ignore */
  }
}

/**
 * Final destructive step — starts asynchronously so the client can poll progress.
 * DROP DB first, then registry rows. Progress is written to tenant_deletion_requests.
 */

const activeDeletionJobs = new Set();

const DELETION_STAGES = [
  { key: 'validating', label: 'Validating deletion request', weight: 8 },
  { key: 'preparing', label: 'Preparing organization teardown', weight: 7 },
  { key: 'terminating_connections', label: 'Closing active database connections', weight: 10 },
  { key: 'dropping_database', label: 'Dropping organization database', weight: 60 },
  { key: 'cleaning_registry', label: 'Removing tenant registry records', weight: 8 },
  { key: 'sending_confirmation', label: 'Sending deletion confirmation email', weight: 5 },
  { key: 'completed', label: 'Organization deletion complete', weight: 2 },
];

async function setDeletionProgress(requestId, { percent, stage, message, status = 'deleting', errorMessage = null }) {
  const pool = initTenantRegistryPool();
  const clamped =
    percent === undefined || percent === null
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET progress_percent = COALESCE($2, progress_percent),
         progress_stage = COALESCE($3, progress_stage),
         progress_message = COALESCE($4, progress_message),
         status = COALESCE($5, status),
         error_message = COALESCE($6, error_message),
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [requestId, clamped, stage || null, message || null, status, errorMessage],
  );
}

function serializeDeletionStatus(row) {
  const startedAt = row.deletion_started_at ? new Date(row.deletion_started_at).getTime() : null;
  const elapsedMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const stageMeta = DELETION_STAGES.find((s) => s.key === row.progress_stage) || null;
  const currentIdx = DELETION_STAGES.findIndex((x) => x.key === row.progress_stage);
  return {
    requestId: row.request_id,
    status: row.status,
    progressPercent: Number(row.progress_percent || 0),
    progressStage: row.progress_stage || null,
    progressMessage: row.progress_message || null,
    stageLabel: stageMeta?.label || row.progress_message || null,
    stages: DELETION_STAGES.map((s, idx) => {
      const isCurrent = s.key === row.progress_stage;
      const done =
        row.status === 'completed' ||
        (currentIdx >= 0 && idx < currentIdx) ||
        (row.status === 'failed' && currentIdx >= 0 && idx < currentIdx);
      return {
        key: s.key,
        label: s.label,
        done,
        active: isCurrent && (row.status === 'deleting' || row.status === 'failed'),
      };
    }),
    errorMessage: row.status === 'failed' ? row.error_message || 'Organization deletion failed.' : null,
    organizationName: row.org_name,
    subdomain: row.subdomain,
    elapsedMs,
    completedAt: row.completed_at || null,
  };
}

async function loadRequestForStatus(requestId, confirmationToken) {
  const pool = initTenantRegistryPool();
  await ensureDeletionTable(pool);
  const result = await pool.query(
    `SELECT * FROM "tenant_deletion_requests" WHERE request_id = $1 LIMIT 1`,
    [requestId],
  );
  const row = result.rows[0];
  if (!row) {
    const err = new Error('Deletion request not found or expired.');
    err.status = 404;
    throw err;
  }
  const tokenHash = hashToken(confirmationToken || '');
  if (tokenHash !== row.confirmation_token_hash) {
    const err = new Error('Invalid confirmation token.');
    err.status = 401;
    throw err;
  }
  return row;
}

async function getDeletionStatus(requestId, confirmationToken) {
  const row = await loadRequestForStatus(requestId, confirmationToken);
  return serializeDeletionStatus(row);
}

async function dropTenantDatabaseWithProgress(dbName, requestId) {
  const expectedMs = Math.max(
    8000,
    Number(process.env.ACCOUNT_DELETION_DROP_EXPECTED_MS || 45000) || 45000,
  );
  const started = Date.now();
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const elapsed = Date.now() - started;
    // Asymptotic climb 25% → 84% while DROP DATABASE runs (never reaches 100 until done)
    const pct = Math.min(84, 25 + 59 * (1 - Math.exp(-elapsed / expectedMs)));
    const seconds = Math.max(1, Math.round(elapsed / 1000));
    await setDeletionProgress(requestId, {
      percent: pct,
      stage: 'dropping_database',
      message: `Dropping organization database… (${seconds}s elapsed)`,
      status: 'deleting',
    }).catch(() => {});
  };

  await setDeletionProgress(requestId, {
    percent: 25,
    stage: 'dropping_database',
    message: 'Dropping organization database…',
    status: 'deleting',
  });

  const ticker = setInterval(() => {
    tick();
  }, 900);

  try {
    await dropTenantDatabase(dbName);
  } finally {
    stopped = true;
    clearInterval(ticker);
  }

  await setDeletionProgress(requestId, {
    percent: 85,
    stage: 'dropping_database',
    message: 'Organization database dropped',
    status: 'deleting',
  });
}

async function runDeletionJob(requestId, confirmationToken) {
  if (activeDeletionJobs.has(requestId)) return;
  activeDeletionJobs.add(requestId);

  const pool = initTenantRegistryPool();
  let row;
  try {
    row = await loadRequestForStatus(requestId, confirmationToken);

    await setDeletionProgress(requestId, {
      percent: 5,
      stage: 'validating',
      message: 'Validating deletion request…',
      status: 'deleting',
    });

    if (row.status !== 'deleting' && row.status !== 'otp_verified') {
      throw Object.assign(new Error('Deletion job is not in a runnable state.'), { status: 409 });
    }

    await setDeletionProgress(requestId, {
      percent: 12,
      stage: 'preparing',
      message: 'Preparing organization teardown…',
      status: 'deleting',
    });

    const tenantRes = await pool.query(
      `SELECT grouped_org_id AS org_id, db_name, subdomain, is_active FROM "tenants" WHERE grouped_org_id = $1 LIMIT 1`,
      [row.org_id],
    );
    const tenant = tenantRes.rows[0];
    if (!tenant) {
      await pool.query(
        `UPDATE "tenant_deletion_requests"
         SET status = 'completed',
             progress_percent = 100,
             progress_stage = 'completed',
             progress_message = 'Organization already removed',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP,
             error_message = 'Tenant already removed'
         WHERE request_id = $1`,
        [requestId],
      );
      return;
    }

    if (tenant.db_name !== row.db_name) {
      throw Object.assign(new Error('Tenant database mismatch. Deletion aborted for safety.'), {
        status: 409,
      });
    }

    await setDeletionProgress(requestId, {
      percent: 18,
      stage: 'terminating_connections',
      message: 'Closing active database connections…',
      status: 'deleting',
    });

    logger.log(
      `[AccountDeletion] AUDIT ${JSON.stringify({
        event: 'ACCOUNT_DELETION_EXECUTE',
        request_id: requestId,
        org_id: row.org_id,
        subdomain: row.subdomain,
        db_name: row.db_name,
        org_email_masked: maskEmail(row.org_email),
        at: new Date().toISOString(),
      })}`,
    );

    try {
      await dropTenantDatabaseWithProgress(row.db_name, requestId);
    } catch (dropErr) {
      await setDeletionProgress(requestId, {
        percent: 30,
        stage: 'dropping_database',
        message: 'Failed to drop organization database',
        status: 'failed',
        errorMessage: String(dropErr.message || 'Database drop failed'),
      });
      await pool.query(
        `UPDATE "tenant_deletion_requests"
         SET audit_payload = COALESCE(audit_payload, '{}'::jsonb) || $2::jsonb
         WHERE request_id = $1`,
        [
          requestId,
          JSON.stringify({ drop_error: dropErr.message, at: new Date().toISOString() }),
        ],
      );
      logger.error(`[AccountDeletion] DROP DATABASE failed for ${row.db_name}: ${dropErr.message}`);
      return;
    }

    await setDeletionProgress(requestId, {
      percent: 90,
      stage: 'cleaning_registry',
      message: 'Removing tenant registry records…',
      status: 'deleting',
    });

    try {
      await removeRegistryRows(row.org_id);
    } catch (regErr) {
      logger.error(
        `[AccountDeletion] Registry cleanup failed after DB drop for ${row.org_id}: ${regErr.message}`,
      );
      await setDeletionProgress(requestId, {
        percent: 90,
        stage: 'cleaning_registry',
        message: 'Registry cleanup failed after database drop',
        status: 'failed',
        errorMessage: `DB dropped but registry cleanup failed: ${regErr.message}`,
      });
      return;
    }

    await setDeletionProgress(requestId, {
      percent: 95,
      stage: 'sending_confirmation',
      message: 'Sending deletion confirmation email…',
      status: 'deleting',
    });

    if (row.org_email) {
      try {
        const { sendOrganizationDeletedEmail } = require('../utils/mailer');
        await sendOrganizationDeletedEmail({
          to: row.org_email,
          organizationName: row.org_name || row.subdomain || row.org_id,
          subdomain: row.subdomain,
        });
        logger.log(
          `[AccountDeletion] Deletion confirmation email sent to ${maskEmail(row.org_email)}`,
        );
      } catch (mailErr) {
        logger.warn(
          `[AccountDeletion] Deletion confirmation email failed for ${maskEmail(row.org_email)}: ${mailErr.message}`,
        );
      }
    }

    await pool.query(
      `UPDATE "tenant_deletion_requests"
       SET status = 'completed',
           progress_percent = 100,
           progress_stage = 'completed',
           progress_message = 'Organization permanently deleted',
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           audit_payload = COALESCE(audit_payload, '{}'::jsonb) || $2::jsonb
       WHERE request_id = $1`,
      [
        requestId,
        JSON.stringify({
          completed: true,
          at: new Date().toISOString(),
          org_id: row.org_id,
          db_name: row.db_name,
        }),
      ],
    );

    logger.log(`[AccountDeletion] Organization ${row.org_id} permanently deleted`);
  } catch (err) {
    logger.error(`[AccountDeletion] Job failed for ${requestId}: ${err.message}`);
    await setDeletionProgress(requestId, {
      percent: undefined,
      stage: undefined,
      message: 'Organization deletion failed',
      status: 'failed',
      errorMessage: err.message || 'Organization deletion failed',
    }).catch(() => {});
  } finally {
    activeDeletionJobs.delete(requestId);
  }
}

async function startDeletion(requestId, confirmationToken) {
  const row = await loadRequest(requestId, confirmationToken);
  const pool = initTenantRegistryPool();

  // Idempotent: already running
  if (row.status === 'deleting' || activeDeletionJobs.has(requestId)) {
    const fresh = await loadRequestForStatus(requestId, confirmationToken);
    return { started: true, alreadyRunning: true, ...serializeDeletionStatus(fresh) };
  }

  if (row.status !== 'otp_verified' || !row.otp_verified_at) {
    const err = new Error('OTP verification is required before permanent deletion.');
    err.status = 403;
    throw err;
  }

  await pool.query(
    `UPDATE "tenant_deletion_requests"
     SET status = 'deleting',
         progress_percent = 2,
         progress_stage = 'validating',
         progress_message = 'Starting organization deletion…',
         deletion_started_at = CURRENT_TIMESTAMP,
         error_message = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE request_id = $1`,
    [requestId],
  );

  // Fire-and-forget background job (survives HTTP response)
  setImmediate(() => {
    runDeletionJob(requestId, confirmationToken).catch((err) => {
      logger.error(`[AccountDeletion] Unhandled job error: ${err.message}`);
    });
  });

  const fresh = await loadRequestForStatus(requestId, confirmationToken);
  return { started: true, alreadyRunning: false, ...serializeDeletionStatus(fresh) };
}

/** @deprecated Prefer startDeletion + getDeletionStatus for progress UX */
async function executeDeletion(requestId, confirmationToken) {
  await startDeletion(requestId, confirmationToken);
  // Poll until terminal for callers that still expect sync completion
  const deadline = Date.now() + Number(process.env.ACCOUNT_DELETION_SYNC_TIMEOUT_MS || 10 * 60 * 1000);
  while (Date.now() < deadline) {
    const status = await getDeletionStatus(requestId, confirmationToken);
    if (status.status === 'completed') {
      return {
        ok: true,
        organizationName: status.organizationName,
        subdomain: status.subdomain,
      };
    }
    if (status.status === 'failed') {
      const err = new Error(status.errorMessage || 'Organization deletion failed');
      err.status = 500;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const err = new Error('Organization deletion is still in progress. Check status and try again later.');
  err.status = 202;
  throw err;
}

module.exports = {
  buildConfirmationPhrase,
  lookupTenant,
  createDeletionRequest,
  confirmStatement,
  acknowledgeWarning,
  issueOtp,
  verifyOtp,
  executeDeletion,
  startDeletion,
  getDeletionStatus,
  maskEmail,
  ensureDeletionTable,
};
