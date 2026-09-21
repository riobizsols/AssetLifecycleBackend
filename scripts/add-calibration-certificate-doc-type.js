require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  try {
    const existing = await client.query(`
      SELECT dto_id, object_type, doc_type, doc_type_text, org_id
      FROM "tblDocTypeObjects"
      WHERE LOWER(TRIM(doc_type_text)) = 'calibration certificate'
         OR (doc_type = 'CL' AND LOWER(TRIM(doc_type_text)) LIKE '%calibrat%')
      ORDER BY dto_id
    `);
    if (existing.rows.length) {
      console.log('Already exists:', existing.rows);
      return;
    }

    const maxId = await client.query(`
      SELECT MAX(CAST(SUBSTRING(dto_id FROM 4) AS INTEGER)) AS n
      FROM "tblDocTypeObjects"
      WHERE dto_id ~ '^DTO[0-9]+$'
    `);
    let nextNum = (maxId.rows[0]?.n || 0) + 1;

    const orgs = await client.query(`
      SELECT DISTINCT org_id FROM "tblDocTypeObjects" WHERE org_id IS NOT NULL ORDER BY org_id
    `);
    const orgIds = orgs.rows.map((r) => r.org_id);
    console.log('ORGS', orgIds);

    const objectTypesToAdd = ['asset', 'asset group'];

    for (const orgId of orgIds) {
      for (const objectType of objectTypesToAdd) {
        const typeExists = await client.query(
          `
            SELECT 1 FROM "tblDocTypeObjects"
            WHERE org_id = $1 AND object_type = $2
            LIMIT 1
          `,
          [orgId, objectType],
        );
        if (!typeExists.rows.length) continue;

        const dup = await client.query(
          `
            SELECT 1 FROM "tblDocTypeObjects"
            WHERE org_id = $1
              AND object_type = $2
              AND LOWER(TRIM(doc_type_text)) = 'calibration certificate'
            LIMIT 1
          `,
          [orgId, objectType],
        );
        if (dup.rows.length) continue;

        const dtoId = `DTO${String(nextNum).padStart(3, '0')}`;
        nextNum += 1;

        await client.query(
          `
            INSERT INTO "tblDocTypeObjects"
              (dto_id, object_type, doc_type, doc_type_text, org_id, branch_id, dept_id)
            VALUES ($1, $2, 'CL', 'Calibration Certificate', $3, NULL, NULL)
          `,
          [dtoId, objectType, orgId],
        );
        console.log('Inserted', dtoId, objectType, orgId);
      }
    }

    const check = await client.query(`
      SELECT dto_id, object_type, doc_type, doc_type_text, org_id
      FROM "tblDocTypeObjects"
      WHERE LOWER(TRIM(doc_type_text)) = 'calibration certificate'
      ORDER BY org_id, object_type, dto_id
    `);
    console.log('RESULT', check.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
