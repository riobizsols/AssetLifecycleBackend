/**
 * Seed SPAREPARTLIST and SPAREPARTAPPROVAL under Maintenance nav group.
 */
require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const APPS = [
  { app_id: 'SPAREPARTLIST', label: 'Spare Part List' },
  { app_id: 'SPAREPARTAPPROVAL', label: 'Spare Part Approval' },
];

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    const orgs = await client.query(`SELECT DISTINCT org_id FROM "tblApps" ORDER BY org_id`);
    const orgId = orgs.rows[0]?.org_id || 'ORG001';

    for (const app of APPS) {
      await client.query(
        `
          INSERT INTO "tblApps" (app_id, text, int_status, org_id)
          VALUES ($1, $2, true, $3)
          ON CONFLICT (app_id) DO UPDATE
          SET text = EXCLUDED.text, int_status = true
        `,
        [app.app_id, app.label, orgId]
      );
    }

    const maintGroups = await client.query(`
      SELECT job_role_nav_id, job_role_id, org_id, access_level, mob_desk
      FROM "tblJobRoleNav"
      WHERE is_group = true
        AND LOWER(TRIM(label)) = 'maintenance'
    `);

    let navCounter = 1;
    for (const group of maintGroups.rows) {
      for (const app of APPS) {
        const existing = await client.query(
          `
            SELECT 1 FROM "tblJobRoleNav"
            WHERE job_role_id = $1
              AND parent_id = $2
              AND app_id = $3
            LIMIT 1
          `,
          [group.job_role_id, group.job_role_nav_id, app.app_id]
        );
        if (existing.rows.length) continue;

        const maxSeq = await client.query(
          `SELECT COALESCE(MAX(sequence), 0) AS max_seq FROM "tblJobRoleNav" WHERE parent_id = $1`,
          [group.job_role_nav_id]
        );
        const navId = `SPL${String(navCounter).padStart(4, '0')}`;
        navCounter += 1;

        await client.query(
          `
            INSERT INTO "tblJobRoleNav" (
              job_role_nav_id, org_id, int_status, job_role_id, parent_id,
              app_id, label, sub_menu, sequence, access_level, is_group, mob_desk
            ) VALUES (
              $1, $2, 1, $3, $4,
              $5, $6, NULL, $7, $8, false, $9
            )
          `,
          [
            navId,
            group.org_id,
            group.job_role_id,
            group.job_role_nav_id,
            app.app_id,
            app.label,
            Number(maxSeq.rows[0].max_seq || 0) + 1,
            group.access_level || 'A',
            group.mob_desk || 'D',
          ]
        );
        console.log(`Added ${app.app_id} for ${group.job_role_id}`);
      }
    }

    await client.query('COMMIT');
    console.log('Spare Part List and Approval menus are ready');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
