#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const ais_id = 'AIS_586081219';
  const org_id = 'ORG001';
  const payload = {
    status: 'CO',
    notes: 'Oops',
    trigger_maintenance: false,
    act_insp_end_date: new Date().toISOString(),
  };
  const keys = Object.keys(payload);
  const setClause = keys.map((key, index) => `"${key}" = $${index + 3}`).join(', ');
  const values = [ais_id, org_id, ...Object.values(payload)];
  const query = `
    UPDATE "tblAAT_Insp_Sch"
    SET ${setClause}, changed_on = NOW()
    WHERE ais_id = $1 AND org_id = $2
    RETURNING *
  `;
  console.log('query', query);
  try {
    const r = await db.query(query, values);
    console.log('ok', r.rows[0]);
  } catch (e) {
    console.error('error', e.message, e.detail);
  }
  process.exit(0);
})();
