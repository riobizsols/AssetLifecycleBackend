#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const orgId = 'BAN003';
  const direct = await db.query(
    `SELECT ais_id, asset_id, status, act_insp_st_date, org_id, created_by, created_on
     FROM "tblAAT_Insp_Sch" WHERE org_id = $1 ORDER BY created_on DESC NULLS LAST LIMIT 10`,
    [orgId],
  );
  const workflow = await db.query(
    `SELECT wfaiish_id, asset_id, status, pl_sch_date, org_id, created_by, created_on
     FROM "tblWFAATInspSch_H" WHERE org_id = $1 ORDER BY created_on DESC NULLS LAST LIMIT 10`,
    [orgId],
  );
  const details = await db.query(
    `SELECT d.wfaiisd_id, d.wfaiish_id, d.job_role_id, d.status, d.sequence, h.asset_id
     FROM "tblWFAATInspSch_D" d
     JOIN "tblWFAATInspSch_H" h ON h.wfaiish_id = d.wfaiish_id
     WHERE h.org_id = $1 ORDER BY d.created_on DESC NULLS LAST LIMIT 10`,
    [orgId],
  );
  console.log('Direct inspections:', direct.rows);
  console.log('Workflow headers:', workflow.rows);
  console.log('Workflow details:', details.rows);

  const pending = await db.query(
    `SELECT COUNT(*)::int c FROM "tblWFAATInspSch_D" d
     JOIN "tblWFAATInspSch_H" h ON h.wfaiish_id = d.wfaiish_id
     WHERE h.org_id = $1 AND d.status IN ('PN','AP')`,
    [orgId],
  );
  console.log('Pending workflow detail rows:', pending.rows[0].c);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
