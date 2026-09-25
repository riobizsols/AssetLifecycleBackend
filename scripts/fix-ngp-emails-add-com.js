/**
 * Append .com to NGP employee/user emails that are missing it.
 * Usage: node scripts/fix-ngp-emails-add-com.js
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

function withCom(email) {
  const e = String(email || '').trim();
  if (!e) return e;
  if (/\.com$/i.test(e)) return e;
  return `${e}.com`;
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empRows = await client.query(
      `
      SELECT emp_int_id, email_id
        FROM "tblEmployees"
       WHERE org_id = $1
         AND email_id IS NOT NULL
         AND TRIM(email_id) <> ''
         AND LOWER(email_id) NOT LIKE '%.com'
      FOR UPDATE
      `,
      [ORG],
    );

    const empUpdated = [];
    for (const row of empRows.rows) {
      const next = withCom(row.email_id);
      if (next === row.email_id) continue;

      const clash = await client.query(
        `
        SELECT emp_int_id FROM "tblEmployees"
         WHERE org_id = $1 AND LOWER(TRIM(email_id)) = LOWER($2) AND emp_int_id <> $3
         LIMIT 1
        `,
        [ORG, next, row.emp_int_id],
      );
      if (clash.rows.length) {
        empUpdated.push({
          emp_int_id: row.emp_int_id,
          from: row.email_id,
          to: next,
          skipped: true,
          reason: `conflict with ${clash.rows[0].emp_int_id}`,
        });
        continue;
      }

      await client.query(
        `UPDATE "tblEmployees" SET email_id = $1, changed_on = CURRENT_TIMESTAMP WHERE emp_int_id = $2 AND org_id = $3`,
        [next, row.emp_int_id, ORG],
      );
      empUpdated.push({ emp_int_id: row.emp_int_id, from: row.email_id, to: next });
    }

    const userRows = await client.query(
      `
      SELECT user_id, email
        FROM "tblUsers"
       WHERE org_id = $1
         AND email IS NOT NULL
         AND TRIM(email) <> ''
         AND LOWER(email) NOT LIKE '%.com'
      FOR UPDATE
      `,
      [ORG],
    );

    const userUpdated = [];
    for (const row of userRows.rows) {
      const next = withCom(row.email);
      if (next === row.email) continue;

      const clash = await client.query(
        `
        SELECT user_id FROM "tblUsers"
         WHERE org_id = $1 AND LOWER(TRIM(email)) = LOWER($2) AND user_id <> $3
         LIMIT 1
        `,
        [ORG, next, row.user_id],
      );
      if (clash.rows.length) {
        userUpdated.push({
          user_id: row.user_id,
          from: row.email,
          to: next,
          skipped: true,
          reason: `conflict with ${clash.rows[0].user_id}`,
        });
        continue;
      }

      await client.query(
        `UPDATE "tblUsers" SET email = $1, changed_on = CURRENT_TIMESTAMP WHERE user_id = $2 AND org_id = $3`,
        [next, row.user_id, ORG],
      );
      userUpdated.push({ user_id: row.user_id, from: row.email, to: next });
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          ok: true,
          employees: empUpdated,
          users: userUpdated,
          employeeCount: empUpdated.filter((r) => !r.skipped).length,
          userCount: userUpdated.filter((r) => !r.skipped).length,
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
