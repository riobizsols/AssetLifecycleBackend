#!/usr/bin/env node
/**
 * Rebuild JR001 navigation for a tenant with proper JRN### ids.
 * Usage: node scripts/repair-tenant-job-role-nav.js <tenant_db> [org_id] [job_role_id]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { copyJobRoleNavigationForRole } = require('../services/tenantSetupService');
const { getReferenceUrl } = require('../services/tenantSchemaAlignService');

const tenantDb = process.argv[2] || 'exp_db';
const orgId = process.argv[3] || 'EXP';
const jobRoleId = process.argv[4] || 'JR001';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function parseDatabaseUrl(databaseUrl) {
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('Invalid database URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  };
}

(async () => {
  const referenceUrl = getReferenceUrl();
  const refConfig = parseDatabaseUrl(referenceUrl);

  const referenceClient = new Client({
    host: refConfig.host,
    port: refConfig.port,
    user: refConfig.user,
    password: refConfig.password,
    database: refConfig.database,
    ssl: false,
  });

  const tenantClient = new Client({ connectionString: tenantUrl(tenantDb), ssl: false });

  await referenceClient.connect();
  await tenantClient.connect();

  const deleted = await tenantClient.query(
    `DELETE FROM "tblJobRoleNav" WHERE job_role_id = $1`,
    [jobRoleId],
  );
  console.log(`Removed ${deleted.rowCount} existing nav rows for ${jobRoleId}`);

  const result = await copyJobRoleNavigationForRole(
    referenceClient,
    tenantClient,
    orgId,
    jobRoleId,
  );

  console.log(`Inserted ${result.copied} nav rows (max JRN ${result.maxJrn || 'n/a'})`);

  const invalid = await tenantClient.query(`
    SELECT job_role_nav_id, app_id
    FROM "tblJobRoleNav"
    WHERE job_role_id = $1 AND job_role_nav_id !~ '^JRN[0-9]+$'
  `, [jobRoleId]);
  console.log(`Invalid nav ids remaining: ${invalid.rows.length}`);
  if (invalid.rows.length > 0) {
    console.log(invalid.rows);
  }

  const inspection = await tenantClient.query(`
    SELECT job_role_nav_id, app_id, parent_id, label
    FROM "tblJobRoleNav"
    WHERE job_role_id = $1 AND app_id ILIKE '%INSPECTION%'
    ORDER BY app_id
  `, [jobRoleId]);
  console.log('Inspection-related nav:');
  console.log(JSON.stringify(inspection.rows, null, 2));

  await referenceClient.end();
  await tenantClient.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
