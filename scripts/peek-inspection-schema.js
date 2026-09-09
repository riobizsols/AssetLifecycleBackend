#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');
(async () => {
  const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblWFATInspSeqs' ORDER BY ordinal_position`);
  console.log('tblWFATInspSeqs cols:', cols.rows.map(r=>r.column_name));
  const sample = await db.query(`SELECT * FROM "tblWFATInspSeqs" LIMIT 1`);
  console.log('sample seq:', sample.rows);
  const steps = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%wf%insp%' OR table_name='tblWFSteps'`);
  console.log('tables:', steps.rows);
  const wfs = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblWFInspSteps' ORDER BY ordinal_position`).catch(()=>({rows:[]}));
  console.log('tblWFInspSteps cols:', wfs.rows.map(r=>r.column_name));
  const wfjr = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblWFInspJobRole' ORDER BY ordinal_position`);
  console.log('tblWFInspJobRole cols:', wfjr.rows.map(r=>r.column_name));
  const aif = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblAAT_Insp_Freq' ORDER BY ordinal_position`);
  console.log('tblAAT_Insp_Freq cols:', aif.rows.map(r=>r.column_name));
  const aatic = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblAATInspCheckList' ORDER BY ordinal_position`);
  console.log('tblAATInspCheckList cols:', aatic.rows.map(r=>r.column_name));
  const icl = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tblInspCheckList' ORDER BY ordinal_position`);
  console.log('tblInspCheckList cols:', icl.rows.map(r=>r.column_name));
  process.exit(0);
})();
