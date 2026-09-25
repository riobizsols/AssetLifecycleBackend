/**
 * Seed realistic SLA & Vendor Performance data into a tenant DB (default: ngp_db).
 *
 * Fills:
 *  - tblVendorSLAs ……… SLA-1 (response) + SLA-3 (resolution) targets
 *  - tblAssetMaintSch … recent work orders (on-time, breached, open, cancelled)
 *  - tblAssetBRDet ……… breakdowns for repeat-failure metrics
 *  - tblvendorslarecs … recorded response hours + sla_rating (creates table if missing)
 *
 * Usage:
 *   node scripts/seed-sla-vendor-performance-data.js
 *   node scripts/seed-sla-vendor-performance-data.js ngp_db
 */
require('dotenv').config();
const { Client } = require('pg');

const NOTE_TAG = '[SLA Report Seed]';

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
  if (!name) return base;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

function ts(daysAgo, hour = 9, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

/** Add hours to a Date (for completion after request start). */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

function sqlTs(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function sqlTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

async function ensureVendorSlaRecs(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tblvendorslarecs (
      vslar_id character varying(50) PRIMARY KEY,
      vendor_id character varying(50),
      ams_id character varying(50),
      sla1_value character varying(50),
      sla2_value character varying(50),
      sla3_value character varying(50),
      sla4_value character varying(50),
      sla5_value character varying(50),
      sla6_value character varying(50),
      sla7_value character varying(50),
      sla8_value character varying(50),
      sla9_value character varying(50),
      sla10_value character varying(50),
      sla1_tech_name character varying(50),
      sla2_tech_name character varying(50),
      sla3_tech_name character varying(50),
      sla4_tech_name character varying(50),
      sla5_tech_name character varying(50),
      sla6_tech_name character varying(50),
      sla7_tech_name character varying(50),
      sla8_tech_name character varying(50),
      sla9_tech_name character varying(50),
      sla10_tech_name character varying(50),
      sla1_phone character varying(50),
      sla2_phone character varying(50),
      sla3_phone character varying(50),
      sla4_phone character varying(50),
      sla5_phone character varying(50),
      sla6_phone character varying(50),
      sla7_phone character varying(50),
      sla8_phone character varying(50),
      sla9_phone character varying(50),
      sla10_phone character varying(50),
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp without time zone,
      sla_rating character varying(50),
      org_id character varying(50),
      branch_id character varying(50),
      dept_id character varying(50)
    )
  `);
  await client.query(`
    INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
    VALUES ('vendor_sla_rec', 'VSLAR', 0)
    ON CONFLICT (table_key) DO UPDATE SET prefix = EXCLUDED.prefix
  `);
}

async function seedDb(dbName) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    await ensureVendorSlaRecs(client);

    const orgRes = await client.query(
      `SELECT org_id FROM "tblOrgs" WHERE text ILIKE '%NGP%' OR org_id = 'ORG003' ORDER BY org_id LIMIT 1`,
    );
    const orgId = orgRes.rows[0]?.org_id || 'ORG003';

    // ── Vendor SLA targets (required for compliance / breach calc) ──────────
    const vendorSlas = [
      { id: 'VSLA001', vendor_id: 'V001', sla1: '4 hours', sla3: '24 hours' },
      { id: 'VSLA002', vendor_id: 'V002', sla1: '2 hours', sla3: '12 hours' },
      { id: 'VSLA003', vendor_id: 'V007', sla1: '8 hours', sla3: '48 hours' },
      { id: 'VSLA004', vendor_id: 'V004', sla1: '4 hours', sla3: '1 day' },
      { id: 'VSLA005', vendor_id: 'V005', sla1: '6 hours', sla3: '36 hours' },
    ];

    for (const row of vendorSlas) {
      const exists = await client.query(
        `SELECT vsla_id FROM "tblVendorSLAs" WHERE vendor_id = $1 AND (org_id IS NULL OR org_id = $2) LIMIT 1`,
        [row.vendor_id, orgId],
      );
      if (exists.rows[0]) {
        await client.query(
          `
            UPDATE "tblVendorSLAs"
            SET "SLA-1" = $2, "SLA-3" = $3, int_status = 1, changed_on = CURRENT_TIMESTAMP, org_id = COALESCE(org_id, $4)
            WHERE vsla_id = $1
          `,
          [exists.rows[0].vsla_id, row.sla1, row.sla3, orgId],
        );
      } else {
        await client.query(
          `
            INSERT INTO "tblVendorSLAs"
              (vsla_id, vendor_id, "SLA-1", "SLA-3", created_by, created_on, int_status, org_id)
            VALUES ($1, $2, $3, $4, 'SEED', CURRENT_TIMESTAMP, 1, $5)
          `,
          [row.id, row.vendor_id, row.sla1, row.sla3, orgId],
        );
      }
    }

    // Prefer assets that exist under NGP branches
    const assetPick = await client.query(
      `
        SELECT asset_id, branch_id, asset_type_id
        FROM "tblAssets"
        WHERE asset_id = ANY($1::varchar[])
        ORDER BY asset_id
      `,
      [['AST154', 'AST107', 'AST003', 'AST006', 'AST009', 'AST044']],
    );
    const assets = assetPick.rows;
    if (assets.length < 3) {
      throw new Error('Need at least 3 assets (AST154/107/003/006/009/044) to seed SLA data');
    }

    const a = (i) => assets[i % assets.length];

    // Remove prior seed rows so re-runs are idempotent
    await client.query(
      `DELETE FROM tblvendorslarecs WHERE ams_id IN (SELECT ams_id FROM "tblAssetMaintSch" WHERE notes ILIKE $1)`,
      [`%${NOTE_TAG}%`],
    );
    await client.query(`DELETE FROM "tblAssetMaintSch" WHERE notes ILIKE $1`, [`%${NOTE_TAG}%`]);
    await client.query(`DELETE FROM "tblAssetBRDet" WHERE description ILIKE $1`, [`%${NOTE_TAG}%`]);

    /**
     * Work-order scenarios for last ~30 days (ORG003 / NGP).
     * resolution_hours implied by start→end vs vendor SLA-3.
     */
    const workOrders = [
      // V001 Leah — 24h resolution target
      { id: 'AMS020', asset: a(0), vendor: 'V001', mt: 'MT006', status: 'CO', start: ts(2, 9), endHours: 3, note: 'PM completed on time' },
      { id: 'AMS021', asset: a(1), vendor: 'V001', mt: 'MT010', status: 'CO', start: ts(5, 8), endHours: 30, note: 'Corrective — breached 24h SLA' },
      { id: 'AMS022', asset: a(2), vendor: 'V001', mt: 'MT002', status: 'CO', start: ts(8, 10), endHours: 8, note: 'Regular maint on time' },
      { id: 'AMS023', asset: a(0), vendor: 'V001', mt: 'MT006', status: 'IN', start: ts(1, 11), endHours: null, note: 'Open preventive request' },
      { id: 'AMS024', asset: a(3), vendor: 'V001', mt: 'MT010', status: 'CA', start: ts(4, 9), endHours: null, note: 'Cancelled by requester' },

      // V002 Petu — 12h resolution
      { id: 'AMS025', asset: a(4), vendor: 'V002', mt: 'MT002', status: 'CO', start: ts(3, 7), endHours: 8, note: 'On-time within 12h' },
      { id: 'AMS026', asset: a(5), vendor: 'V002', mt: 'MT010', status: 'CO', start: ts(7, 9), endHours: 26, note: 'Breached 12h target' },
      { id: 'AMS027', asset: a(4), vendor: 'V002', mt: 'MT006', status: 'IP', start: ts(0, 8), endHours: null, note: 'In progress today' },

      // V007 In-House — 48h resolution
      { id: 'AMS028', asset: a(0), vendor: 'V007', mt: 'MT002', status: 'CO', start: ts(10, 9), endHours: 23, note: 'In-house completed within 48h' },
      { id: 'AMS029', asset: a(1), vendor: 'V007', mt: 'MT010', status: 'CO', start: ts(12, 8), endHours: 60, note: 'In-house breached 48h' },
      { id: 'AMS030', asset: a(2), vendor: 'V007', mt: 'MT006', status: 'CO', start: ts(14, 10), endHours: 6, note: 'Quick in-house fix' },

      // Older within 30d for trend
      { id: 'AMS031', asset: a(3), vendor: 'V001', mt: 'MT006', status: 'CO', start: ts(18, 9), endHours: 11, note: 'Week-3 PM on time' },
      { id: 'AMS032', asset: a(5), vendor: 'V002', mt: 'MT002', status: 'CO', start: ts(20, 8), endHours: 25, note: 'Week-3 breach' },
      { id: 'AMS033', asset: a(0), vendor: 'V007', mt: 'MT010', status: 'CO', start: ts(22, 9), endHours: 8, note: 'Week-4 on time' },
      { id: 'AMS034', asset: a(1), vendor: 'V001', mt: 'MT002', status: 'CO', start: ts(25, 10), endHours: 29, note: 'Week-4 breach' },
      { id: 'AMS035', asset: a(2), vendor: 'V001', mt: 'MT006', status: 'CO', start: ts(27, 9), endHours: 4, note: 'Early month on time' },
      { id: 'AMS036', asset: a(4), vendor: 'V002', mt: 'MT010', status: 'IN', start: ts(6, 14), endHours: null, note: 'Still open corrective' },
      { id: 'AMS037', asset: a(3), vendor: 'V007', mt: 'MT002', status: 'CO', start: ts(9, 8), endHours: 3, note: 'Fast in-house close' },
    ];

    for (const wo of workOrders) {
      const end = wo.endHours != null ? addHours(wo.start, wo.endHours) : null;
      await client.query(
        `
          INSERT INTO "tblAssetMaintSch"
            (ams_id, org_id, asset_id, vendor_id, maint_type_id, status,
             act_maint_st_date, act_main_end_date, created_by, created_on, changed_on,
             notes, technician_name, wo_id, branch_id)
          VALUES
            ($1, $2, $3, $4, $5, $6,
             $7::timestamp, $8::timestamp, 'SEED', $9::time, $10::timestamp,
             $11, $12, $13, $14)
        `,
        [
          wo.id,
          orgId,
          wo.asset.asset_id,
          wo.vendor,
          wo.mt,
          wo.status,
          sqlTs(wo.start),
          end ? sqlTs(end) : null,
          sqlTime(wo.start),
          end ? sqlTs(end) : sqlTs(wo.start),
          `${NOTE_TAG} ${wo.note}`,
          wo.vendor === 'V007' ? 'In-House Tech' : 'Field Technician',
          `WO-${wo.id}`,
          wo.asset.branch_id || null,
        ],
      );
    }

    // Recorded response hours + ratings (completed WOs)
    const ratings = [
      { ams: 'AMS020', vendor: 'V001', sla1: '2', rating: '5' },
      { ams: 'AMS021', vendor: 'V001', sla1: '6', rating: '2' },
      { ams: 'AMS022', vendor: 'V001', sla1: '3', rating: '4' },
      { ams: 'AMS025', vendor: 'V002', sla1: '1', rating: '5' },
      { ams: 'AMS026', vendor: 'V002', sla1: '5', rating: '3' },
      { ams: 'AMS028', vendor: 'V007', sla1: '4', rating: '4' },
      { ams: 'AMS029', vendor: 'V007', sla1: '10', rating: '2' },
      { ams: 'AMS030', vendor: 'V007', sla1: '2', rating: '5' },
      { ams: 'AMS031', vendor: 'V001', sla1: '3', rating: '4' },
      { ams: 'AMS032', vendor: 'V002', sla1: '4', rating: '3' },
      { ams: 'AMS033', vendor: 'V007', sla1: '3', rating: '5' },
      { ams: 'AMS034', vendor: 'V001', sla1: '7', rating: '2' },
      { ams: 'AMS035', vendor: 'V001', sla1: '2', rating: '5' },
      { ams: 'AMS037', vendor: 'V007', sla1: '1', rating: '5' },
    ];

    let vslarN = 100;
    for (const r of ratings) {
      const id = `VSLAR${String(vslarN++).padStart(3, '0')}`;
      await client.query(
        `
          INSERT INTO tblvendorslarecs
            (vslar_id, vendor_id, ams_id, sla1_value, sla3_value, sla_rating, org_id, created_at)
          VALUES ($1, $2, $3, $4, NULL, $5, $6, CURRENT_TIMESTAMP)
        `,
        [id, r.vendor, r.ams, r.sla1, r.rating, orgId],
      );
    }

    // Breakdowns — repeat failures on AST154 + AST107 within period
    const breakdowns = [
      { id: 'ABR010', asset: 'AST154', reason: 'ATBRRC019', days: 3, status: 'CO', desc: 'Speed issue after PM' },
      { id: 'ABR011', asset: 'AST154', reason: 'ATBRRC019', days: 11, status: 'CO', desc: 'Speed recurrence' },
      { id: 'ABR012', asset: 'AST154', reason: 'ATBRRC017', days: 19, status: 'IN', desc: 'Repair follow-up' },
      { id: 'ABR013', asset: 'AST107', reason: 'ATBRRC016', days: 4, status: 'CO', desc: 'Touchpad failure' },
      { id: 'ABR014', asset: 'AST107', reason: 'ATBRRC016', days: 15, status: 'CO', desc: 'Touchpad repeat' },
      { id: 'ABR015', asset: 'AST003', reason: 'ATBRRC014', days: 6, status: 'CO', desc: 'Display flicker' },
      { id: 'ABR016', asset: 'AST044', reason: 'ATBRRC015', days: 9, status: 'IN', desc: 'Keypad not working' },
    ];

    for (const br of breakdowns) {
      const when = ts(br.days, 11, 30);
      await client.query(
        `
          INSERT INTO "tblAssetBRDet"
            (abr_id, asset_id, status, description, atbrrc_id, created_on, org_id,
             reported_by, is_create_maintenance)
          VALUES ($1, $2, $3, $4, $5, $6::timestamp, $7, 'USR001', false)
        `,
        [
          br.id,
          br.asset,
          br.status,
          `${NOTE_TAG} ${br.desc}`,
          br.reason,
          sqlTs(when),
          orgId,
        ],
      );
    }

    // Bump sequences so app ID generators stay ahead
    await client.query(`
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES
        ('ams', 'AMS', 37),
        ('asset_maint_sch', 'AMS', 37),
        ('vendor_sla', 'VSLA', 5),
        ('vendor_sla_rec', 'VSLAR', 120),
        ('tblAssetBRDet', 'ABR', 16),
        ('asset_br_det', 'ABR', 16)
      ON CONFLICT (table_key) DO UPDATE
      SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number),
          prefix = EXCLUDED.prefix
    `);

    await client.query('COMMIT');

    const counts = await client.query(
      `
        SELECT
          (SELECT COUNT(*) FROM "tblVendorSLAs" WHERE COALESCE(int_status,1)=1) AS vendor_slas,
          (SELECT COUNT(*) FROM "tblAssetMaintSch" WHERE notes ILIKE $1) AS seeded_ams,
          (SELECT COUNT(*) FROM "tblAssetMaintSch"
             WHERE org_id = $2
               AND COALESCE(act_maint_st_date, changed_on)::date >= CURRENT_DATE - 30) AS ams_30d,
          (SELECT COUNT(*) FROM "tblAssetBRDet" WHERE description ILIKE $1) AS seeded_br,
          (SELECT COUNT(*) FROM tblvendorslarecs) AS sla_recs
      `,
      [`%${NOTE_TAG}%`, orgId],
    );

    return { ok: true, orgId, ...counts.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const targets = process.argv.slice(2).length
    ? process.argv.slice(2)
    : [process.env.TENANT_DB || 'ngp_db'];
  console.log('[seed-sla-vendor-performance-data]', targets.join(', '));
  for (const db of [...new Set(targets)]) {
    try {
      const r = await seedDb(db);
      console.log(`  ${db}:`, r);
    } catch (err) {
      console.error(`  ${db}: FAILED`, err.message);
      process.exitCode = 1;
    }
  }
}

main();
