#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

const AT_ID = 'AT072';
const ORG_ID = 'ORG001';

(async () => {
  const existing = await db.query(
    `SELECT * FROM "tblWFATInspSeqs" WHERE at_id = $1 AND org_id = $2`,
    [AT_ID, ORG_ID]
  );
  if (existing.rows.length > 0) {
    console.log('Workflow already exists:', existing.rows);
    process.exit(0);
  }

  const template = await db.query(
    `SELECT * FROM "tblWFATInspSeqs" WHERE at_id = 'AT071' AND org_id = $1 LIMIT 1`,
    [ORG_ID]
  );
  if (!template.rows.length) {
    throw new Error('No template workflow found on AT071');
  }
  const t = template.rows[0];

  const nextIdRes = await db.query(
    `SELECT wfatis_id FROM "tblWFATInspSeqs" WHERE wfatis_id LIKE 'WFATIS_%' ORDER BY wfatis_id DESC LIMIT 1`
  );
  let nextNum = 6;
  if (nextIdRes.rows.length) {
    const m = String(nextIdRes.rows[0].wfatis_id).match(/(\d+)$/);
    if (m) nextNum = parseInt(m[1], 10) + 1;
  }
  const wfatis_id = `WFATIS_${String(nextNum).padStart(3, '0')}`;

  const cols = Object.keys(t).filter((k) => k !== 'wfatis_id' && k !== 'at_id');
  const values = [wfatis_id, AT_ID, ...cols.map((k) => (k === 'wf_steps_id' ? t[k] : t[k]))];
  const placeholders = ['$1', '$2', ...cols.map((_, i) => `$${i + 3}`)].join(', ');
  const colList = ['wfatis_id', 'at_id', ...cols].map((c) => `"${c}"`).join(', ');

  await db.query(
    `INSERT INTO "tblWFATInspSeqs" (${colList}) VALUES (${placeholders})`,
    values
  );

  const verify = await db.query(
    `SELECT ws.*, jr.text as job_role_name
     FROM "tblWFATInspSeqs" ws
     LEFT JOIN "tblWFInspJobRole" wjr ON wjr.wf_insp_steps_id = ws.wf_steps_id AND wjr.org_id = ws.org_id
     LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = wjr.job_role_id
     WHERE ws.at_id = $1`,
    [AT_ID]
  );
  console.log('Inserted inspection workflow for FIspTest:');
  console.log(JSON.stringify(verify.rows, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
