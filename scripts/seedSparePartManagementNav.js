/**
 * Ensure SPAREPARTMGMT app + nav under Reports for existing tenants.
 * Usage: node scripts/seedSparePartManagementNav.js
 *
 * Moves/renames the item to "Spare part consumption report" under Reports.
 */
require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const APP_ID = 'SPAREPARTMGMT';
const APP_LABEL = 'Spare part consumption report';
const REPORTS_LABEL = 'Reports';

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
        WHERE org_id IS NOT NULL
          AND (
            app_id = $1
            OR LOWER(BTRIM(COALESCE(label, ''))) = 'reports'
          )
      `,
      [APP_ID],
    );

    let moved = 0;
    for (const role of roles.rows) {
      const { job_role_id, org_id, access_level, mob_desk } = role;

      const reportsGroup = await client.query(
        `
          SELECT job_role_nav_id
          FROM "tblJobRoleNav"
          WHERE org_id = $1
            AND job_role_id = $2
            AND is_group = true
            AND LOWER(BTRIM(COALESCE(label, ''))) = LOWER($3)
          ORDER BY sequence ASC NULLS LAST
          LIMIT 1
        `,
        [org_id, job_role_id, REPORTS_LABEL],
      );
      if (!reportsGroup.rowCount) continue;
      const parentId = reportsGroup.rows[0].job_role_nav_id;

      const existing = await client.query(
        `
          SELECT job_role_nav_id, parent_id
          FROM "tblJobRoleNav"
          WHERE org_id = $1
            AND job_role_id = $2
            AND app_id = $3
          LIMIT 1
        `,
        [org_id, job_role_id, APP_ID],
      );

      if (existing.rowCount) {
        await client.query(
          `
            UPDATE "tblJobRoleNav"
            SET parent_id = $1,
                label = $2,
                int_status = 1
            WHERE job_role_nav_id = $3
              AND org_id = $4
          `,
          [parentId, APP_LABEL, existing.rows[0].job_role_nav_id, org_id],
        );
        moved += 1;
        continue;
      }

      const seqRes = await client.query(
        `
          SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq
          FROM "tblJobRoleNav"
          WHERE org_id = $1
            AND job_role_id = $2
            AND parent_id = $3
        `,
        [org_id, job_role_id, parentId],
      );
      const sequence = seqRes.rows[0].next_seq || 17;

      const idRes = await client.query(
        `
          SELECT CONCAT('JRN', LPAD((COALESCE(MAX(
            CASE WHEN job_role_nav_id ~ '^JRN[0-9]+$'
              THEN NULLIF(REGEXP_REPLACE(job_role_nav_id, '\\D', '', 'g'), '')::int
              ELSE NULL END
          ), 0) + 1)::text, 3, '0')) AS next_id
          FROM "tblJobRoleNav"
          WHERE org_id = $1
        `,
        [org_id],
      );
      const navId = idRes.rows[0].next_id;

      await client.query(
        `
          INSERT INTO "tblJobRoleNav" (
            job_role_nav_id, job_role_id, parent_id, app_id, label,
            sequence, access_level, is_group, org_id, mob_desk, int_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, 1)
        `,
        [
          navId,
          job_role_id,
          parentId,
          APP_ID,
          APP_LABEL,
          sequence,
          access_level || 'A',
          org_id,
          mob_desk || 'D',
        ],
      );
      moved += 1;
    }

    await client.query('COMMIT');
    console.log(
      `Done. SPAREPARTMGMT under Reports as "${APP_LABEL}". Roles updated: ${moved}`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
