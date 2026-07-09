#!/usr/bin/env node
require('dotenv').config();
const inspectionModel = require('../models/inspectionScheduleModel');

(async () => {
  const ais_id = 'AIS_586081219';
  const org_id = 'ORG001';
  const insp = (await inspectionModel.getInspectionDetailsById(ais_id, org_id)).rows[0];
  console.log('insp', insp.asset_type_id, insp.aatif_id);

  const checklist = (await inspectionModel.getInspectionChecklistByAssetType(insp.asset_type_id, org_id)).rows;
  console.log('checklist', checklist.map((c) => ({ id: c.insp_check_id, type: c.response_type, min: c.min_range, max: c.max_range })));

  const records = [
    { insp_check_id: 'IC018', recorded_value: 'good' },
    { insp_check_id: 'IC022', recorded_value: '16' },
  ];
  const linkId = insp.aatif_id;
  for (const r of records) {
    const result = await inspectionModel.saveInspectionRecord({
      aatisch_id: linkId,
      insp_check_id: r.insp_check_id,
      recorded_value: r.recorded_value,
      created_by: 'USR003',
      org_id,
    });
    console.log('saved', r.insp_check_id, result.rows?.[0]?.attirec_id);
  }

  const upd = await inspectionModel.updateInspectionRecord(ais_id, org_id, {
    notes: 'Oops',
    trigger_maintenance: false,
    status: 'CO',
    act_insp_end_date: new Date().toISOString(),
  });
  console.log('updated', upd.rows[0]?.status, upd.rows[0]?.notes);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
