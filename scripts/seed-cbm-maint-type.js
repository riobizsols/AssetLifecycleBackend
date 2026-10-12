#!/usr/bin/env node
/**
 * Add the "CBM Maintenance" maintenance type for NGP (ORG003).
 * The backend finds it by text, so the id may differ per tenant database.
 *
 * Usage: node scripts/seed-cbm-maint-type.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const TEXT = 'CBM Maintenance';
const ORG_ID = 'ORG003';

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  try {
    const existing = await client.query(
      `SELECT maint_type_id, org_id FROM "tblMaintTypes" WHERE LOWER(TRIM(text)) = LOWER($1) AND org_id = $2`,
      [TEXT, ORG_ID]
    );
    if (existing.rows.length) {
      console.log('Already exists:', existing.rows[0]);
      return;
    }

    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tblMaintTypes'`
    );
    const hasHours = cols.rows.some((c) => c.column_name === 'hours_required');

    const maxId = await client.query(`
      SELECT MAX(CAST(SUBSTRING(maint_type_id FROM 3) AS INTEGER)) AS n
      FROM "tblMaintTypes" WHERE maint_type_id ~ '^MT[0-9]+$'
    `);
    const newId = `MT${String((maxId.rows[0]?.n || 0) + 1).padStart(3, '0')}`;

    if (hasHours) {
      await client.query(
        `INSERT INTO "tblMaintTypes" (maint_type_id, text, hours_required, int_status, org_id)
         VALUES ($1, $2, NULL, 1, $3)`,
        [newId, TEXT, ORG_ID]
      );
    } else {
      await client.query(
        `INSERT INTO "tblMaintTypes" (maint_type_id, text, int_status, org_id) VALUES ($1, $2, 1, $3)`,
        [newId, TEXT, ORG_ID]
      );
    }
    console.log(`Inserted ${newId} "${TEXT}" for ${ORG_ID}`);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
