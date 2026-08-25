/**
 * Ensures both Spare Parts (lot entry) and Spare Part Category
 * exist as separate Master Data menu apps/nav items.
 */
require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    const orgs = await client.query(
      `SELECT DISTINCT org_id FROM "tblApps" ORDER BY org_id`
    );
    const orgId = orgs.rows[0]?.org_id || 'ORG001';

    // Spare Parts (lot entry)
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ('SPAREPARTS', 'Spare Parts', true, $1)
        ON CONFLICT (app_id) DO UPDATE
        SET text = 'Spare Parts', int_status = true
      `,
      [orgId]
    );

    // Spare Part Category (2 tabs)
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ('SPAREPARTSCONFIG', 'Spare Part Category', true, $1)
        ON CONFLICT (app_id) DO UPDATE
        SET text = 'Spare Part Category', int_status = true
      `,
      [orgId]
    );

    // Restore SPAREPARTS nav labels
    await client.query(`
      UPDATE "tblJobRoleNav"
      SET label = 'Spare Parts', app_id = 'SPAREPARTS'
      WHERE app_id = 'SPAREPARTS'
    `);

    const masterGroups = await client.query(`
      SELECT job_role_nav_id, job_role_id, org_id, access_level, mob_desk
      FROM "tblJobRoleNav"
      WHERE is_group = true
        AND LOWER(TRIM(label)) = 'master data'
    `);

    // Ensure SPAREPARTS exists under each Master Data group
    let counter = 1;
    for (const group of masterGroups.rows) {
      const existingSpare = await client.query(
        `
          SELECT 1 FROM "tblJobRoleNav"
          WHERE job_role_id = $1 AND parent_id = $2 AND app_id = 'SPAREPARTS'
          LIMIT 1
        `,
        [group.job_role_id, group.job_role_nav_id]
      );
      if (!existingSpare.rows.length) {
        const maxSeq = await client.query(
          `SELECT COALESCE(MAX(sequence), 0) AS max_seq FROM "tblJobRoleNav" WHERE parent_id = $1`,
          [group.job_role_nav_id]
        );
        const navId = `SPN${String(counter).padStart(4, '0')}`;
        counter += 1;
        await client.query(
          `
            INSERT INTO "tblJobRoleNav" (
              job_role_nav_id, org_id, int_status, job_role_id, parent_id,
              app_id, label, sub_menu, sequence, access_level, is_group, mob_desk
            ) VALUES (
              $1, $2, 1, $3, $4,
              'SPAREPARTS', 'Spare Parts', NULL, $5, $6, false, $7
            )
          `,
          [
            navId,
            group.org_id,
            group.job_role_id,
            group.job_role_nav_id,
            Number(maxSeq.rows[0].max_seq || 0) + 1,
            group.access_level || 'A',
            group.mob_desk || 'D',
          ]
        );
        console.log(`Added SPAREPARTS for ${group.job_role_id}`);
      } else {
        await client.query(
          `
            UPDATE "tblJobRoleNav"
            SET label = 'Spare Parts'
            WHERE job_role_id = $1 AND parent_id = $2 AND app_id = 'SPAREPARTS'
          `,
          [group.job_role_id, group.job_role_nav_id]
        );
      }

      const existingConfig = await client.query(
        `
          SELECT 1 FROM "tblJobRoleNav"
          WHERE job_role_id = $1 AND parent_id = $2 AND app_id = 'SPAREPARTSCONFIG'
          LIMIT 1
        `,
        [group.job_role_id, group.job_role_nav_id]
      );
      if (!existingConfig.rows.length) {
        const maxSeq = await client.query(
          `SELECT COALESCE(MAX(sequence), 0) AS max_seq FROM "tblJobRoleNav" WHERE parent_id = $1`,
          [group.job_role_nav_id]
        );
        const navId = `SPC${String(counter).padStart(4, '0')}`;
        counter += 1;
        await client.query(
          `
            INSERT INTO "tblJobRoleNav" (
              job_role_nav_id, org_id, int_status, job_role_id, parent_id,
              app_id, label, sub_menu, sequence, access_level, is_group, mob_desk
            ) VALUES (
              $1, $2, 1, $3, $4,
              'SPAREPARTSCONFIG', 'Spare Part Category', NULL, $5, $6, false, $7
            )
          `,
          [
            navId,
            group.org_id,
            group.job_role_id,
            group.job_role_nav_id,
            Number(maxSeq.rows[0].max_seq || 0) + 1,
            group.access_level || 'A',
            group.mob_desk || 'D',
          ]
        );
        console.log(`Added SPAREPARTSCONFIG for ${group.job_role_id}`);
      }
    }

    await client.query('COMMIT');
    console.log('Both Spare Parts menus are ready');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
