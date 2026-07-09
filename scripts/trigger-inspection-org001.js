#!/usr/bin/env node
require('dotenv').config();
const CronService = require('../services/cronService');

(async () => {
  const cron = new CronService();
  const result = await cron.triggerInspection('ORG001');
  console.log(JSON.stringify(result, null, 2));

  const db = require('../config/db');
  const wf = await db.query(`
    SELECT h.wfaiish_id, h.asset_id, h.status, h.pl_sch_date, h.created_on,
           d.job_role_id, d.status as detail_status, a.text as asset_name, at.text as asset_type
    FROM "tblWFAATInspSch_H" h
    JOIN "tblWFAATInspSch_D" d ON h.wfaiish_id = d.wfaiish_id
    JOIN "tblAssets" a ON h.asset_id = a.asset_id
    JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE a.asset_type_id = 'AT072'
    ORDER BY h.created_on DESC
    LIMIT 5
  `);
  console.log('\nWorkflow headers for FIspTest:');
  console.log(JSON.stringify(wf.rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
