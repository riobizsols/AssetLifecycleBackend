#!/usr/bin/env node
/**
 * Ensure REOPENEDBREAKDOWNS exists in tblApps and under Reports for JR001 on a tenant DB.
 * Usage: node scripts/ensure-reopened-breakdowns-tenant.js [tenant-search]
 * Example: node scripts/ensure-reopened-breakdowns-tenant.js pressana
 */
require('dotenv').config();
const { Client } = require('pg');
const { generateCustomIdForClient } = require('../utils/idGenerator');

const TARGET_APP_ID = 'REOPENEDBREAKDOWNS';
const TARGET_LABEL = 'Reopened Breakdowns';
const JOB_ROLE_ID = process.argv[3] || 'JR001';
const search = (process.argv[2] || 'pressana').toLowerCase();

async function ensureOnTenantDb(client, orgId) {
  const appCheck = await client.query(
    'SELECT app_id FROM "tblApps" WHERE app_id = $1',
    [TARGET_APP_ID]
  );
  if (!appCheck.rows.length) {
    await client.query(
      `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
       VALUES ($1, $2, true, $3)`,
      [TARGET_APP_ID, TARGET_LABEL, orgId]
    );
    console.log(`Added ${TARGET_APP_ID} to tblApps`);
  }

  const reportsGroup = await client.query(
    `SELECT job_role_nav_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = 'reports'
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID]
  );

  if (!reportsGroup.rows.length) {
    console.error(`Reports group not found for ${JOB_ROLE_ID}`);
    return false;
  }

  const reportsParentId = reportsGroup.rows[0].job_role_nav_id;

  const existing = await client.query(
    `SELECT job_role_nav_id, parent_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND int_status = 1 AND app_id = $2`,
    [JOB_ROLE_ID, TARGET_APP_ID]
  );

  if (existing.rows.length) {
    if (existing.rows[0].parent_id === reportsParentId) {
      console.log(`${TARGET_APP_ID} already under Reports`);
      return true;
    }
    const maxSeq = await client.query(
      `SELECT COALESCE(MAX(sequence), 0) AS max_seq
       FROM "tblJobRoleNav"
       WHERE job_role_id = $1 AND parent_id = $2 AND int_status = 1`,
      [JOB_ROLE_ID, reportsParentId]
    );
    const nextSeq = Number(maxSeq.rows[0]?.max_seq || 0) + 1;
    await client.query(
      `UPDATE "tblJobRoleNav"
       SET parent_id = $1, sequence = $2, label = $3
       WHERE job_role_nav_id = $4`,
      [reportsParentId, nextSeq, TARGET_LABEL, existing.rows[0].job_role_nav_id]
    );
    console.log(`Moved ${TARGET_APP_ID} under Reports (seq ${nextSeq})`);
    return true;
  }

  const breakdown = await client.query(
    `SELECT access_level, mob_desk, sequence
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND int_status = 1 AND app_id = 'BREAKDOWNHISTORY'
     LIMIT 1`,
    [JOB_ROLE_ID]
  );
  const accessLevel = breakdown.rows[0]?.access_level || 'A';
  const mobDesk = breakdown.rows[0]?.mob_desk || 'D';

  const maxSeq = await client.query(
    `SELECT COALESCE(MAX(sequence), 0) AS max_seq
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND parent_id = $2 AND int_status = 1`,
    [JOB_ROLE_ID, reportsParentId]
  );
  const nextSeq = Number(maxSeq.rows[0]?.max_seq || 0) + 1;
  const navId = await generateCustomIdForClient(client, 'job_role_nav', 3);

  await client.query(
    `INSERT INTO "tblJobRoleNav"
     (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk)
     VALUES ($1, $2, 1, $3, $4, $5, $6, false, $7, $8, $9)`,
    [
      navId,
      orgId,
      JOB_ROLE_ID,
      reportsParentId,
      TARGET_APP_ID,
      TARGET_LABEL,
      nextSeq,
      accessLevel,
      mobDesk,
    ]
  );
  console.log(`Added ${TARGET_APP_ID} under Reports (${navId}, seq ${nextSeq})`);
  return true;
}

(async () => {
  const registry = new Client({ connectionString: process.env.TENANT_DATABASE_URL });
  await registry.connect();
  const tenants = await registry.query(
    `SELECT org_id, subdomain, db_name
     FROM tenants
     WHERE LOWER(subdomain) LIKE $1
        OR LOWER(org_id) LIKE $1
        OR LOWER(db_name) LIKE $1`,
    [`%${search}%`]
  );
  await registry.end();

  if (!tenants.rows.length) {
    console.error(`No tenant found for: ${search}`);
    process.exit(1);
  }

  const baseUrl = process.env.DATABASE_URL;
  for (const tenant of tenants.rows) {
    const tenantUrl = baseUrl.replace(/\/[^/?]+(\?|$)/, `/${tenant.db_name}$1`);
    const client = new Client({ connectionString: tenantUrl });
    await client.connect();
    console.log(`\n=== ${tenant.org_id} (${tenant.db_name}) ===`);
    await ensureOnTenantDb(client, tenant.org_id);
    await client.end();
  }

  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
