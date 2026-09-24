/**
 * Set NGP asset "Asset Name" (description) to a proper name (from text).
 * Removes seeded / facility filler phrases.
 *
 * Usage: node scripts/fix-ngp-asset-names.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function needsRename(description, text) {
  const d = String(description || '').trim();
  const t = String(text || '').trim();
  if (!t) return false;
  if (!d) return true;
  const lower = d.toLowerCase();
  if (lower.includes('seeded for')) return true;
  if (lower.includes('facility asset')) return true;
  if (lower.includes('preventive maintenance')) return true;
  if (/\bfor\b/.test(lower) && lower.includes('(') && /dpt\d+/i.test(lower)) return true;
  // description is just a verbose copy with filler words
  if (lower !== t.toLowerCase() && (lower.includes(' for ') || lower.startsWith('seeded'))) {
    return true;
  }
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
       ORDER BY asset_id
      `,
      [ORG],
    );

    const toFix = rows.filter((r) => needsRename(r.description, r.text));
    console.log(`Found ${toFix.length} of ${rows.length} assets to rename`);

    await client.query('BEGIN');
    const updated = [];
    for (const row of toFix) {
      const newName = String(row.text).trim();
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
          updatedCount: updated.length,
          sample: updated.slice(0, 10),
          last: updated.slice(-5),
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
