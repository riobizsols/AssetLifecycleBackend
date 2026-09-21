require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblMaintTypes'
      ORDER BY ordinal_position
    `);
    console.log('COLUMNS', cols.rows);

    const existing = await client.query(
      `SELECT * FROM "tblMaintTypes" WHERE LOWER(TRIM(text)) = 'calibration' OR maint_type_id = 'MT017'`,
    );
    if (existing.rows.length) {
      console.log('Already exists:', existing.rows);
      return;
    }

    const sample = await client.query(`SELECT * FROM "tblMaintTypes" ORDER BY maint_type_id DESC LIMIT 1`);
    console.log('SAMPLE', sample.rows[0]);

    const orgs = await client.query(
      `SELECT DISTINCT org_id FROM "tblMaintTypes" WHERE org_id IS NOT NULL ORDER BY org_id`,
    );
    console.log('ORGS', orgs.rows);

    const maxId = await client.query(`
      SELECT MAX(CAST(SUBSTRING(maint_type_id FROM 3) AS INTEGER)) AS n
      FROM "tblMaintTypes"
      WHERE maint_type_id ~ '^MT[0-9]+$'
    `);
    const nextNum = (maxId.rows[0]?.n || 0) + 1;
    const newId = `MT${String(nextNum).padStart(3, '0')}`;

    const targets = orgs.rows.length
      ? orgs.rows.map((r) => r.org_id)
      : [(await client.query(`SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`)).rows[0]?.org_id];

    for (const orgId of targets) {
      if (!orgId) continue;
      const colsList = Object.keys(sample.rows[0] || {});
      // Build insert based on known columns
      const hasHours = cols.rows.some((c) => c.column_name === 'hours_required');
      const hasIntStatus = cols.rows.some((c) => c.column_name === 'int_status');
      const hasOrg = cols.rows.some((c) => c.column_name === 'org_id');

      if (hasHours && hasIntStatus && hasOrg) {
        await client.query(
          `
            INSERT INTO "tblMaintTypes" (maint_type_id, text, hours_required, int_status, org_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (maint_type_id) DO UPDATE
            SET text = EXCLUDED.text, int_status = EXCLUDED.int_status
          `,
          [newId, 'Calibration', sample.rows[0]?.hours_required ?? null, 1, orgId],
        );
      } else if (hasOrg) {
        await client.query(
          `
            INSERT INTO "tblMaintTypes" (maint_type_id, text, org_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (maint_type_id) DO UPDATE SET text = EXCLUDED.text
          `,
          [newId, 'Calibration', orgId],
        );
      } else {
        await client.query(
          `
            INSERT INTO "tblMaintTypes" (maint_type_id, text)
            VALUES ($1, $2)
            ON CONFLICT (maint_type_id) DO UPDATE SET text = EXCLUDED.text
          `,
          [newId, 'Calibration'],
        );
      }
      console.log('Inserted', newId, 'for org', orgId);
    }

    const check = await client.query(
      `SELECT maint_type_id, text, org_id FROM "tblMaintTypes" WHERE text ILIKE '%calibrat%' ORDER BY maint_type_id`,
    );
    console.log('RESULT', check.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
