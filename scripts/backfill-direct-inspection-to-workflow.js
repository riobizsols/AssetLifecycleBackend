#!/usr/bin/env node
/**
 * Convert a direct manual inspection into a workflow approval record.
 * Usage: node scripts/backfill-direct-inspection-to-workflow.js --ais-id=AIS_459656_379
 */
require('dotenv').config();

const db = require('../config/db');
const inspectionModel = require('../models/inspectionScheduleModel');

const aisId = process.argv.find((a) => a.startsWith('--ais-id='))?.split('=')[1];
if (!aisId) {
  console.error('Usage: node scripts/backfill-direct-inspection-to-workflow.js --ais-id=AIS_xxx');
  process.exit(1);
}

async function main() {
  const direct = await db.query(
    `SELECT sch.*, a.asset_type_id, a.purchase_vendor_id as vendor_id, b.branch_code
     FROM "tblAAT_Insp_Sch" sch
     JOIN "tblAssets" a ON sch.asset_id = a.asset_id
     LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
     WHERE sch.ais_id = $1`,
    [aisId],
  );
  if (!direct.rows.length) {
    throw new Error(`Direct inspection ${aisId} not found`);
  }
  const row = direct.rows[0];
  const orgId = row.org_id;
  const assetTypeId = row.asset_type_id;

  const freq = await inspectionModel.getInspectionFrequency(assetTypeId, orgId);
  if (!freq.rows.length) throw new Error('No frequency for asset type');
  const frequency = freq.rows[0];

  const wfSeq = await inspectionModel.checkWorkflowExists(assetTypeId, orgId);
  if (!wfSeq.rows.length) throw new Error('No workflow sequences configured');

  const wfaiish_id = await inspectionModel.getNextWFAIISHId();
  await inspectionModel.createWorkflowInspectionHeader({
    wfaiish_id,
    aatif_id: frequency.aatif_id,
    asset_id: row.asset_id,
    group_id: null,
    vendor_id: row.vendor_id || null,
    pl_sch_date: row.act_insp_st_date || new Date(),
    status: 'IN',
    created_by: row.created_by || 'SYSTEM',
    org_id: orgId,
    branch_code: row.branch_code || null,
    emp_int_id: row.emp_int_id || null,
  });

  for (let i = 0; i < wfSeq.rows.length; i++) {
    const sequence = wfSeq.rows[i];
    const jobRoleResult = await inspectionModel.getInspectionJobRole(sequence.wf_steps_id, orgId);
    if (!jobRoleResult.rows.length) continue;
    const jobRole = jobRoleResult.rows[0];
    const wfaiisd_id = await inspectionModel.getNextWFAIISDId();
    await inspectionModel.createWorkflowInspectionDetail({
      wfaiisd_id,
      wfaiish_id,
      job_role_id: jobRole.job_role_id,
      dept_id: jobRole.dept_id,
      sequence: i + 1,
      status: i === 0 ? 'AP' : 'IN',
      created_by: row.created_by || 'SYSTEM',
      org_id: orgId,
      user_id: jobRole.emp_int_id || null,
    });
  }

  await db.query(`DELETE FROM "tblAAT_Insp_Sch" WHERE ais_id = $1`, [aisId]);
  console.log(`Converted ${aisId} -> workflow ${wfaiish_id} for asset ${row.asset_id} (${orgId})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
