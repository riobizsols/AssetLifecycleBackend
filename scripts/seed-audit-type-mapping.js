/**
 * Seed AUDITATMAPPING app + JR001 nav under Master Data.
 * Usage: node scripts/seed-audit-type-mapping.js
 * Optional: TENANT_DB=ngp_db
 */
require('dotenv').config();
const { Client } = require('pg');

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
  if (!name) return base;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

async function seedDb(dbName) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    const orgRes = await client.query(
      `SELECT org_id FROM "tblOrgs" WHERE COALESCE(int_status, 1) = 1 ORDER BY org_id LIMIT 1`,
    );
    const primaryOrg = orgRes.rows[0]?.org_id;
    if (!primaryOrg) throw new Error('No organization found');

    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ('AUDITATMAPPING', 'Audit Type – Asset Type Mapping', true, $1)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text, int_status = true, org_id = EXCLUDED.org_id
      `,
      [primaryOrg],
    );

    const navExists = await client.query(
      `
        SELECT 1 FROM "tblJobRoleNav"
        WHERE job_role_id = 'JR001' AND app_id = 'AUDITATMAPPING'
        LIMIT 1
      `,
    );

    if (!navExists.rows.length) {
      const parent = await client.query(
        `
          SELECT job_role_nav_id FROM "tblJobRoleNav"
          WHERE job_role_id = 'JR001' AND label ILIKE 'Master Data'
          ORDER BY sequence LIMIT 1
        `,
      );
      const parentId = parent.rows[0]?.job_role_nav_id || 'JRN009';
      const maxSeq = await client.query(
        `
          SELECT COALESCE(MAX(sequence), 0)::int AS s
          FROM "tblJobRoleNav"
          WHERE job_role_id = 'JR001' AND parent_id = $1
        `,
        [parentId],
      );
      const seq = (maxSeq.rows[0]?.s || 0) + 1;

      let jrnId = 'JRN065';
      for (let i = 65; i < 300; i += 1) {
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
          VALUES ($1, 'JR001', $2, 'AUDITATMAPPING', 'Audit Type – Asset Type Mapping', $3, 'A', false, $4, 1, 'D')
        `,
        [jrnId, parentId, seq, primaryOrg],
      );
      console.log(`[${dbName}] nav created ${jrnId} under ${parentId}`);
    } else {
      await client.query(
        `UPDATE "tblJobRoleNav" SET int_status = 1 WHERE app_id = 'AUDITATMAPPING'`,
      );
      console.log(`[${dbName}] nav already present — ensured active`);
    }

    await client.query('COMMIT');
    console.log(`[${dbName}] AUDITATMAPPING seeded`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  const targets = process.env.TENANT_DB
    ? [process.env.TENANT_DB]
    : process.argv.slice(2).length
      ? process.argv.slice(2)
      : ['ngp_db'];
  for (const db of targets) {
    await seedDb(db);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
