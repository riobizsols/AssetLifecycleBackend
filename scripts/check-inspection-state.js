#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const orgs = await db.query(`SELECT org_id FROM "tblOrgs" WHERE org_id LIKE 'BAN%' ORDER BY org_id`);
  for (const { org_id } of orgs.rows) {
    const types = await db.query(
      `SELECT COUNT(*)::int c FROM "tblAssetTypes" WHERE org_id=$1 AND int_status=1`,
      [org_id],
    );
    const inspReq = await db.query(
      `SELECT COUNT(*)::int c FROM "tblAssetTypes" WHERE org_id=$1 AND inspection_required=true`,
      [org_id],
    );
    const freq = await db.query(`SELECT COUNT(*)::int c FROM "tblAAT_Insp_Freq" WHERE org_id=$1`, [org_id]);
    const map = await db.query(`SELECT COUNT(*)::int c FROM "tblAATInspCheckList" WHERE org_id=$1`, [org_id]);
    const icl = await db.query(`SELECT COUNT(*)::int c FROM "tblInspCheckList" WHERE org_id=$1`, [org_id]);
    const seq = await db.query(`SELECT COUNT(*)::int c FROM "tblWFATInspSeqs" WHERE org_id=$1`, [org_id]);
    const wfjr = await db.query(`SELECT COUNT(*)::int c FROM "tblWFInspJobRole" WHERE org_id=$1`, [org_id]);
    console.log(org_id, { types: types.rows[0].c, inspReq: inspReq.rows[0].c, freq: freq.rows[0].c, map: map.rows[0].c, icl: icl.rows[0].c, seq: seq.rows[0].c, wfjr: wfjr.rows[0].c });
  }
  const sample = await db.query(
    `SELECT asset_type_id, text, inspection_required FROM "tblAssetTypes" WHERE text ILIKE '%distillation%' LIMIT 5`,
  );
  console.log('distillation types:', sample.rows);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
