#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.GENERIC_URL });
  await c.connect();
  const nav = await c.query(
    `SELECT app_id, label, parent_id, sequence
     FROM "tblJobRoleNav"
     WHERE job_role_id = 'JR001' AND int_status = 1
       AND (app_id = 'REOPENEDBREAKDOWNS' OR app_id = 'BREAKDOWNHISTORY' OR LOWER(label) = 'reports')
     ORDER BY sequence`
  );
  console.log('Reference JR001 nav (reports-related):', JSON.stringify(nav.rows, null, 2));
  const apps = await c.query(
    `SELECT app_id, text FROM "tblApps" WHERE app_id = 'REOPENEDBREAKDOWNS'`
  );
  console.log('Reference tblApps:', JSON.stringify(apps.rows, null, 2));
  const count = await c.query(
    `SELECT COUNT(*)::int AS c FROM "tblJobRoleNav" WHERE job_role_id='JR001' AND int_status=1`
  );
  console.log('Total JR001 nav rows:', count.rows[0].c);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
