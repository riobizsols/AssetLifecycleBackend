/**
 * Seeds SPAREPARTS app + Master Data nav entry + sample categories + ID sequences.
 * Safe to re-run (uses ON CONFLICT / existence checks).
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

    // ID sequences
    for (const [key, prefix] of [
      ['sp_category', 'SPC'],
      ['sp_lot_det', 'SPLD'],
      ['sp_ind_det', 'SPID'],
    ]) {
      await client.query(
        `
          INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
          VALUES ($1, $2, 0)
          ON CONFLICT (table_key) DO NOTHING
        `,
        [key, prefix]
      );
    }

    const orgs = await client.query(`SELECT DISTINCT org_id FROM "tblApps" ORDER BY org_id`);

    // Apps (single PK on app_id)
    await client.query(`
      INSERT INTO "tblApps" (app_id, text, int_status, org_id)
      VALUES ('SPAREPARTS', 'Spare Parts', true, $1)
      ON CONFLICT (app_id) DO UPDATE
      SET text = EXCLUDED.text,
          int_status = EXCLUDED.int_status
    `, [orgs.rows[0]?.org_id || 'ORG001']);

    // Add nav under each Master Data group that does not already have SPAREPARTS
    const masterGroups = await client.query(`
      SELECT job_role_nav_id, job_role_id, org_id, access_level, mob_desk
      FROM "tblJobRoleNav"
      WHERE is_group = true
        AND LOWER(TRIM(label)) = 'master data'
    `);

    let navCounter = 1;
    for (const group of masterGroups.rows) {
      const existing = await client.query(
        `
          SELECT 1 FROM "tblJobRoleNav"
          WHERE job_role_id = $1
            AND parent_id = $2
            AND app_id = 'SPAREPARTS'
          LIMIT 1
        `,
        [group.job_role_id, group.job_role_nav_id]
      );
      if (existing.rows.length) continue;

      const maxSeq = await client.query(
        `
          SELECT COALESCE(MAX(sequence), 0) AS max_seq
          FROM "tblJobRoleNav"
          WHERE parent_id = $1
        `,
        [group.job_role_nav_id]
      );
      const nextSeq = Number(maxSeq.rows[0].max_seq || 0) + 1;
      // job_role_nav_id is varchar(20)
      const navId = `SPN${String(navCounter).padStart(4, '0')}`;
      navCounter += 1;

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
          nextSeq,
          group.access_level || 'A',
          group.mob_desk || 'D',
        ]
      );
      console.log(`Added SPAREPARTS nav for ${group.job_role_id} under ${group.job_role_nav_id}`);
    }

    // Sample categories if none exist
    const catCount = await client.query(`SELECT COUNT(*)::int AS c FROM "tblSPCategory"`);
    if (catCount.rows[0].c === 0) {
      const orgId = orgs.rows[0]?.org_id || 'ORG001';
      await client.query(
        `
          INSERT INTO "tblSPCategory" (
            spc_id, text, uom, minimum_stock, re_order_level, int_status, org_id, created_on, changed_on
          ) VALUES
            ('SPC001', 'Filters', 'PCS', 5, 10, 1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('SPC002', 'Belts', 'PCS', 2, 5, 1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('SPC003', 'Bearings', 'PCS', 3, 8, 1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [orgId]
      );
      await client.query(
        `
          UPDATE "tblIDSequences"
          SET last_number = GREATEST(last_number, 3)
          WHERE table_key = 'sp_category'
        `
      );
      console.log(`Seeded sample categories for ${orgId}`);
    }

    await client.query('COMMIT');
    console.log('Spare Parts seed completed');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
