#!/usr/bin/env node
/**
 * Sync tblProps + tblAssetPropListValues from hospitality → schema_db.
 * Usage: node scripts/sync-schema-db-prop-list-values.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');
const { copyReferenceTableRows } = require('../services/tenantReferenceDataService');

function hospitalityUrl() {
  if (process.env.HOSPITALITY_DATABASE_URL) return process.env.HOSPITALITY_DATABASE_URL;
  const base = process.env.GENERIC_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('Set GENERIC_URL or HOSPITALITY_DATABASE_URL');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, '/hospitality$2');
}

const TABLES = [
  { table: 'tblProps', pk: ['prop_id'] },
  { table: 'tblAssetPropListValues', pk: ['aplv_id'] },
];

async function main() {
  const sourceUrl = hospitalityUrl();
  const targetUrl = process.env.TENANT_SCHEMA_REFERENCE_URL;
  if (!targetUrl) throw new Error('TENANT_SCHEMA_REFERENCE_URL must be set');

  const source = new Client({ connectionString: sourceUrl, ssl: false });
  const target = new Client({ connectionString: targetUrl, ssl: false });
  await source.connect();
  await target.connect();
  await source.query('SET search_path TO public');
  await target.query('SET search_path TO public');

  const srcDb = (await source.query('SELECT current_database() AS db')).rows[0].db;
  const tgtDb = (await target.query('SELECT current_database() AS db')).rows[0].db;
  console.log(`Sync property list values: ${srcDb} → ${tgtDb}\n`);

  for (const spec of TABLES) {
    const result = await copyReferenceTableRows(source, target, spec.table, {
      pk: spec.pk,
      missingOnly: true,
    });
    console.log(
      `  ${spec.table}: +${result.inserted} inserted, ${result.skippedRows || 0} already present`,
    );
    if (result.errors?.length) {
      result.errors.slice(0, 5).forEach((e) => console.warn(`    ⚠ ${e.key}: ${e.error}`));
    }
  }

  for (const t of ['tblProps', 'tblAssetPropListValues']) {
    const src = (await source.query(`SELECT COUNT(*)::int c FROM "${t}"`)).rows[0].c;
    const dst = (await target.query(`SELECT COUNT(*)::int c FROM "${t}"`)).rows[0].c;
    console.log(`  ${t}: source=${src} schema_db=${dst}`);
  }

  await source.end();
  await target.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
