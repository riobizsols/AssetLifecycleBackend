#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

(async () => {
  const queries = {
    assetTypeAll: `SELECT asset_type_id, text, inspection_required, org_id FROM "tblAssetTypes" WHERE text ILIKE '%insp%' OR text ILIKE '%test%' OR text ILIKE '%FInsp%' ORDER BY text LIMIT 30`,
    assetAll: `SELECT asset_id, text, asset_type_id, current_status, purchased_on, org_id FROM "tblAssets" WHERE text ILIKE '%insp%' OR asset_id ILIKE '%insp%' OR text ILIKE '%AssetInspection%' LIMIT 30`,
    orgs: `SELECT DISTINCT org_id FROM "tblAssetTypes" LIMIT 10`,
    fiAssetType: `SELECT * FROM "tblAssetTypes" WHERE asset_type_id = 'AT072'`,
    fiAssets: `SELECT asset_id, text, asset_type_id, current_status, purchased_on, group_id, service_vendor_id FROM "tblAssets" WHERE asset_type_id = 'AT072'`,
    fiFreq: `SELECT aif.*, aaic.at_id FROM "tblAAT_Insp_Freq" aif JOIN "tblAATInspCheckList" aaic ON aif.aatic_id = aaic.aatic_id WHERE aaic.at_id = 'AT072'`,
    fiChecklist: `SELECT * FROM "tblAATInspCheckList" WHERE at_id = 'AT072'`,
    fiWorkflow: `SELECT * FROM "tblWFATInspSeqs" WHERE at_id = 'AT072'`,
    fiDirect: `SELECT s.* FROM "tblAAT_Insp_Sch" s JOIN "tblAssets" a ON s.asset_id = a.asset_id WHERE a.asset_type_id = 'AT072'`,
    fiWf: `SELECT h.*, d.job_role_id, d.status as detail_status FROM "tblWFAATInspSch_H" h LEFT JOIN "tblWFAATInspSch_D" d ON h.wfaiish_id = d.wfaiish_id JOIN "tblAssets" a ON h.asset_id = a.asset_id WHERE a.asset_type_id = 'AT072'`,
    at071Workflow: `SELECT * FROM "tblWFATInspSeqs" WHERE at_id = 'AT071'`,
    uom: `SELECT UOM_id, UOM FROM "tblUom" WHERE UOM_id='UOM001'`,
  };

  for (const [name, sql] of Object.entries(queries)) {
    console.log(`\n=== ${name} ===`);
    try {
      const r = await db.query(sql);
      console.log('rows:', r.rows.length);
      console.log(JSON.stringify(r.rows, null, 2));
    } catch (e) {
      console.error(name, e.message);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
