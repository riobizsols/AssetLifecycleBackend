/**
 * Consolidate duplicate Babu user accounts in kia tenant.
 * Keeps USR002 (original) and removes USR003, USR004, USR005.
 *
 * Usage: node scripts/cleanup-duplicate-babu-users.js [--dry-run]
 */
require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

const KEEP_USER_ID = 'USR002';
const EMP_INT_ID = 'EMP_INT_0054';
const DUPLICATE_USER_IDS = ['USR003', 'USR004', 'USR005'];
const dryRun = process.argv.includes('--dry-run');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  if (!t.rows[0]) {
    console.log('kia tenant not found');
    process.exit(1);
  }

  const pool = await getTenantPool(t.rows[0].org_id);
  const client = await pool.connect();

  try {
    const before = await client.query(
      `SELECT u.user_id, u.int_status, u.job_role_id, jr.text AS job_role_name
       FROM "tblUsers" u
       LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = u.job_role_id
       WHERE u.emp_int_id = $1
       ORDER BY u.user_id`,
      [EMP_INT_ID],
    );
    console.log('Before cleanup:');
    console.table(before.rows);

    const roleRows = await client.query(
      `SELECT ujr.user_job_role_id, ujr.user_id, ujr.job_role_id, jr.text
       FROM "tblUserJobRoles" ujr
       JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
       WHERE ujr.user_id = ANY($1::text[])`,
      [[KEEP_USER_ID, ...DUPLICATE_USER_IDS]],
    );
    console.log('\nRole assignments before:');
    console.table(roleRows.rows);

    const canonicalRole =
      roleRows.rows.find((r) => DUPLICATE_USER_IDS.includes(r.user_id)) ||
      roleRows.rows.find((r) => r.user_id === KEEP_USER_ID);

    const targetJobRoleId = canonicalRole?.job_role_id || null;
    console.log(`\nKeeping user ${KEEP_USER_ID}, target role: ${targetJobRoleId || '(none)'}`);

    if (dryRun) {
      console.log('\nDry run — no changes made.');
      process.exit(0);
    }

    await client.query('BEGIN');

    await client.query(
      `DELETE FROM "tblUserJobRoles" WHERE user_id = ANY($1::text[])`,
      [DUPLICATE_USER_IDS],
    );

    if (targetJobRoleId) {
      const existing = await client.query(
        `SELECT user_job_role_id FROM "tblUserJobRoles"
         WHERE user_id = $1 AND job_role_id = $2`,
        [KEEP_USER_ID, targetJobRoleId],
      );

      if (!existing.rows.length) {
        const idResult = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(user_job_role_id FROM 4) AS INTEGER)), 0) + 1 AS next_num
           FROM "tblUserJobRoles"
           WHERE user_job_role_id ~ '^UJR[0-9]+$'`,
        );
        const nextNum = idResult.rows[0]?.next_num || 1;
        const newUjrId = `UJR${String(nextNum).padStart(3, '0')}`;

        await client.query(
          `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
           VALUES ($1, $2, $3)`,
          [newUjrId, KEEP_USER_ID, targetJobRoleId],
        );
        console.log(`Created role assignment ${newUjrId} on ${KEEP_USER_ID}`);
      } else {
        console.log(`Role ${targetJobRoleId} already on ${KEEP_USER_ID}`);
      }
    }

    await client.query(
      `UPDATE "tblUsers"
       SET int_status = 1,
           job_role_id = $2,
           changed_by = 'SYSTEM',
           changed_on = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [KEEP_USER_ID, targetJobRoleId],
    );

    await client.query(
      `DELETE FROM "tblUsers" WHERE user_id = ANY($1::text[])`,
      [DUPLICATE_USER_IDS],
    );

    await client.query('COMMIT');

    const after = await client.query(
      `SELECT u.user_id, u.int_status, u.job_role_id, jr.text AS job_role_name
       FROM "tblUsers" u
       LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = u.job_role_id
       WHERE u.emp_int_id = $1`,
      [EMP_INT_ID],
    );
    console.log('\nAfter cleanup:');
    console.table(after.rows);

    const afterRoles = await client.query(
      `SELECT ujr.user_job_role_id, ujr.user_id, ujr.job_role_id, jr.text
       FROM "tblUserJobRoles" ujr
       JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
       WHERE ujr.user_id = $1`,
      [KEEP_USER_ID],
    );
    console.log('\nRole assignments after:');
    console.table(afterRoles.rows);

    console.log('\nCleanup complete.');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
})();
