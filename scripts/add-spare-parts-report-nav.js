#!/usr/bin/env node
/**
 * Add the Spare Parts Report screen to tblApps and to every job role
 * that already has the Asset Lifecycle Report.
 *
 * Usage: node scripts/add-spare-parts-report-nav.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { getTenantCredentials } = require("../services/tenantService");

const APP_ID = "SPAREPARTSREPORT";
const APP_LABEL = "Spare Parts Report";
const ORG_ID = process.argv[2] || "ORG001";

async function nextNavId(client) {
  const { rows } = await client.query(`
    SELECT COALESCE(MAX(
      CASE
        WHEN job_role_nav_id ~ '^JRN[0-9]+$'
        THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
        ELSE 0
      END
    ), 0) + 1 AS n
    FROM "tblJobRoleNav"
  `);
  return `JRN${String(rows[0].n).padStart(3, "0")}`;
}

async function seed(client) {
  const orgs = await client.query(`SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`);
  const orgId = orgs.rows[0]?.org_id || ORG_ID;

  await client.query(
    `
      INSERT INTO "tblApps" (app_id, text, int_status, org_id)
      VALUES ($1, $2, true, $3)
      ON CONFLICT (app_id) DO UPDATE
      SET text = EXCLUDED.text,
          int_status = true
    `,
    [APP_ID, APP_LABEL, orgId]
  );

  const anchors = await client.query(
    `
      SELECT job_role_id, parent_id, access_level, org_id, mob_desk
        FROM "tblJobRoleNav"
       WHERE app_id = 'ASSETLIFECYCLEREPORT'
         AND COALESCE(int_status, 1) = 1
    `
  );

  let inserted = 0;
  let existing = 0;

  for (const row of anchors.rows) {
    const found = await client.query(
      `
        SELECT 1
          FROM "tblJobRoleNav"
         WHERE job_role_id = $1
           AND app_id = $2
           AND COALESCE(mob_desk, 'D') = COALESCE($3, 'D')
         LIMIT 1
      `,
      [row.job_role_id, APP_ID, row.mob_desk]
    );

    if (found.rows.length) {
      await client.query(
        `
          UPDATE "tblJobRoleNav"
             SET label = $1,
                 int_status = 1
           WHERE job_role_id = $2
             AND app_id = $3
             AND COALESCE(mob_desk, 'D') = COALESCE($4, 'D')
        `,
        [APP_LABEL, row.job_role_id, APP_ID, row.mob_desk]
      );
      existing += 1;
      continue;
    }

    const maxSeq = await client.query(
      `
        SELECT COALESCE(MAX(sequence), 0)::int AS s
          FROM "tblJobRoleNav"
         WHERE job_role_id = $1
           AND parent_id IS NOT DISTINCT FROM $2
      `,
      [row.job_role_id, row.parent_id]
    );
    const jrnId = await nextNavId(client);

    await client.query(
      `
        INSERT INTO "tblJobRoleNav"
          (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
           access_level, is_group, org_id, int_status, mob_desk)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, 1, $9)
      `,
      [
        jrnId,
        row.job_role_id,
        row.parent_id,
        APP_ID,
        APP_LABEL,
        (maxSeq.rows[0]?.s || 0) + 1,
        row.access_level || "A",
        row.org_id || orgId,
        row.mob_desk || "D",
      ]
    );
    inserted += 1;
    console.log(`Added ${APP_LABEL} for ${row.job_role_id} (${jrnId})`);
  }

  console.log(
    `Nav inserted=${inserted} existing=${existing} roles_with_reports=${anchors.rows.length}`
  );
}

async function main() {
  const creds = await getTenantCredentials(ORG_ID);
  const client = new Client({
    host: creds.host,
    port: Number(creds.port) || 5432,
    database: creds.database,
    user: creds.user,
    password: creds.password,
    ssl: false,
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    await seed(client);
    await client.query("COMMIT");
    console.log(`Seeded ${APP_ID} in ${creds.database}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
