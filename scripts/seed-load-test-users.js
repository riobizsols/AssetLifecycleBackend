#!/usr/bin/env node
/**
 * Seed load-test users for login performance testing.
 * Creates loadtest001@loadtest.local .. loadtest{N}@loadtest.local
 *
 * Usage: node scripts/seed-load-test-users.js --count 100
 * Cleanup: node scripts/seed-load-test-users.js --cleanup
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const args = process.argv.slice(2);
const cleanup = args.includes('--cleanup');
const countIdx = args.indexOf('--count');
const COUNT = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) : 100;
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'LoadTest1!';

const connectionString =
  process.env.LOAD_TEST_DATABASE_URL ||
  process.env.GENERIC_URL ||
  process.env.DATABASE_URL;

if (!connectionString || connectionString.endsWith('/')) {
  console.error('Set DATABASE_URL or GENERIC_URL to a full DB (e.g. .../assetLifecycle)');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString, ssl: false });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  try {
    if (cleanup) {
      const del = await pool.query(
        `DELETE FROM "tblUsers" WHERE email LIKE 'loadtest%@loadtest.local'`
      );
      console.log(`Removed ${del.rowCount} load-test users`);
      return;
    }

    const orgRes = await pool.query('SELECT org_id FROM "tblOrgs" LIMIT 1');
    const orgId = orgRes.rows[0]?.org_id || 'ORG001';

    const roleRes = await pool.query('SELECT job_role_id FROM "tblJobRoles" LIMIT 1');
    const jobRoleId = roleRes.rows[0]?.job_role_id || 'JR001';

    let created = 0;
    let updated = 0;

    for (let i = 1; i <= COUNT; i++) {
      const n = String(i).padStart(3, '0');
      const email = `loadtest${n}@loadtest.local`;
      const userId = `LT${n}`;

      const existing = await pool.query(
        'SELECT user_id FROM "tblUsers" WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE "tblUsers" SET password = $1, changed_on = NOW() WHERE email = $2`,
          [passwordHash, email]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO "tblUsers" (
            org_id, user_id, full_name, email, phone, job_role_id, password,
            created_by, created_on, changed_by, changed_on, int_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'LOADTEST', NOW(), 'LOADTEST', NOW(), 1)`,
          [orgId, userId, `Load Test User ${n}`, email, '0000000000', jobRoleId, passwordHash]
        );
        created++;
      }
    }

    console.log(`Load-test users ready: ${COUNT} (created ${created}, updated ${updated})`);
    console.log(`Password: ${PASSWORD}`);
    console.log(`Example: loadtest001@loadtest.local`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
