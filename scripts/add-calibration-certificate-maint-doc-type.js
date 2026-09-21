/**
 * Add Calibration Certificate as a maintenance document type for Doc Upload.
 * Usage: node scripts/add-calibration-certificate-maint-doc-type.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function nextDtoId(client) {
  const { rows } = await client.query(`
    SELECT dto_id FROM "tblDocTypeObjects"
    WHERE dto_id ~ '^DTO[0-9]+$'
    ORDER BY CAST(SUBSTRING(dto_id FROM 4) AS int) DESC
    LIMIT 1
  `);
  const last = rows[0]?.dto_id || 'DTO000';
  const n = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `DTO${String(n + 1).padStart(3, '0')}`;
}

async function ensureForOrg(client, orgId, preferredId) {
  const existing = await client.query(
    `
      SELECT dto_id, object_type, doc_type, doc_type_text, org_id
      FROM "tblDocTypeObjects"
      WHERE org_id = $1
        AND LOWER(BTRIM(object_type)) = 'maintenance'
        AND (
          doc_type = 'CL'
          OR LOWER(TRIM(doc_type_text)) = 'calibration certificate'
        )
      LIMIT 1
    `,
    [orgId],
  );
  if (existing.rows[0]) {
    console.log(`${orgId}: already exists`, existing.rows[0]);
    return existing.rows[0];
  }

  let dtoId = preferredId;
  const taken = await client.query(
    `SELECT 1 FROM "tblDocTypeObjects" WHERE dto_id = $1 LIMIT 1`,
    [dtoId],
  );
  if (taken.rows.length) {
    dtoId = await nextDtoId(client);
  }

  const inserted = await client.query(
    `
      INSERT INTO "tblDocTypeObjects"
        (dto_id, object_type, doc_type, doc_type_text, org_id, branch_id, dept_id)
      VALUES ($1, 'maintenance', 'CL', 'Calibration Certificate', $2, NULL, NULL)
      RETURNING dto_id, object_type, doc_type, doc_type_text, org_id
    `,
    [dtoId, orgId],
  );
  console.log(`${orgId}: inserted`, inserted.rows[0]);
  return inserted.rows[0];
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  try {
    await ensureForOrg(client, 'ORG003', 'DTO044');
    await ensureForOrg(client, 'ORG004', 'DTO045');

    const verify = await client.query(`
      SELECT dto_id, object_type, doc_type, doc_type_text, org_id
      FROM "tblDocTypeObjects"
      WHERE LOWER(BTRIM(object_type)) = 'maintenance'
        AND (doc_type = 'CL' OR LOWER(TRIM(doc_type_text)) = 'calibration certificate')
      ORDER BY org_id, dto_id
    `);
    console.log('VERIFY', verify.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
