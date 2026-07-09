#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const cols = await db.query(`
    SELECT column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'tblAAT_Insp_Sch'
    ORDER BY ordinal_position
  `);
  console.log('columns:', JSON.stringify(cols.rows, null, 2));

  const insp = await db.query(`
    SELECT ais_id, asset_id, status, notes, vendor_id, aatif_id, trigger_maintenance
    FROM "tblAAT_Insp_Sch"
    WHERE asset_id = 'ASS163'
    ORDER BY created_on DESC
    LIMIT 3
  `);
  console.log('insp:', JSON.stringify(insp.rows, null, 2));

  const recs = await db.query(`
    SELECT air.* FROM "tblAAT_Insp_Rec" air
    JOIN "tblAAT_Insp_Sch" sch ON sch.aatif_id = air.aatisch_id
    WHERE sch.asset_id = 'ASS163'
  `);
  console.log('records:', JSON.stringify(recs.rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
