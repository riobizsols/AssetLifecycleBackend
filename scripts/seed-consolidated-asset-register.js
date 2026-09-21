/**
 * Seed CONSOLIDATEDASSETREPORT app + JR001 nav under Reports.
 * Usage: node scripts/seed-consolidated-asset-register.js
 * Optional: TENANT_DB=ngp_db DATABASE_URL=... 
 */
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const database = process.env.TENANT_DB || process.env.PGDATABASE;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    database: database || undefined,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgRes = await client.query(
      `SELECT org_id FROM "tblOrgs" WHERE COALESCE(int_status, 1) = 1 ORDER BY org_id LIMIT 1`,
    );
    const primaryOrg = orgRes.rows[0]?.org_id || null;
    if (!primaryOrg) {
      throw new Error('No organization found to attach app');
    }

    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ('CONSOLIDATEDASSETREPORT', 'Consolidated Asset Register', true, $1)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text, int_status = true, org_id = EXCLUDED.org_id
      `,
      [primaryOrg],
    );

    const navExists = await client.query(
      `
        SELECT 1 FROM "tblJobRoleNav"
        WHERE job_role_id = 'JR001' AND app_id = 'CONSOLIDATEDASSETREPORT'
        LIMIT 1
      `,
    );

    if (!navExists.rows.length) {
      const parent = await client.query(
        `
          SELECT job_role_nav_id FROM "tblJobRoleNav"
          WHERE job_role_id = 'JR001' AND label ILIKE 'Reports'
          ORDER BY sequence
          LIMIT 1
        `,
      );
      const parentId = parent.rows[0]?.job_role_nav_id || 'JRN012';
      const maxSeq = await client.query(
        `
          SELECT COALESCE(MAX(sequence), 0)::int AS s
          FROM "tblJobRoleNav"
          WHERE job_role_id = 'JR001' AND parent_id = $1
        `,
        [parentId],
      );
      const seq = (maxSeq.rows[0]?.s || 0) + 1;

      let jrnId = 'JRN063';
      for (let i = 63; i < 200; i += 1) {
        const candidate = `JRN${String(i).padStart(3, '0')}`;
        const hit = await client.query(
          `SELECT 1 FROM "tblJobRoleNav" WHERE job_role_nav_id = $1`,
          [candidate],
        );
        if (!hit.rows.length) {
          jrnId = candidate;
          break;
        }
      }

      await client.query(
        `
          INSERT INTO "tblJobRoleNav"
            (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence, access_level, is_group, org_id, int_status, mob_desk)
          VALUES ($1, 'JR001', $2, 'CONSOLIDATEDASSETREPORT', 'Consolidated Asset Register', $3, 'A', false, $4, 1, 'D')
        `,
        [jrnId, parentId, seq, primaryOrg],
      );
      console.log(`Nav inserted: ${jrnId} under ${parentId}`);
    } else {
      console.log('Nav already present for CONSOLIDATEDASSETREPORT');
    }

    await client.query('COMMIT');
    console.log('CONSOLIDATEDASSETREPORT seeded successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
