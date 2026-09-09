#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');
(async () => {
  const d = await db.query(
    `SELECT ais_id, asset_id, status, act_insp_st_date, act_insp_end_date, wfaiish_id, created_on, changed_on
     FROM "tblAAT_Insp_Sch" WHERE asset_id='BNA000136' ORDER BY created_on DESC`,
  );
  const w = await db.query(
    `SELECT wfaiish_id, status, pl_sch_date FROM "tblWFAATInspSch_H" WHERE asset_id='BNA000136'`,
  );
  console.log('direct', d.rows);
  console.log('workflow', w.rows);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
