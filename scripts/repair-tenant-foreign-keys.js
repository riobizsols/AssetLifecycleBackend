#!/usr/bin/env node
/**
 * Repair an existing tenant: remap org_id values and apply missing foreign keys.
 * Usage: node scripts/repair-tenant-foreign-keys.js <tenant_db_name>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');
const setupWizardService = require('../services/setupWizardService');
const {
  finalizeTenantForeignKeys,
  countForeignKeys,
} = require('../services/tenantForeignKeyService');

const tenantDb = process.argv[2] || 'kia_db';

function tenantUrl(name) {
  return (process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL).replace(
    /\/([^/?]+)(\?.*)?$/i,
    `/${name}$2`,
  );
}

async function main() {
  const client = new Client(buildPoolConfig(tenantUrl(tenantDb), { connectionTimeoutMillis: 30000 }));
  await client.connect();
  await client.query('SET search_path TO public');

  const before = await countForeignKeys(client);
  const { rows: orgRows } = await client.query('SELECT org_id FROM "tblOrgs" LIMIT 1');
  const orgId = orgRows[0]?.org_id;
  if (!orgId) throw new Error('No org found in tblOrgs');

  const { rows: userRows } = await client.query(
    'SELECT user_id FROM "tblUsers" ORDER BY user_id LIMIT 1',
  );
  const adminUserId = userRows[0]?.user_id || 'USR001';

  console.log(`Repairing ${tenantDb} (org_id=${orgId}), FK count before: ${before}`);

  setupWizardService.clearSchemaCache();
  const schemaResult = await setupWizardService.getSchemaSql(false, true);
  const foreignKeysSql = typeof schemaResult === 'object' ? schemaResult.foreignKeys : '';
  const expectedCount = typeof schemaResult === 'object' ? schemaResult.validCount || 0 : 0;

  const result = await finalizeTenantForeignKeys(client, orgId, foreignKeysSql, {
    expectedCount,
    label: 'RepairTenantFK',
    adminUserId,
    strictCount: false,
  });

  console.log(JSON.stringify({ tenantDb, orgId, before, after: result.totalFkInDb, ...result }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
