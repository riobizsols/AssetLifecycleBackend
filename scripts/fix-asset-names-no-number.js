/**
 * Set Asset Name (description) to the base asset text without "#N" suffixes
 * for NGP (ORG003) and KMCH (ORG004).
 *
 * Usage: node scripts/fix-asset-names-no-number.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const TARGET_ORGS = ORGS.length ? ORGS : ['ORG003', 'ORG004'];

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

/** "Patient Monitor #1" / "Lab Microscope #4" → "Patient Monitor" / "Lab Microscope" */
function baseName(text, description) {
  const raw = String(text || description || '').trim();
  if (!raw) return raw;
  return raw.replace(/\s*#\d+\s*$/i, '').trim() || raw;
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];

    for (const orgId of TARGET_ORGS) {
      const { rows } = await client.query(
        `
        SELECT asset_id, text, description
          FROM "tblAssets"
         WHERE org_id = $1
         ORDER BY asset_id
        `,
        [orgId],
      );

      const updated = [];
      for (const row of rows) {
        const next = baseName(row.text, row.description);
        if (!next) continue;
        if (String(row.description || '').trim() === next) continue;

        await client.query(
          `
          UPDATE "tblAssets"
             SET description = $1,
                 changed_on = CURRENT_TIMESTAMP,
                 changed_by = COALESCE(changed_by, 'USR001')
           WHERE asset_id = $2 AND org_id = $3
          `,
          [next, row.asset_id, orgId],
        );
        updated.push({
          asset_id: row.asset_id,
          from: row.description,
          to: next,
        });
      }

      results.push({
        orgId,
        total: rows.length,
        updatedCount: updated.length,
        sample: updated.slice(0, 8),
      });
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, results }, null, 2));
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
