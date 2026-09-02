#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const q = async (sql, params = []) => (await c.query(sql, params)).rows;

  const orgs = await q(`SELECT org_id FROM "tblOrgs" WHERE org_id LIKE 'BAN%' ORDER BY org_id`);
  console.log('=== Counts per org ===');
  for (const { org_id } of orgs) {
    const [freq, seq, chk, wfs, wfjr, ujr, types] = await Promise.all([
      q('SELECT COUNT(*)::int AS c FROM "tblATMaintFreq" WHERE org_id=$1', [org_id]),
      q('SELECT COUNT(*)::int AS c FROM "tblWFATSeqs" WHERE org_id=$1', [org_id]),
      q('SELECT COUNT(*)::int AS c FROM "tblATMaintCheckList" WHERE org_id=$1', [org_id]),
      q('SELECT COUNT(*)::int AS c FROM "tblWFSteps" WHERE org_id=$1', [org_id]),
      q('SELECT COUNT(*)::int AS c FROM "tblWFJobRole" WHERE org_id=$1', [org_id]),
      q(
        `SELECT COUNT(*)::int AS c FROM "tblUserJobRoles" ur
         JOIN "tblJobRoles" jr ON ur.job_role_id = jr.job_role_id
         WHERE jr.org_id = $1 AND jr.job_role_id IN ('JR002','JR003')`,
        [org_id],
      ),
      q('SELECT COUNT(*)::int AS c FROM "tblAssetTypes" WHERE org_id=$1', [org_id]),
    ]);
    console.log(org_id, {
      assetTypes: types[0].c,
      frequencies: freq[0].c,
      sequences: seq[0].c,
      checklist: chk[0].c,
      wfSteps: wfs[0].c,
      wfJobRoles: wfjr[0].c,
      userRoles: ujr[0].c,
    });
  }

  const sample = await q(
    `SELECT at.asset_type_id, at.text, f.maint_type_id, f.frequency, s.wf_steps_id, s.seqs_no
     FROM "tblAssetTypes" at
     JOIN "tblATMaintFreq" f ON f.asset_type_id = at.asset_type_id
     JOIN "tblWFATSeqs" s ON s.asset_type_id = at.asset_type_id
     WHERE at.org_id = 'BAN003'
     ORDER BY at.text, s.seqs_no
     LIMIT 6`,
  );
  console.log('\nSample BAN003 rows:', JSON.stringify(sample, null, 2));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
