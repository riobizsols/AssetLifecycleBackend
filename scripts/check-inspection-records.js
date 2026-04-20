#!/usr/bin/env node
/**
 * Quick script to check tblAAT_Insp_Rec for a given ais_id
 * Usage: node scripts/check-inspection-records.js AIS_001
 */
require('dotenv').config();
const db = require('../config/db');

const aisId = process.argv[2] || 'AIS_001';

(async () => {
  try {
    console.log(`Checking inspection records for ais_id: ${aisId}`);
    const res = await db.query(`SELECT * FROM "tblAAT_Insp_Rec" WHERE aatisch_id = $1 ORDER BY created_on DESC`, [aisId]);
    console.log(`Found ${res.rows.length} rows:`);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error querying inspection records:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
