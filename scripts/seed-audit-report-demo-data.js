#!/usr/bin/env node
/**
 * Seed demo department / invoice / maintenance / breakdown / cert / invoice / PO
 * history for assets mapped to Fire Safety + NABH so Audit Reports tabs are populated.
 *
 * Usage:
 *   node scripts/seed-audit-report-demo-data.js [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const DEFAULT_DBS = ['hospitality'];
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

function nextPrefixedId(existing, prefix, width = 3) {
  let max = 0;
  for (const id of existing) {
    const m = String(id || '').match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return (n) => `${prefix}${String(n).padStart(width, '0')}`;
}

async function loadHelpers(client, orgId) {
  const depts = (
    await client.query(
      `SELECT dept_id FROM "tblDepartments" WHERE org_id = $1 OR org_id IS NULL ORDER BY dept_id`,
      [orgId],
    )
  ).rows.map((r) => r.dept_id);
  const vendors = (
    await client.query(
      `SELECT vendor_id FROM "tblVendors" WHERE org_id = $1 ORDER BY vendor_id LIMIT 10`,
      [orgId],
    )
  ).rows.map((r) => r.vendor_id);
  const users = (
    await client.query(
      `SELECT user_id FROM "tblUsers" WHERE org_id = $1 ORDER BY user_id LIMIT 10`,
      [orgId],
    )
  ).rows.map((r) => r.user_id);
  const reasons = (
    await client.query(`SELECT atbrrc_id FROM "tblATBRReasonCodes" ORDER BY atbrrc_id LIMIT 20`)
  ).rows.map((r) => r.atbrrc_id);
  const maintType =
    (
      await client.query(
        `SELECT maint_type_id FROM "tblMaintTypes" WHERE text ILIKE '%regular%' LIMIT 1`,
      )
    ).rows[0]?.maint_type_id ||
    (
      await client.query(`SELECT maint_type_id FROM "tblMaintTypes" ORDER BY maint_type_id LIMIT 1`)
    ).rows[0]?.maint_type_id;
  const dtoByType = {};
  const dtos = await client.query(
    `SELECT dto_id, UPPER(doc_type) AS doc_type FROM "tblDocTypeObjects" ORDER BY dto_id`,
  );
  for (const row of dtos.rows) {
    if (!dtoByType[row.doc_type]) dtoByType[row.doc_type] = row.dto_id;
  }
  return { depts, vendors, users, reasons, maintType, dtoByType };
}

async function nextIdFactory(client, table, col, prefix) {
  const { rows } = await client.query(`SELECT ${col} AS id FROM "${table}"`);
  const fmt = nextPrefixedId(
    rows.map((r) => r.id),
    prefix,
  );
  let n =
    Math.max(
      0,
      ...rows.map((r) => {
        const m = String(r.id || '').match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
        return m ? parseInt(m[1], 10) : 0;
      }),
    ) + 1;
  return () => fmt(n++);
}

async function seedDb(dbName) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  try {
    const orgRes = await client.query(`SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`);
    const orgId = orgRes.rows[0]?.org_id;
    if (!orgId) return { skipped: true, reason: 'no org' };

    const helpers = await loadHelpers(client, orgId);
    if (!helpers.depts.length || !helpers.vendors.length || !helpers.maintType) {
      return { skipped: true, reason: 'missing masters' };
    }

    const { rows: assets } = await client.query(
      `
        SELECT DISTINCT a.asset_id, a.serial_number, a.branch_id, a.dept_id, a.invoice_no,
               a.purchase_vendor_id, a.asset_type_id
        FROM "tblAssets" a
        INNER JOIN "tblAuditATMapping" m
          ON m.assettype_id = a.asset_type_id
         AND COALESCE(m.int_status, 1) = 1
         AND m.audtp_id IN ('AUDTP001', 'AUDTP002')
        WHERE a.org_id = $1
        ORDER BY a.asset_id
      `,
      [orgId],
    );

    if (!assets.length) return { assets: 0 };

    const nextAms = await nextIdFactory(client, 'tblAssetMaintSch', 'ams_id', 'AMS');
    const nextAbr = await nextIdFactory(client, 'tblAssetBRDet', 'abr_id', 'ABR');
    const nextAd = await nextIdFactory(client, 'tblAssetDocs', 'a_d_id', 'AD');

    let updatedAssets = 0;
    let maintAdded = 0;
    let brAdded = 0;
    let docsAdded = 0;
    let maintPatched = 0;

    const year = new Date().getFullYear();

    const realDoc = await client.query(
      `
        SELECT doc_path FROM "tblAssetDocs"
        WHERE COALESCE(is_archived, false) = false
          AND doc_path IS NOT NULL AND BTRIM(doc_path) <> ''
          AND doc_path NOT LIKE '%audit-demo%'
        ORDER BY a_d_id DESC
        LIMIT 1
      `,
    );
    const realDocPath = realDoc.rows[0]?.doc_path || null;

    for (let i = 0; i < assets.length; i += 1) {
      const asset = assets[i];
      const deptId = helpers.depts[i % helpers.depts.length];
      const vendorId =
        asset.purchase_vendor_id && helpers.vendors.includes(asset.purchase_vendor_id)
          ? asset.purchase_vendor_id
          : helpers.vendors[i % helpers.vendors.length];
      const invoiceNo = asset.invoice_no || `INV-AUD-${String(i + 1).padStart(4, '0')}`;

      await client.query(
        `
          UPDATE "tblAssets"
          SET dept_id = COALESCE(dept_id, $2),
              invoice_no = COALESCE(NULLIF(BTRIM(invoice_no), ''), $3),
              purchase_vendor_id = COALESCE(purchase_vendor_id, $4)
          WHERE asset_id = $1
        `,
        [asset.asset_id, deptId, invoiceNo, vendorId],
      );
      updatedAssets += 1;

      // Patch existing current-year maint with invoice/PO/tech if blank
      const patched = await client.query(
        `
          UPDATE "tblAssetMaintSch"
          SET invoice = COALESCE(NULLIF(BTRIM(invoice), ''), $2),
              po_number = COALESCE(NULLIF(BTRIM(po_number), ''), $3),
              technician_name = COALESCE(NULLIF(BTRIM(technician_name), ''), $4),
              notes = COALESCE(NULLIF(BTRIM(notes), ''), $5)
          WHERE asset_id = $1
            AND org_id = $6
            AND act_maint_st_date IS NOT NULL
            AND (act_maint_st_date)::timestamp::date BETWEEN $7::date AND $8::date
            AND (
              invoice IS NULL OR BTRIM(invoice) = ''
              OR po_number IS NULL OR BTRIM(po_number) = ''
              OR technician_name IS NULL OR BTRIM(technician_name) = ''
              OR notes IS NULL OR BTRIM(notes) = ''
            )
        `,
        [
          asset.asset_id,
          `MINV-${asset.asset_id}`,
          `MPO-${asset.asset_id}`,
          'Demo Technician',
          `${DEMO_TAG} Safety inspection completed`,
          orgId,
          `${year}-01-01`,
          `${year}-12-31`,
        ],
      );
      maintPatched += patched.rowCount || 0;

      const existingMaint = await client.query(
        `
          SELECT 1 FROM "tblAssetMaintSch"
          WHERE asset_id = $1 AND org_id = $2
            AND (
              notes ILIKE $3
              OR (
                act_maint_st_date IS NOT NULL
                AND (act_maint_st_date)::timestamp::date BETWEEN $4::date AND $5::date
              )
            )
          LIMIT 1
        `,
        [asset.asset_id, orgId, `${DEMO_TAG}%`, `${year}-01-01`, `${year}-12-31`],
      );

      if (!existingMaint.rows.length) {
        const month = (i % 10) + 1;
        const day = ((i * 3) % 27) + 1;
        const st = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 10:00:00`;
        await client.query(
          `
            INSERT INTO "tblAssetMaintSch"
              (ams_id, asset_id, maint_type_id, vendor_id, notes, status,
               act_maint_st_date, act_main_end_date, po_number, invoice,
               technician_name, created_by, created_on, org_id, wo_id, branch_id, dept_id)
            VALUES
              ($1, $2, $3, $4, $5, 'CO',
               $6::timestamp, $6::timestamp + interval '2 hours', $7, $8,
               $9, 'SYSTEM', CURRENT_TIME, $10, $11, $12, $13)
          `,
          [
            nextAms(),
            asset.asset_id,
            helpers.maintType,
            vendorId,
            `${DEMO_TAG} Periodic safety check`,
            st,
            `MPO-${asset.asset_id}`,
            `MINV-${asset.asset_id}`,
            'Demo Technician',
            orgId,
            `WO-AUD-${asset.asset_id}`,
            asset.branch_id,
            deptId,
          ],
        );
        maintAdded += 1;
      }

      const existingBr = await client.query(
        `
          SELECT 1 FROM "tblAssetBRDet"
          WHERE asset_id = $1 AND org_id = $2
            AND (
              description ILIKE $3
              OR created_on::date BETWEEN $4::date AND $5::date
            )
          LIMIT 1
        `,
        [asset.asset_id, orgId, `${DEMO_TAG}%`, `${year}-01-01`, `${year}-12-31`],
      );

      if (!existingBr.rows.length && helpers.reasons.length) {
        const month = ((i + 2) % 10) + 1;
        const day = ((i * 5) % 27) + 1;
        const created = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 14:30:00`;
        await client.query(
          `
            INSERT INTO "tblAssetBRDet"
              (abr_id, asset_id, atbrrc_id, reported_by, is_create_maintenance, status,
               description, org_id, created_on, branch_id, dept_id)
            VALUES
              ($1, $2, $3, $4, false, 'CR',
               $5, $6, $7::timestamp, $8, $9)
          `,
          [
            nextAbr(),
            asset.asset_id,
            helpers.reasons[i % helpers.reasons.length],
            helpers.users[i % Math.max(helpers.users.length, 1)] || null,
            `${DEMO_TAG} Equipment fault reported during audit prep`,
            orgId,
            created,
            asset.branch_id,
            deptId,
          ],
        );
        brAdded += 1;
      }

      const docSpecs = [
        { type: 'IC', name: 'Inspection Certificate', file: 'inspection-certificate.pdf' },
        { type: 'WA', name: 'Warranty', file: 'warranty.pdf' },
        { type: 'INV', name: 'Invoice', file: 'invoice.pdf' },
        { type: 'PO', name: 'Purchase Order', file: 'purchase-order.pdf' },
      ];

      for (const spec of docSpecs) {
        const dtoId = helpers.dtoByType[spec.type];
        if (!dtoId) continue;
        const placeholderPath = `alm-main/${orgId}/ASSET DOCUMENT/${asset.asset_id}/${DOC_MARKER}/${spec.file}`;
        const path = realDocPath || placeholderPath;
        const exists = await client.query(
          `
            SELECT 1 FROM "tblAssetDocs"
            WHERE asset_id = $1
              AND dto_id = $2
              AND (
                doc_path = $3
                OR doc_path LIKE $4
                OR doc_type_name = $5
              )
            LIMIT 1
          `,
          [asset.asset_id, dtoId, path, `%/${DOC_MARKER}/${spec.file}`, spec.name],
        );
        if (exists.rows.length) {
          if (realDocPath) {
            await client.query(
              `
                UPDATE "tblAssetDocs"
                SET doc_path = $1
                WHERE asset_id = $2
                  AND dto_id = $3
                  AND doc_path LIKE $4
              `,
              [realDocPath, asset.asset_id, dtoId, `%/${DOC_MARKER}/%`],
            );
          }
          continue;
        }
        await client.query(
          `
            INSERT INTO "tblAssetDocs"
              (a_d_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, org_id, branch_id, dept_id)
            VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8)
          `,
          [nextAd(), asset.asset_id, dtoId, spec.name, path, orgId, asset.branch_id, deptId],
        );
        docsAdded += 1;
      }
    }

    return {
      assets: assets.length,
      updatedAssets,
      maintAdded,
      maintPatched,
      brAdded,
      docsAdded,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const dbs = process.argv.slice(2);
  const targets = dbs.length ? dbs : DEFAULT_DBS;
  console.log(`[seed-audit-report-demo-data] dbs: ${targets.join(', ')}`);
  for (const db of targets) {
    try {
      const result = await seedDb(db);
      console.log(`  ${db}:`, result);
    } catch (err) {
      console.error(`  ${db}: FAILED`, err.message);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
