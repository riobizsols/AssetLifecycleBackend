/**
 * Create top-level "Spare Parts" nav group and move:
 * - Spare Part Lot (SPAREPARTS) from Master Data
 * - Spare Part List (SPAREPARTLIST) from Maintenance
 * - Spare Part Approval (SPAREPARTAPPROVAL) from Maintenance
 * under that group for every job role that has any of these menus.
 */
require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const CHILD_APPS = [
  { app_id: 'SPAREPARTS', label: 'Spare Part Lot', sequence: 1 },
  { app_id: 'SPAREPARTLIST', label: 'Spare Part List', sequence: 2 },
  { app_id: 'SPAREPARTAPPROVAL', label: 'Spare Part Approval', sequence: 3 },
];

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // Ensure app labels are correct
    for (const app of CHILD_APPS) {
      await client.query(
        `UPDATE "tblApps" SET text = $2, int_status = true WHERE app_id = $1`,
        [app.app_id, app.label],
      );
    }

    // Roles that already have any of the three spare-part leaf menus
    const roles = await client.query(
      `
        SELECT DISTINCT job_role_id, org_id, access_level, mob_desk
        FROM "tblJobRoleNav"
        WHERE int_status = 1
          AND app_id = ANY($1::text[])
      `,
      [CHILD_APPS.map((a) => a.app_id)],
    );

    let navCounter = 1;
    const nextNavId = async () => {
      // Prefer unused SPLG / SPN style ids
      for (;;) {
        const id = `SPG${String(navCounter).padStart(4, '0')}`;
        navCounter += 1;
        const exists = await client.query(
          `SELECT 1 FROM "tblJobRoleNav" WHERE job_role_nav_id = $1 LIMIT 1`,
          [id],
        );
        if (!exists.rows.length) return id;
      }
    };

    for (const role of roles.rows) {
      // Find or create Spare Parts group for this role
      let group = await client.query(
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

      let groupId = group.rows[0]?.job_role_nav_id;
      if (!groupId) {
        // Place after Maintenance if present, else near middle of top-level
        const maintSeq = await client.query(
          `
            SELECT sequence
            FROM "tblJobRoleNav"
            WHERE job_role_id = $1
              AND int_status = 1
              AND is_group = true
              AND parent_id IS NULL
              AND LOWER(TRIM(label)) = 'maintenance'
            LIMIT 1
          `,
          [role.job_role_id],
        );
        const sequence = maintSeq.rows[0]
          ? Number(maintSeq.rows[0].sequence) + 1
          : 50;

        groupId = await nextNavId();
        await client.query(
          `
            INSERT INTO "tblJobRoleNav" (
              job_role_nav_id, org_id, int_status, job_role_id, parent_id,
              app_id, label, sub_menu, sequence, access_level, is_group, mob_desk
            ) VALUES (
              $1, $2, 1, $3, NULL,
              NULL, 'Spare Parts', NULL, $4, $5, true, $6
            )
          `,
          [
            groupId,
            role.org_id,
            role.job_role_id,
            sequence,
            role.access_level || 'A',
            role.mob_desk || 'D',
          ],
        );
        console.log(`Created Spare Parts group for ${role.job_role_id}: ${groupId}`);
      } else {
        await client.query(
          `
            UPDATE "tblJobRoleNav"
            SET label = 'Spare Parts', app_id = NULL, is_group = true, parent_id = NULL
            WHERE job_role_nav_id = $1
          `,
          [groupId],
        );
      }

      for (const app of CHILD_APPS) {
        const existing = await client.query(
          `
            SELECT job_role_nav_id, parent_id
            FROM "tblJobRoleNav"
            WHERE job_role_id = $1
              AND app_id = $2
              AND int_status = 1
            ORDER BY sequence
            LIMIT 1
          `,
          [role.job_role_id, app.app_id],
        );

        if (existing.rows[0]) {
          await client.query(
            `
              UPDATE "tblJobRoleNav"
              SET parent_id = $2,
                  label = $3,
                  sequence = $4,
                  is_group = false
              WHERE job_role_nav_id = $1
            `,
            [existing.rows[0].job_role_nav_id, groupId, app.label, app.sequence],
          );
          console.log(
            `Moved ${app.app_id} under Spare Parts for ${role.job_role_id}`,
          );
        } else {
          // Only add missing children if role already had at least one spare menu
          // (already filtered by roles query). Skip inventing access they never had
          // for list/approval if they only had lot — still OK to only move existing.
          // Nothing to insert when row missing.
        }
      }
    }

    await client.query('COMMIT');
    console.log('Spare Parts menu group is ready');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
