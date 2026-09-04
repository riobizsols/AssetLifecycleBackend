#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Ensure shared types exist (keep current org_id; API now always returns MT001-MT004)
  const { DEFAULT_MAINT_TYPES } = require('../constants/setupDefaults');
  for (const type of DEFAULT_MAINT_TYPES) {
    const hours = type.id === 'MT002' ? 48 : 24;
    await c.query(
      `
      INSERT INTO "tblMaintTypes" (maint_type_id, org_id, text, int_status, hours_required)
      VALUES ($1, 'BAN001', $2, 1, $3)
      ON CONFLICT (maint_type_id) DO UPDATE
      SET text = EXCLUDED.text, int_status = 1
      `,
      [type.id, type.name, hours],
    );
  }

  const r = await c.query(`
    SELECT maint_type_id, org_id, text FROM "tblMaintTypes"
    WHERE int_status = 1 AND maint_type_id IN ('MT001','MT002','MT003','MT004')
    ORDER BY maint_type_id
  `);
  console.log('shared types', r.rows);

  // Simulate BAN001 list query
  const list = await c.query(`
    SELECT maint_type_id, text FROM "tblMaintTypes"
    WHERE int_status = 1
      AND (org_id = $1 OR maint_type_id IN ('MT001','MT002','MT003','MT004'))
    ORDER BY text
  `, ['BAN001']);
  console.log('BAN001 dropdown would show', list.rows);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
