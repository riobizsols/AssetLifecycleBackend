/**
 * Fix KMCH (ORG004) Asset Name (description) values that look like
 * "Type - Department (Unit N)" into proper unique names: "Type #N".
 * Leaves brand/model names (e.g. "Samsung Galaxy Tab Active4 #1") unchanged.
 *
 * Usage: node scripts/fix-kmch-asset-names.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG004';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function isDeptStyleName(description, text) {
  const d = String(description || '').trim();
  const t = String(text || '').trim();
  if (!d || !t) return false;
  const lower = d.toLowerCase();
  if (lower.includes('seeded for')) return true;
  if (lower.includes('facility asset')) return true;
  if (lower.includes('preventive maintenance')) return true;
  // "Patient Monitor - General Nursing" / "Wheelchair - Pharmacology (Unit 4)"
  if (d.includes(' - ')) return true;
  if (/\bfor\b/i.test(d)) return true;
  return false;
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
      SELECT asset_id, text, description
        FROM "tblAssets"
       WHERE org_id = $1
       ORDER BY text ASC, asset_id ASC
      `,
      [ORG],
    );

    const toFix = rows.filter((r) => isDeptStyleName(r.description, r.text));
    // Sequence counters per asset text so names stay unique
    const counters = new Map();

    await client.query('BEGIN');
    const updated = [];
    for (const row of toFix) {
      const base = String(row.text).trim();
      const n = (counters.get(base) || 0) + 1;
      counters.set(base, n);
      const newName = `${base} #${n}`;

      await client.query(
        `
        UPDATE "tblAssets"
           SET description = $1,
               changed_on = CURRENT_TIMESTAMP,
               changed_by = COALESCE(changed_by, 'USR001')
         WHERE asset_id = $2 AND org_id = $3
        `,
        [newName, row.asset_id, ORG],
      );
      updated.push({
        asset_id: row.asset_id,
        from: row.description,
        to: newName,
      });
    }
    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          ok: true,
          org: ORG,
          totalAssets: rows.length,
          updatedCount: updated.length,
          leftAsBrandModel: rows.length - updated.length,
          sample: updated.slice(0, 12),
          last: updated.slice(-6),
        },
        null,
        2,
      ),
    );
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
