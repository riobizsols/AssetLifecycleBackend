#!/usr/bin/env node
/**
 * Compare public schema tables: hospitality (reference) vs tenant DB.
 * Usage: node scripts/compare-tenant-tables.js [tenant_db_name]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const tenantDb = process.argv[2] || 'skasc_db';

function hospitalityUrl() {
  if (process.env.HOSPITALITY_DATABASE_URL) return process.env.HOSPITALITY_DATABASE_URL;
  const base = process.env.DATABASE_URL || process.env.TENANT_DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, '/hospitality$2');
}

function tenantUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

async function listTables(pool) {
  const { rows } = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function main() {
  const refPool = new Pool({ connectionString: hospitalityUrl(), ssl: false });
  const tenantPool = new Pool({ connectionString: tenantUrl(tenantDb), ssl: false });

  try {
    const [refTables, tenantTables] = await Promise.all([
      listTables(refPool),
      listTables(tenantPool),
    ]);

    const refSet = new Set(refTables);
    const tenantSet = new Set(tenantTables);

    const missingInTenant = refTables.filter((t) => !tenantSet.has(t));
    const extraInTenant = tenantTables.filter((t) => !refSet.has(t));

    console.log('=== Database table comparison ===');
    console.log('Reference (hospitality):', hospitalityUrl().replace(/:[^:@/]+@/, ':***@'));
    console.log('Tenant:', tenantUrl(tenantDb).replace(/:[^:@/]+@/, ':***@'));
    console.log('');
    console.log(`Hospitality tables: ${refTables.length}`);
    console.log(`${tenantDb} tables:     ${tenantTables.length}`);
    console.log(`Missing in ${tenantDb}: ${missingInTenant.length}`);
    console.log(`Extra in ${tenantDb}:   ${extraInTenant.length}`);
    console.log('');

    if (missingInTenant.length) {
      console.log(`--- Missing in ${tenantDb} (${missingInTenant.length}) ---`);
      for (const t of missingInTenant) console.log(`  ${t}`);
    }

    if (extraInTenant.length) {
      console.log('');
      console.log(`--- Only in ${tenantDb}, not in hospitality (${extraInTenant.length}) ---`);
      for (const t of extraInTenant) console.log(`  ${t}`);
    }

    // Write JSON report for reference
    const fs = require('fs');
    const reportPath = require('path').join(__dirname, `compare-${tenantDb}-vs-hospitality.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          referenceDb: 'hospitality',
          tenantDb,
          hospitalityTableCount: refTables.length,
          tenantTableCount: tenantTables.length,
          missingInTenant,
          extraInTenant,
        },
        null,
        2
      )
    );
    console.log('');
    console.log('Report saved:', reportPath);
  } finally {
    await refPool.end();
    await tenantPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
