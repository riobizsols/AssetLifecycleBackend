#!/usr/bin/env node
/**
 * Drop load-test tenant databases and remove registry rows.
 * Matches: tc100*, tsmk5b*, smoke5*, loadtest* org/db patterns from tenant create load tests.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

function adminClient() {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  const url = base.replace(/\/([^/?]+)(\?.*)?$/i, '/postgres$2');
  return new Client(buildPoolConfig(url, { connectionTimeoutMillis: 30000 }));
}

function registryClient() {
  return new Client(buildPoolConfig(process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL, {
    connectionTimeoutMillis: 30000,
  }));
}

function isLoadTestDbName(name) {
  return (
    /^tc100\d+_db$/i.test(name) ||
    /^tsmk5b\d+_db$/i.test(name) ||
    /^tsmoke5\d+_db$/i.test(name) ||
    /^tload\d+_db$/i.test(name) ||
    /^t[a-z0-9]{4,12}\d{3}_db$/i.test(name) && /^(tc100|tsmk5b|tsmoke5)/i.test(name)
  );
}

function isLoadTestOrgId(orgId) {
  if (!orgId) return false;
  const id = String(orgId).toUpperCase();
  return (
    /^TC100\d{3}$/.test(id) ||
    /^TSMK5B\d{3}$/.test(id) ||
    /^TSMK5B1000$/.test(id) ||
    /^TSMOKE5/.test(id)
  );
}

function collectFromReports() {
  const reportsDir = path.join(__dirname, '..', 'reports');
  const names = new Set();
  const orgIds = new Set();

  if (!fs.existsSync(reportsDir)) return { names, orgIds };

  for (const file of fs.readdirSync(reportsDir)) {
    if (!file.startsWith('tenant-create-load-test-') || !file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8'));
      (data.createdDatabases || []).forEach((d) => names.add(d));
      (data.createdOrgIds || []).forEach((o) => orgIds.add(o));
    } catch {
      // ignore bad report files
    }
  }

  // Warm-up db from smk5b run
  names.add('tsmk5b1000_db');
  orgIds.add('TSMK5B1000');

  return { names, orgIds };
}

async function terminateConnections(client, dbName) {
  await client.query(
    `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `,
    [dbName],
  ).catch(() => {});
}

async function dropDatabase(client, dbName) {
  await terminateConnections(client, dbName);
  await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
}

async function main() {
  const fromReports = collectFromReports();
  const admin = adminClient();
  const registry = registryClient();

  await admin.connect();
  await registry.connect();

  const { rows: dbRows } = await admin.query(`
    SELECT datname FROM pg_database
    WHERE datistemplate = false
      AND datname NOT IN ('postgres', 'template0', 'template1')
    ORDER BY datname
  `);

  const { rows: tenantRows } = await registry.query(`
    SELECT org_id, db_name, subdomain, is_active
    FROM tenants
    ORDER BY org_id
  `);

  const dbTargets = new Set(fromReports.names);
  for (const { datname } of dbRows) {
    if (isLoadTestDbName(datname)) dbTargets.add(datname);
  }
  for (const t of tenantRows) {
    if (isLoadTestOrgId(t.org_id) || isLoadTestDbName(t.db_name)) {
      if (t.db_name) dbTargets.add(t.db_name);
    }
  }

  const orgTargets = new Set(fromReports.orgIds);
  for (const t of tenantRows) {
    if (isLoadTestOrgId(t.org_id) || (t.db_name && dbTargets.has(t.db_name))) {
      orgTargets.add(t.org_id);
    }
  }

  const sortedDbs = [...dbTargets].sort();
  const sortedOrgs = [...orgTargets].sort();

  console.log(`Load-test cleanup ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`Databases to drop: ${sortedDbs.length}`);
  sortedDbs.forEach((d) => console.log(`  - ${d}`));
  console.log(`Tenant registry rows to delete: ${sortedOrgs.length}`);
  sortedOrgs.forEach((o) => console.log(`  - ${o}`));

  if (DRY_RUN) {
    await admin.end();
    await registry.end();
    return;
  }

  const dropped = [];
  const dropErrors = [];

  for (const dbName of sortedDbs) {
    try {
      await dropDatabase(admin, dbName);
      dropped.push(dbName);
      console.log(`✅ Dropped database: ${dbName}`);
    } catch (err) {
      dropErrors.push({ dbName, error: err.message });
      console.error(`❌ Failed to drop ${dbName}: ${err.message}`);
    }
  }

  let deletedTenants = 0;
  for (const orgId of sortedOrgs) {
    try {
      const result = await registry.query('DELETE FROM tenants WHERE org_id = $1', [orgId]);
      if (result.rowCount > 0) {
        deletedTenants += result.rowCount;
        console.log(`✅ Removed tenant registry row: ${orgId}`);
      }
    } catch (err) {
      console.error(`❌ Failed to delete tenant ${orgId}: ${err.message}`);
    }
  }

  await admin.end();
  await registry.end();

  console.log('\n========== CLEANUP SUMMARY ==========');
  console.log(`Dropped databases: ${dropped.length}/${sortedDbs.length}`);
  console.log(`Deleted tenant rows: ${deletedTenants}`);
  if (dropErrors.length) {
    console.log(`Drop errors: ${dropErrors.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
