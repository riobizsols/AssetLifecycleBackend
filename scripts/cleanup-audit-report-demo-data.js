#!/usr/bin/env node
/**
 * Remove rows/fields created by seed-audit-report-demo-data.js
 * so Audit Reports only show real operational data.
 *
 * Usage:
 *   node scripts/cleanup-audit-report-demo-data.js [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const DEFAULT_DBS = ['hospitality', 'ngp_db'];
const DEMO_TAG = '[Audit Demo]';
const DOC_MARKER = 'audit-demo';

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

async function cleanupDb(dbName) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');

    const br = await client.query(
      `DELETE FROM "tblAssetBRDet" WHERE description ILIKE $1`,
      [`${DEMO_TAG}%`],
    );

    // Detach spare issues from demo maintenance before delete (FK)
    await client.query(
      `
        UPDATE "tblSpareIssue" si
        SET assetmaintsch_id = NULL
        WHERE si.assetmaintsch_id IN (
          SELECT ams_id FROM "tblAssetMaintSch"
          WHERE notes ILIKE $1 OR technician_name = $2
        )
      `,
      [`%${DEMO_TAG}%`, 'Demo Technician'],
    );

    const maint = await client.query(
      `
        DELETE FROM "tblAssetMaintSch"
        WHERE notes ILIKE $1
           OR technician_name = $2
      `,
      [`%${DEMO_TAG}%`, 'Demo Technician'],
    );

    // Clear leftover seed invoice/PO markers on any remaining rows
    const maintClear = await client.query(
      `
        UPDATE "tblAssetMaintSch"
        SET invoice = CASE WHEN invoice ~* '^MINV-' THEN NULL ELSE invoice END,
            po_number = CASE WHEN po_number ~* '^MPO-' THEN NULL ELSE po_number END
        WHERE invoice ~* '^MINV-'
           OR po_number ~* '^MPO-'
      `,
    );

    const docs = await client.query(
      `DELETE FROM "tblAssetDocs" WHERE doc_path ILIKE $1`,
      [`%${DOC_MARKER}%`],
    );

    // Seed often rewrote demo docs to one real PDF path on many assets — remove those clones
    const dupDocs = await client.query(
      `
        DELETE FROM "tblAssetDocs" ad
        WHERE ad.doc_path LIKE '%/AST108/1788498262114_14d8d95afeba1bfe.pdf'
          AND ad.asset_id <> 'AST108'
          AND (
            COALESCE(ad.doc_type_name, '') IN (
              'Invoice', 'Purchase Order', 'Inspection Certificate', 'Warranty'
            )
            OR ad.dto_id IN (
              SELECT dto_id FROM "tblDocTypeObjects"
              WHERE UPPER(doc_type) IN ('INV', 'PO', 'IC', 'WA')
            )
          )
      `,
    );

    const assets = await client.query(
      `
        UPDATE "tblAssets"
        SET invoice_no = NULL
        WHERE invoice_no ~* '^INV-AUD-\\d+$'
      `,
    );

    await client.query('COMMIT');
    return {
      breakdownDeleted: br.rowCount || 0,
      maintDeleted: maint.rowCount || 0,
      maintCleared: maintClear.rowCount || 0,
      docsDeleted: (docs.rowCount || 0) + (dupDocs.rowCount || 0),
      assetInvoicesCleared: assets.rowCount || 0,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const dbs = process.argv.slice(2);
  const targets = dbs.length ? dbs : DEFAULT_DBS;
  console.log(`[cleanup-audit-report-demo-data] dbs: ${targets.join(', ')}`);
  for (const db of targets) {
    try {
      const result = await cleanupDb(db);
      console.log(`  ${db}:`, result);
    } catch (err) {
      console.error(`  ${db}: FAILED`, err.message);
      process.exitCode = 1;
    }
  }
}

main();
