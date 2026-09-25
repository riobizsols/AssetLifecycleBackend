/**
 * Ensure SPAREPARTMGMT app + nav under Spare Parts for existing tenants.
 * Usage: node scripts/seedSparePartManagementNav.js
 *
 * Schema mirrors seedSparePartsTopLevelGroup.js (job_role_nav_id, label, …).
 */
require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const APP_ID = 'SPAREPARTMGMT';
const APP_LABEL = 'Spare Part Report';

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE "tblApps" SET text = $2, int_status = true WHERE app_id = $1`,
      [APP_ID, APP_LABEL],
    );
    const updated = await client.query(
      `SELECT 1 FROM "tblApps" WHERE app_id = $1 LIMIT 1`,
      [APP_ID],
    );
    if (!updated.rowCount) {
      await client.query(
        `INSERT INTO "tblApps" (app_id, text, int_status) VALUES ($1, $2, true)`,
        [APP_ID, APP_LABEL],
      );
    }

    const roles = await client.query(
      `
        SELECT DISTINCT job_role_id, org_id, access_level, mob_desk
        FROM "tblJobRoleNav"
        WHERE int_status = 1
          AND app_id = ANY($1::text[])
      `,
      [['SPAREPARTS', 'SPAREPARTLIST', 'SPAREPARTAPPROVAL', 'SPAREPARTISSUE']],
    );

    let navCounter = 1;
    const nextNavId = async () => {
      for (;;) {
        const id = `SPM${String(navCounter).padStart(4, '0')}`;
        navCounter += 1;
        const exists = await client.query(
          `SELECT 1 FROM "tblJobRoleNav" WHERE job_role_nav_id = $1 LIMIT 1`,
          [id],
        );
        if (!exists.rows.length) return id;
      }
    };

    let inserted = 0;
    for (const role of roles.rows) {
      const group = await client.query(
        `
          SELECT job_role_nav_id
          FROM "tblJobRoleNav"
          WHERE job_role_id = $1
            AND int_status = 1
            AND is_group = true
            AND parent_id IS NULL
            AND (
              LOWER(TRIM(label)) = 'spare parts'
              OR app_id = 'SPAREPARTSGROUP'
            )
          ORDER BY sequence
          LIMIT 1
        `,
        [role.job_role_id],
      );
      const groupId = group.rows[0]?.job_role_nav_id;
      if (!groupId) continue;

      const exists = await client.query(
        `
          SELECT 1 FROM "tblJobRoleNav"
          WHERE job_role_id = $1
            AND app_id = $2
            AND int_status = 1
          LIMIT 1
        `,
        [role.job_role_id, APP_ID],
      );
      if (exists.rowCount) continue;

      const navId = await nextNavId();
      await client.query(
        `
          INSERT INTO "tblJobRoleNav" (
            job_role_nav_id, org_id, int_status, job_role_id, parent_id,
            app_id, label, sub_menu, sequence, access_level, is_group, mob_desk
          ) VALUES (
            $1, $2, 1, $3, $4,
            $5, $6, NULL, 2, $7, false, $8
          )
        `,
        [
          navId,
          role.org_id,
          role.job_role_id,
          groupId,
          APP_ID,
          APP_LABEL,
          role.access_level || 'A',
          role.mob_desk || 'D',
        ],
      );
      inserted += 1;
      console.log(`Inserted ${APP_ID} for ${role.job_role_id}: ${navId}`);
    }

    await client.query('COMMIT');
    console.log(`Done. Roles scanned: ${roles.rowCount}, nav rows inserted: ${inserted}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
