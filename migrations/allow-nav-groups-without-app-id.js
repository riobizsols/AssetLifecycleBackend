/**
 * Allow menu groups in tblJobRoleNav without a tblApps entry.
 * - Makes tblJobRoleNav.app_id nullable
 * - Clears app_id on existing group rows
 * - Removes group-only rows from tblApps (screens keep their app_id rows)
 *
 * Usage: node migrations/allow-nav-groups-without-app-id.js
 * Optional: TENANT_DATABASE_URL=... node migrations/allow-nav-groups-without-app-id.js
 */
const { Pool } = require("pg");
require("dotenv").config();

const connectionString =
  process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL or TENANT_DATABASE_URL required");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function dropJobRoleNavAppFk(client) {
  const { rows } = await client.query(`
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'tblJobRoleNav'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'app_id'
  `);

  for (const { constraint_name } of rows) {
    await client.query(
      `ALTER TABLE "tblJobRoleNav" DROP CONSTRAINT IF EXISTS "${constraint_name}"`,
    );
    console.log(`✓ Dropped FK ${constraint_name} on tblJobRoleNav.app_id`);
  }
}

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await dropJobRoleNavAppFk(client);

    await client.query(`
      ALTER TABLE "tblJobRoleNav"
      ALTER COLUMN app_id DROP NOT NULL
    `);
    console.log("✓ tblJobRoleNav.app_id is now nullable");

    const groupOnlyApps = await client.query(`
      SELECT DISTINCT a.app_id
      FROM "tblApps" a
      WHERE EXISTS (
        SELECT 1 FROM "tblJobRoleNav" j
        WHERE j.app_id = a.app_id AND j.is_group = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM "tblJobRoleNav" j2
        WHERE j2.app_id = a.app_id AND j2.is_group = false
      )
    `);
    const appIdsToDelete = groupOnlyApps.rows.map((r) => r.app_id);

    const cleared = await client.query(`
      UPDATE "tblJobRoleNav"
      SET app_id = NULL
      WHERE is_group = true AND app_id IS NOT NULL
      RETURNING job_role_nav_id
    `);
    console.log(`✓ Cleared app_id on ${cleared.rowCount} group navigation row(s)`);

    if (appIdsToDelete.length > 0) {
      const deleted = await client.query(
        `DELETE FROM "tblApps" WHERE app_id = ANY($1) RETURNING app_id`,
        [appIdsToDelete],
      );
      console.log(
        `✓ Removed ${deleted.rowCount} group-only app(s) from tblApps: ${deleted.rows
          .map((r) => r.app_id)
          .join(", ")}`,
      );
    } else {
      console.log("✓ No group-only apps to remove from tblApps");
    }

    await client.query("COMMIT");
    console.log("✅ Migration completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
