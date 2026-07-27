#!/usr/bin/env node
/**
 * Assign branchmanager@gmail.com to JR016 (Branch Manager) in pressana_db
 * so Asset Assignment + Reports menus appear for that login.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const baseUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
const dbUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/pressana_db$2');
const pool = new Pool({ connectionString: dbUrl, ssl: false, max: 1 });

const EMAIL = 'branchmanager@gmail.com';
const TARGET_ROLE = 'JR016'; // Branch Manager

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `SELECT user_id, email, full_name, job_role_id
       FROM "tblUsers"
       WHERE LOWER(email) = LOWER($1)`,
      [EMAIL]
    );
    if (!userRes.rows.length) {
      throw new Error(`User not found: ${EMAIL}`);
    }
    const user = userRes.rows[0];
    console.log('Before:', user);

    const roleRes = await client.query(
      `SELECT job_role_id, text FROM "tblJobRoles" WHERE job_role_id = $1 AND int_status = 1`,
      [TARGET_ROLE]
    );
    if (!roleRes.rows.length) {
      throw new Error(`Role not found/active: ${TARGET_ROLE}`);
    }
    console.log('Target role:', roleRes.rows[0]);

    await client.query(
      `UPDATE "tblUsers"
       SET job_role_id = $1, changed_by = 'SYSTEM', changed_on = NOW()
       WHERE user_id = $2`,
      [TARGET_ROLE, user.user_id]
    );

    const ujr = await client.query(
      `SELECT * FROM "tblUserJobRoles" WHERE user_id = $1`,
      [user.user_id]
    );
    if (ujr.rows.length) {
      await client.query(
        `UPDATE "tblUserJobRoles"
         SET job_role_id = $1
         WHERE user_id = $2`,
        [TARGET_ROLE, user.user_id]
      );
    } else {
      const idRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(user_job_role_id FROM 4) AS INTEGER)), 0) + 1 AS n
         FROM "tblUserJobRoles"
         WHERE user_job_role_id ~ '^UJR[0-9]+$'`
      );
      const next = String(idRes.rows[0].n).padStart(3, '0');
      await client.query(
        `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
         VALUES ($1, $2, $3)`,
        [`UJR${next}`, user.user_id, TARGET_ROLE]
      );
    }

    await client.query('COMMIT');

    const after = await pool.query(
      `SELECT u.user_id, u.email, u.job_role_id, jr.text AS role_name,
              ujr.user_job_role_id, ujr.job_role_id AS ujr_role
       FROM "tblUsers" u
       LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = u.job_role_id
       LEFT JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
       WHERE u.user_id = $1`,
      [user.user_id]
    );
    console.log('After:', after.rows);

    const nav = await pool.query(
      `SELECT label, app_id, is_group, parent_id
       FROM "tblJobRoleNav"
       WHERE job_role_id = $1 AND int_status = 1
         AND (
           label IN ('Asset Assignment', 'Reports')
           OR parent_id IN (
             SELECT job_role_nav_id FROM "tblJobRoleNav"
             WHERE job_role_id = $1 AND int_status = 1
               AND label IN ('Asset Assignment', 'Reports')
           )
         )
       ORDER BY label, sequence`,
      [TARGET_ROLE]
    );
    console.log('\nMenus now available:');
    for (const n of nav.rows) {
      console.log(`  ${n.is_group ? '[GROUP]' : '  -'} ${n.label}${n.app_id ? ` (${n.app_id})` : ''}`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
