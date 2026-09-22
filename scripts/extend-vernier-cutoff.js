/**
 * Extend Vernier Caliper maintenance cutoff so notifications show days left.
 * Usage: node scripts/extend-vernier-cutoff.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const ASSET_TYPE = 'AT034';
// Push planned schedule so cutoff is ~7 days from today
const DAYS_AHEAD_FROM_TODAY = 7;

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  try {
    const open = await client.query(
      `
      SELECT
        wfh.wfamsh_id,
        wfh.asset_id,
        a.text AS asset_text,
        wfh.pl_sch_date,
        wfh.status,
        at.maint_lead_type,
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(NULLIF(at.maint_lead_type, '') AS INTEGER), 0))::date AS cutoff_date,
        EXTRACT(DAY FROM (
          (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(NULLIF(at.maint_lead_type, '') AS INTEGER), 0))
          - CURRENT_DATE
        ))::int AS days_until_cutoff
      FROM "tblWFAssetMaintSch_H" wfh
      JOIN "tblAssets" a ON a.asset_id = wfh.asset_id AND a.org_id = wfh.org_id
      JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE wfh.org_id = $1
        AND a.asset_type_id = $2
        AND wfh.status NOT IN ('CO', 'CA')
      ORDER BY wfh.wfamsh_id DESC
      `,
      [ORG, ASSET_TYPE],
    );

    console.log('OPEN VERNIER WF:', JSON.stringify(open.rows, null, 2));

    if (!open.rows.length) {
      // Also check by name
      const byName = await client.query(
        `
        SELECT wfh.wfamsh_id, wfh.asset_id, a.text, wfh.pl_sch_date, wfh.status, a.asset_type_id
        FROM "tblWFAssetMaintSch_H" wfh
        JOIN "tblAssets" a ON a.asset_id = wfh.asset_id
        WHERE wfh.org_id = $1
          AND LOWER(a.text) LIKE '%vernier%'
          AND wfh.status NOT IN ('CO', 'CA')
        ORDER BY wfh.wfamsh_id DESC
        `,
        [ORG],
      );
      console.log('BY NAME:', byName.rows);
      if (!byName.rows.length) {
        throw new Error('No open Vernier maintenance workflow found');
      }
    }

    const rows = open.rows.length
      ? open.rows
      : (
          await client.query(
            `
            SELECT
              wfh.wfamsh_id,
              wfh.asset_id,
              a.text AS asset_text,
              wfh.pl_sch_date,
              wfh.status,
              at.maint_lead_type,
              (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(NULLIF(at.maint_lead_type, '') AS INTEGER), 0))::date AS cutoff_date
            FROM "tblWFAssetMaintSch_H" wfh
            JOIN "tblAssets" a ON a.asset_id = wfh.asset_id AND a.org_id = wfh.org_id
            JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
            WHERE wfh.org_id = $1
              AND LOWER(a.text) LIKE '%vernier%'
              AND wfh.status NOT IN ('CO', 'CA')
            `,
            [ORG],
          )
        ).rows;

    await client.query('BEGIN');
    const updated = [];
    for (const row of rows) {
      const lead = parseInt(String(row.maint_lead_type || '0'), 10) || 0;
      // New cutoff = today + DAYS_AHEAD; pl_sch_date = cutoff + lead
      const { rows: dateRows } = await client.query(
        `
        SELECT
          (CURRENT_DATE + ($1::int) * INTERVAL '1 day')::date AS new_cutoff,
          (CURRENT_DATE + ($1::int + $2::int) * INTERVAL '1 day')::date AS new_pl_sch
        `,
        [DAYS_AHEAD_FROM_TODAY, lead],
      );
      const newCutoff = dateRows[0].new_cutoff;
      const newPlSch = dateRows[0].new_pl_sch;

      await client.query(
        `
        UPDATE "tblWFAssetMaintSch_H"
           SET pl_sch_date = $1
         WHERE wfamsh_id = $2 AND org_id = $3
        `,
        [newPlSch, row.wfamsh_id, ORG],
      );

      updated.push({
        wfamsh_id: row.wfamsh_id,
        asset_id: row.asset_id,
        asset_text: row.asset_text,
        old_pl_sch_date: row.pl_sch_date,
        old_cutoff: row.cutoff_date,
        maint_lead_type: lead,
        new_pl_sch_date: newPlSch,
        new_cutoff: newCutoff,
        days_until_cutoff: DAYS_AHEAD_FROM_TODAY,
      });
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, updated }, null, 2));
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
