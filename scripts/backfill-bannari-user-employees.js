#!/usr/bin/env node
/**
 * Backfill tblEmployees for Bannari users that have no emp_int_id link,
 * then link tblUsers.emp_int_id so they appear in Employee Assignment.
 *
 * Usage:
 *   node scripts/backfill-bannari-user-employees.js
 *   node scripts/backfill-bannari-user-employees.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const SYSTEM_USER = 'SYSTEM';
const isDryRun = process.argv.includes('--dry-run');

function databaseNameFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '').split('?')[0] || null;
  } catch {
    return null;
  }
}

async function nextSeqId(client, table, column, prefix, pad = 4) {
  // Include in-transaction rows so sequential inserts don't collide
  const result = await client.query(
    `
      SELECT ${column}
        FROM "${table}"
       WHERE ${column} ~ $1
       ORDER BY CAST(SUBSTRING(${column} FROM ${prefix.length + 1}) AS INTEGER) DESC
       LIMIT 1
    `,
    [`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[0-9]+$`],
  );
  if (!result.rows.length) return `${prefix}${String(1).padStart(pad, '0')}`;
  const last = result.rows[0][column];
  const match = String(last).match(/(\d+)$/);
  const next = match ? parseInt(match[0], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(pad, '0')}`;
}

async function resolveDeptId(client, user) {
  if (user.dept_id) {
    const exists = await client.query(
      `SELECT 1 FROM "tblDepartments" WHERE dept_id = $1 LIMIT 1`,
      [user.dept_id],
    );
    if (exists.rows.length) return user.dept_id;
  }

  if (user.branch_id && user.org_id) {
    const byBranch = await client.query(
      `
        SELECT d.dept_id
          FROM "tblDepartments" d
          JOIN "tblBR_DEPT" bd ON bd.dept_id = d.dept_id AND bd.int_status = 1
         WHERE d.org_id = $1
           AND bd.branch_id = $2
           AND d.int_status = 1
         ORDER BY d.dept_id
         LIMIT 1
      `,
      [user.org_id, user.branch_id],
    );
    if (byBranch.rows.length) return byBranch.rows[0].dept_id;
  }

  if (user.org_id) {
    const byOrg = await client.query(
      `
        SELECT dept_id
          FROM "tblDepartments"
         WHERE org_id = $1 AND int_status = 1
         ORDER BY dept_id
         LIMIT 1
      `,
      [user.org_id],
    );
    if (byOrg.rows.length) return byOrg.rows[0].dept_id;
  }

  return null;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const dbName = databaseNameFromUrl(connectionString);
  if (dbName !== TARGET_DATABASE) {
    throw new Error(`Refusing to run: expected ${TARGET_DATABASE}, got ${dbName || 'unknown'}`);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const stats = {
    scanned: 0,
    linkedExisting: 0,
    created: 0,
    alreadyLinked: 0,
    skippedNoDept: 0,
    errors: 0,
  };

  try {
    if (!isDryRun) await client.query('BEGIN');

    const users = await client.query(
      `
        SELECT u.user_id, u.email, u.full_name, u.phone, u.org_id, u.dept_id, u.branch_id,
               u.emp_int_id, u.int_status, u.language_code
          FROM "tblUsers" u
         WHERE u.int_status = 1
           AND (
             u.org_id LIKE 'BAN%'
             OR lower(u.email) LIKE '%bannari%'
           )
         ORDER BY u.user_id
      `,
    );

    console.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Backfilling employees for ${users.rows.length} Bannari user(s)...`,
    );

    for (const user of users.rows) {
      stats.scanned += 1;

      try {
        // Already linked to an existing employee
        if (user.emp_int_id) {
          const emp = await client.query(
            `SELECT emp_int_id, dept_id FROM "tblEmployees" WHERE emp_int_id = $1 LIMIT 1`,
            [user.emp_int_id],
          );
          if (emp.rows.length) {
            stats.alreadyLinked += 1;
            continue;
          }
        }

        // Reuse employee with same email if present
        const byEmail = await client.query(
          `
            SELECT emp_int_id, dept_id
              FROM "tblEmployees"
             WHERE lower(email_id) = lower($1)
             LIMIT 1
          `,
          [user.email],
        );
        if (byEmail.rows.length) {
          const empIntId = byEmail.rows[0].emp_int_id;
          if (!isDryRun) {
            await client.query(
              `
                UPDATE "tblUsers"
                   SET emp_int_id = $1,
                       changed_by = $2,
                       changed_on = CURRENT_TIMESTAMP
                 WHERE user_id = $3
              `,
              [empIntId, SYSTEM_USER, user.user_id],
            );
          }
          stats.linkedExisting += 1;
          console.log(`  link  ${user.email} -> ${empIntId} (existing by email)`);
          continue;
        }

        const deptId = await resolveDeptId(client, user);
        if (!deptId) {
          stats.skippedNoDept += 1;
          console.log(`  skip  ${user.email} (no department)`);
          continue;
        }

        const empIntId = await nextSeqId(client, 'tblEmployees', 'emp_int_id', 'EMP_INT_', 4);
        const employeeId = await nextSeqId(client, 'tblEmployees', 'employee_id', 'EMP', 3);
        const fullName = (user.full_name || user.email || 'Employee').trim();
        const phone = (user.phone && String(user.phone).trim()) || '0000000000';
        const language = user.language_code || 'en';

        if (!isDryRun) {
          await client.query(
            `
              INSERT INTO "tblEmployees" (
                emp_int_id, employee_id, name, first_name, last_name, middle_name,
                full_name, email_id, dept_id, phone_number, employee_type,
                joining_date, releiving_date, language_code, int_status,
                created_by, created_on, changed_by, changed_on, org_id, branch_id
              ) VALUES (
                $1, $2, $3, NULL, NULL, NULL,
                $3, $4, $5, $6, 'PERMANENT',
                CURRENT_TIMESTAMP, NULL, $7, 1,
                $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP, $9, $10
              )
            `,
            [
              empIntId,
              employeeId,
              fullName,
              user.email,
              deptId,
              phone,
              language,
              SYSTEM_USER,
              user.org_id || null,
              user.branch_id || null,
            ],
          );

          await client.query(
            `
              UPDATE "tblUsers"
                 SET emp_int_id = $1,
                     changed_by = $2,
                     changed_on = CURRENT_TIMESTAMP
               WHERE user_id = $3
            `,
            [empIntId, SYSTEM_USER, user.user_id],
          );
        }

        stats.created += 1;
        console.log(
          `  +     ${user.email} -> ${empIntId}/${employeeId} dept=${deptId}`,
        );
      } catch (err) {
        stats.errors += 1;
        console.error(`  ERROR ${user.email}: ${err.message}`);
      }
    }

    if (!isDryRun) await client.query('COMMIT');

    console.log('\n════════════════════════════════════════');
    console.log('Backfill complete.');
    console.log(`  Scanned:          ${stats.scanned}`);
    console.log(`  Already linked:   ${stats.alreadyLinked}`);
    console.log(`  Linked existing:  ${stats.linkedExisting}`);
    console.log(`  Employees created:${stats.created}`);
    console.log(`  Skipped (no dept):${stats.skippedNoDept}`);
    console.log(`  Errors:           ${stats.errors}`);
    console.log('════════════════════════════════════════\n');
  } catch (error) {
    if (!isDryRun) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
