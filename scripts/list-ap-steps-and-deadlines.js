#!/usr/bin/env node
/**
 * Lists all workflow steps currently in AP (Awaiting Approval) with their
 * step date, esc_no_days, computed deadline, and whether they would be
 * considered OVERDUE by the escalation job.
 *
 * Use this to see why "No overdue workflows" or to find a candidate to test escalation.
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/list-ap-steps-and-deadlines.js [orgId]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getDb } = require('../utils/dbContext');

const orgId = process.argv[2] || process.env.ORG_ID || 'ORG001';

function toLocalDateStr(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set.');
    process.exit(1);
  }

  const query = `
    SELECT DISTINCT ON (wfd.wfamsh_id, wfd.sequence)
      wfd.wfamsh_id,
      wfd.wfamsd_id,
      wfd.sequence,
      ws.text as step_name,
      ws.esc_no_days,
      wfd.created_on::date as step_created_date,
      (COALESCE((wfd.changed_on)[1], wfd.created_on))::date as step_date_used,
      (COALESCE((wfd.changed_on)[1], wfd.created_on)::date + (COALESCE(ws.esc_no_days, 0) || ' days')::interval)::date as step_deadline,
      wfh.pl_sch_date::date as due_date,
      at.text as asset_type_name,
      (
        SELECT 1 FROM "tblWFAssetMaintSch_D" wfd2
        WHERE wfd2.wfamsh_id = wfd.wfamsh_id AND wfd2.org_id = wfd.org_id
          AND wfd2.notes IS NOT NULL AND wfd2.notes LIKE '%[ESCALATED on%'
        LIMIT 1
      ) IS NOT NULL as already_escalated
    FROM "tblWFAssetMaintSch_D" wfd
    INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id AND wfh.org_id = wfd.org_id
    INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblWFATSeqs" wfas ON wfas.asset_type_id = a.asset_type_id
      AND wfas.org_id = wfd.org_id AND CAST(wfas.seqs_no AS INTEGER) = wfd.sequence
    LEFT JOIN "tblWFSteps" ws ON ws.wf_steps_id = wfas.wf_steps_id
    WHERE wfd.org_id = $1
      AND wfd.status = 'AP'
      AND wfh.status IN ('IN', 'IP')
    ORDER BY wfd.wfamsh_id, wfd.sequence
  `;

  const db = getDb();
  const { rows } = await db.query(query, [orgId]);
  const today = toLocalDateStr(new Date());

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  WORKFLOWS IN AP – STEP DATES & DEADLINES (Org: ' + orgId + ')');
  console.log('  Today (local): ' + today);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (rows.length === 0) {
    console.log('  No workflows currently in AP with header IN/IP.');
    console.log('  Create a maintenance workflow and leave a step in Awaiting Approval to test.\n');
    return;
  }

  for (const r of rows) {
    const stepDateStr = toLocalDateStr(r.step_date_used);
    const deadlineStr = toLocalDateStr(r.step_deadline);
    const overdue = deadlineStr && today > deadlineStr && !r.already_escalated;
    console.log('  wfamsh_id: ' + r.wfamsh_id + '  seq: ' + r.sequence + '  step: ' + (r.step_name || '?'));
    console.log('    step_date: ' + stepDateStr + '  esc_no_days: ' + (r.esc_no_days ?? 'NULL') + '  deadline: ' + deadlineStr);
    console.log('    already_escalated: ' + r.already_escalated + '  → OVERDUE: ' + (overdue ? 'YES' : 'NO'));
    console.log('');
  }

  console.log('  Overdue when (today > deadline) and not already_escalated.');
  console.log('  With esc_no_days=1: step Mar 9 → deadline Mar 10 → overdue from Mar 11.');
  console.log('  To test now: run  node scripts/backdate-one-ap-step-for-escalation-test.js <wfamsh_id> ' + orgId);
  console.log('  Then run:       node scripts/test-workflow-escalation.js ' + orgId + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
