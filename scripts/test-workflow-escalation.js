#!/usr/bin/env node
/**
 * Test script for workflow auto-escalation.
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/test-workflow-escalation.js [orgId]
 *
 * 1. Shows current escalation status (steps with esc_no_days, overdue count).
 * 2. Runs the escalation process (same as cron / POST /api/workflow-escalation/process).
 * 3. Prints results.
 *
 * Prerequisites:
 * - .env has DATABASE_URL set.
 * - Migration add-esc-no-days-to-tblWFSteps.js has been run.
 * - Optional: set esc_no_days on workflow steps and have at least one step in AP past its deadline.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const orgId = process.argv[2] || process.env.ORG_ID || 'ORG001';

const {
  getOverdueWorkflows,
  getWorkflowStepsWithEscDays,
  processWorkflowEscalations
} = require('../models/workflowEscalationModel');

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  WORKFLOW AUTO-ESCALATION – TEST RUN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Org:', orgId);
  console.log('  Time:', new Date().toISOString());
  console.log('───────────────────────────────────────────────────────────────\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Set it in .env');
    process.exit(1);
  }

  try {
    // 1. Steps with esc_no_days (verify data)
    console.log('1️⃣  Workflow steps and esc_no_days:\n');
    const steps = await getWorkflowStepsWithEscDays(orgId);
    if (steps.length === 0) {
      console.log('   No workflow steps found for this org.');
    } else {
      steps.forEach((s) => {
        console.log(`   ${s.wf_steps_id}  "${s.text}"  esc_no_days: ${s.esc_no_days ?? 'NULL'}`);
      });
    }

    // 2. Overdue workflows (what would be escalated)
    console.log('\n2️⃣  Overdue workflows (current step AP past deadline):\n');
    const overdue = await getOverdueWorkflows(orgId);
    if (overdue.length === 0) {
      console.log('   No overdue workflows. To test escalation:');
      console.log('   - Set esc_no_days on a step (e.g. 1 or 2 days).');
      console.log('   - Have a workflow with that step in status AP where step became AP more than esc_no_days ago.');
      console.log('   - Or use fallback: step with NULL esc_no_days and due_date - lead_time in the past.');
    } else {
      overdue.forEach((w) => {
        console.log(`   wfamsh_id: ${w.wfamsh_id}  seq: ${w.sequence}  step_deadline: ${w.step_deadline || w.cutoff_date_fallback}  esc_no_days: ${w.esc_no_days ?? 'fallback'}  asset_type: ${w.asset_type_name}`);
      });
      console.log(`   Total: ${overdue.length}`);
    }

    // 3. Run escalation process
    console.log('\n3️⃣  Running escalation process...\n');
    const results = await processWorkflowEscalations(orgId);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   Total overdue found:  ', results.total);
    console.log('   Escalated:           ', results.escalated);
    console.log('   No next approver:    ', results.noNextApprover);
    console.log('   Errors:             ', results.errors);
    if (results.details && results.details.length) {
      console.log('\n   Details:');
      results.details.forEach((d) => console.log('   ', d));
    }
    console.log('───────────────────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
