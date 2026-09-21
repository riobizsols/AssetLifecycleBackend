/**
 * Migration: Add optional actual_downtime (hours) to tblAssetMaintSch.
 * NULL means no actual downtime was recorded for the maintenance work order.
 *
 * Usage (all ALM tenant databases):
 *   node migrations/add-actual-downtime-to-maintenance-schedule.js --all-tenants
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');

async function addActualDowntimeColumn(client) {
  const before = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblAssetMaintSch'
      AND column_name = 'actual_downtime'
  `);

  await client.query(`
    ALTER TABLE "tblAssetMaintSch"
    ADD COLUMN IF NOT EXISTS actual_downtime DECIMAL(10,2)
  `);

  if (before.rows.length === 0) {
    await client.query(`
      COMMENT ON COLUMN "tblAssetMaintSch".actual_downtime IS
      'Actual asset downtime in hours recorded when maintenance is completed. NULL means no downtime.'
    `);
  }

  const after = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblAssetMaintSch'
      AND column_name = 'actual_downtime'
  `);

  return {
    added: before.rows.length === 0,
    column: after.rows[0] || null,
  };
}

async function runOnDatabase(connectionString, label) {
  const client = new Client(buildPoolConfig(connectionString));
  await client.connect();
  try {
    console.log(`\n=== ${label} ===`);
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tblAssetMaintSch'
      ) AS exists
    `);
    if (!tableExists.rows[0]?.exists) {
      console.log('tblAssetMaintSch not found — skipping');
      return { skipped: true, label };
    }

    const result = await addActualDowntimeColumn(client);
    console.log(
      result.added
        ? '✅ actual_downtime column added'
        : '✅ actual_downtime column already exists'
    );
    if (result.column) {
      console.log(`   type=${result.column.data_type}, nullable=${result.column.is_nullable}`);
    }
    return { success: true, label, ...result };
  } finally {
    await client.end();
  }
}

function databaseNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, '').split('?')[0] || url;
  } catch {
    const match = String(url).match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : url;
  }
}

async function getTenantTargets() {
  const registryUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!registryUrl) {
    throw new Error('Set TENANT_DATABASE_URL or DATABASE_URL for --all-tenants');
  }

  const client = new Client(buildPoolConfig(registryUrl));
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT grouped_org_id AS org_id, db_name, subdomain, is_active
      FROM "tenants"
      WHERE is_active = true AND db_name IS NOT NULL
      ORDER BY grouped_org_id
    `);
    const baseUrl = registryUrl.replace(/\/[^/]+(\?.*)?$/, '');
    const querySuffix = registryUrl.includes('?') ? registryUrl.slice(registryUrl.indexOf('?')) : '';
    return rows.map((row) => ({
      orgId: row.org_id,
      subdomain: row.subdomain || row.org_id,
      dbName: row.db_name,
      url: `${baseUrl}/${row.db_name}${querySuffix}`,
    }));
  } finally {
    await client.end();
  }
}

function collectUniqueTargets() {
  const targets = [];
  const seenDbNames = new Set();

  const addTarget = (url, label) => {
    if (!url) return;
    const dbName = databaseNameFromUrl(url);
    if (seenDbNames.has(dbName)) return;
    seenDbNames.add(dbName);
    targets.push({ url, label: `${label} (${dbName})` });
  };

  addTarget(process.env.DATABASE_URL, 'DATABASE_URL');
  addTarget(process.env.GENERIC_URL, 'GENERIC_URL');
  addTarget(process.env.TENANT_SCHEMA_REFERENCE_URL, 'TENANT_SCHEMA_REFERENCE_URL');

  return { targets, seenDbNames };
}

async function main() {
  const allTenants = process.argv.includes('--all-tenants');
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!allTenants) {
    if (!targetUrl) {
      throw new Error('Set DATABASE_URL, TARGET_DATABASE_URL, or use --all-tenants');
    }
    await runOnDatabase(targetUrl, `target (${databaseNameFromUrl(targetUrl)})`);
    return;
  }

  const { targets, seenDbNames } = collectUniqueTargets();
  const tenantRows = await getTenantTargets();

  for (const tenant of tenantRows) {
    if (seenDbNames.has(tenant.dbName)) continue;
    seenDbNames.add(tenant.dbName);
    targets.push({
      url: tenant.url,
      label: `${tenant.subdomain || tenant.orgId} (${tenant.dbName})`,
    });
  }

  console.log(`Running actual_downtime migration on ${targets.length} database(s)...`);
  const results = [];

  for (const target of targets) {
    try {
      results.push(await runOnDatabase(target.url, target.label));
    } catch (error) {
      console.error(`❌ ${target.label}: ${error.message}`);
      results.push({ success: false, label: target.label, error: error.message });
    }
  }

  const failed = results.filter((r) => r.error);
  const skipped = results.filter((r) => r.skipped);
  const ok = results.filter((r) => r.success);

  console.log('\n========================================');
  console.log(`Done. Success: ${ok.length}, Skipped: ${skipped.length}, Failed: ${failed.length}`);
  console.log('========================================');

  if (failed.length) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { addActualDowntimeColumn, runOnDatabase };
