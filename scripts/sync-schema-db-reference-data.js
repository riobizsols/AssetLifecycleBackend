#!/usr/bin/env node
/**
 * Backfill schema_db with master/reference rows used during tenant provisioning.
 * Copies missing rows from GENERIC_URL (assetLifecycle) into TENANT_SCHEMA_REFERENCE_URL (schema_db).
 *
 * Usage: node scripts/sync-schema-db-reference-data.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const { copyReferenceTableRows } = require('../services/tenantReferenceDataService');

/** Same tables tenant provisioning reads from schema_db. */
const PROVISIONING_TABLES = [
  { table: 'tblIDSequences', pk: ['table_key'] },
  { table: 'tblEvents', pk: null },
  { table: 'tblApps', pk: ['app_id'] },
  { table: 'tblAuditLogConfig', pk: null },
  { table: 'tblMaintStatus', pk: null },
  { table: 'tblMaintTypes', pk: null },
  { table: 'tblOrgSettings', pk: null },
  { table: 'tblTableFilterColumns', pk: null },
  { table: 'tblTechnicalLogConfig', pk: null },
  { table: 'tblTextMessagesDefault', pk: ['tmd_id'] },
  { table: 'tblTextMessagesOtherLangs', pk: ['tmol_id'] },
  { table: 'tblStatusCodes', pk: ['id'] },
  { table: 'tblProps', pk: ['prop_id'] },
  { table: 'tblUom', pk: ['uom_id'] },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const sourceUrl = process.env.GENERIC_URL;
  const targetUrl = process.env.TENANT_SCHEMA_REFERENCE_URL;

  if (!sourceUrl) {
    throw new Error('GENERIC_URL must be set (assetLifecycle source database)');
  }
  if (!targetUrl) {
    throw new Error('TENANT_SCHEMA_REFERENCE_URL must be set (schema_db target database)');
  }

  const sourceClient = new Client({ connectionString: sourceUrl, ssl: false });
  const targetClient = new Client({ connectionString: targetUrl, ssl: false });

  await sourceClient.connect();
  await targetClient.connect();

  const sourceDb = (await sourceClient.query('SELECT current_database() AS db')).rows[0].db;
  const targetDb = (await targetClient.query('SELECT current_database() AS db')).rows[0].db;

  console.log(`\nSync reference data: ${sourceDb} → ${targetDb}${dryRun ? ' (dry-run)' : ''}\n`);

  await sourceClient.query('SET search_path TO public');
  await targetClient.query('SET search_path TO public');

  const summary = [];

  for (const spec of PROVISIONING_TABLES) {
    if (dryRun) {
      const exists = await targetClient.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS e`,
        [spec.table],
      );
      if (!exists.rows[0].e) {
        summary.push({ table: spec.table, inserted: 0, skipped: true, reason: 'missing_in_schema_db' });
        console.log(`  ${spec.table}: table missing in ${targetDb}`);
        continue;
      }
    }

    if (dryRun) {
      summary.push({ table: spec.table, inserted: '(skipped dry-run)' });
      continue;
    }

    const result = await copyReferenceTableRows(sourceClient, targetClient, spec.table, {
      pk: spec.pk,
      missingOnly: true,
    });

    summary.push(result);

    const errCount = (result.errors || []).length;
    console.log(
      `  ${spec.table}: +${result.inserted} inserted, ${result.skippedRows || 0} already present` +
        (result.skipped ? ` (${result.reason || 'skipped'})` : '') +
        (errCount ? `, ${errCount} errors` : ''),
    );

    if (errCount) {
      for (const err of result.errors.slice(0, 3)) {
        console.warn(`    ⚠ ${err.key}: ${err.error}`);
      }
      if (errCount > 3) {
        console.warn(`    ⚠ ... and ${errCount - 3} more errors`);
      }
    }
  }

  await sourceClient.end();
  await targetClient.end();

  console.log('\n=== Sync complete ===');
  const totalInserted = summary.reduce((n, r) => n + (Number(r.inserted) || 0), 0);
  console.log(`Total rows inserted: ${totalInserted}`);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
