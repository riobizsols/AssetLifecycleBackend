#!/usr/bin/env node
/**
 * Branch-wise maintenance notification test (demopressana_db).
 *
 * Scenario:
 *   Desktop (AT001) workflow step 1 → JR001 System Administrator.
 *   ASS001 is BR001 (Ramanathapuram). ASS002 is BR002 (Pollachi).
 *   Expected: trigger for ASS001 notifies only BR001 JR001 users.
 *             trigger for ASS002 notifies only BR002 JR001 users.
 *
 * Usage (from pressana/AssetLifecycleBackend):
 *   node tests/test-branch-wise-maintenance-notifications.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../config/db');
const fcmService = require('../services/fcmService');
const workflowNotificationService = require('../services/workflowNotificationService');

const ORG_ID = 'ORG001';
const ROLE_ID = 'JR001';
const CASES = [
  {
    name: 'BR001 Ramanathapuram Desktop ASS001',
    assetId: 'ASS001',
    wfamshId: 'WFAMSH_01',
    wfamsdId: 'WFAMSD_01',
    expectedBranchId: 'BR001',
  },
  {
    name: 'BR002 Pollachi Desktop ASS002',
    assetId: 'ASS002',
    wfamshId: 'WFAMSH_03',
    wfamsdId: 'WFAMSD_03',
    expectedBranchId: 'BR002',
  },
];

const extraRole = { user_id: 'USR004', job_role_id: ROLE_ID };
let extraRoleInserted = false;
const notifiedByCase = {};

function assert(condition, message) {
  if (!condition) {
    const err = new Error(message);
    err.failedAssertion = true;
    throw err;
  }
}

async function expectedRecipients(branchId, jobRoleId) {
  const result = await db.query(
    `
      SELECT DISTINCT u.user_id, u.full_name, u.branch_id
      FROM "tblUserJobRoles" ujr
      INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
      LEFT JOIN "tblEmployees" e ON u.emp_int_id = e.emp_int_id
      WHERE ujr.job_role_id = $1
        AND u.int_status = 1
        AND COALESCE(NULLIF(BTRIM(u.branch_id), ''), NULLIF(BTRIM(e.branch_id), '')) = $2
      ORDER BY u.user_id
    `,
    [jobRoleId, branchId]
  );
  return result.rows;
}

async function allRoleUsers(jobRoleId) {
  const result = await db.query(
    `
      SELECT DISTINCT u.user_id, u.full_name, u.branch_id
      FROM "tblUserJobRoles" ujr
      INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
      WHERE ujr.job_role_id = $1 AND u.int_status = 1
      ORDER BY u.user_id
    `,
    [jobRoleId]
  );
  return result.rows;
}

async function loadCaseFacts() {
  const facts = [];
  for (const testCase of CASES) {
    const asset = await db.query(
      `
        SELECT a.asset_id, a.text AS asset_name, a.branch_id, b.text AS branch_name,
               a.asset_type_id, at.text AS asset_type
        FROM "tblAssets" a
        LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
        LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        WHERE a.asset_id = $1
      `,
      [testCase.assetId]
    );
    assert(asset.rows.length === 1, `Asset ${testCase.assetId} not found`);
    const row = asset.rows[0];
    assert(
      row.branch_id === testCase.expectedBranchId,
      `${testCase.assetId} expected branch ${testCase.expectedBranchId}, got ${row.branch_id}`
    );

    const seq = await db.query(
      `
        SELECT wfas.wf_steps_id, wjr.job_role_id, jr.text AS job_role
        FROM "tblWFATSeqs" wfas
        JOIN "tblWFJobRole" wjr ON wjr.wf_steps_id = wfas.wf_steps_id
        JOIN "tblJobRoles" jr ON jr.job_role_id = wjr.job_role_id
        WHERE wfas.asset_type_id = $1 AND wfas.seqs_no::text = '1'
      `,
      [row.asset_type_id]
    );
    assert(seq.rows.length > 0, `No workflow job role for ${row.asset_type_id}`);
    assert(
      seq.rows[0].job_role_id === ROLE_ID,
      `Expected first step role ${ROLE_ID}, got ${seq.rows[0].job_role_id}`
    );

    facts.push({
      ...testCase,
      asset: row,
      jobRoleId: seq.rows[0].job_role_id,
      jobRole: seq.rows[0].job_role,
    });
  }
  return facts;
}

async function ensurePollachiHasSameRole() {
  const existing = await db.query(
    `SELECT 1 FROM "tblUserJobRoles" WHERE user_id = $1 AND job_role_id = $2`,
    [extraRole.user_id, extraRole.job_role_id]
  );
  if (existing.rows.length) return;

  const idRow = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(user_job_role_id FROM 4) AS INTEGER)), 0) + 1 AS n
     FROM "tblUserJobRoles" WHERE user_job_role_id ~ '^UJR[0-9]+$'`
  );
  let ujrId = `UJR${String(idRow.rows[0].n).padStart(3, '0')}`;
  try {
    await db.query(
      `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
       VALUES ($1, $2, $3)`,
      [ujrId, extraRole.user_id, extraRole.job_role_id]
    );
  } catch (error) {
    ujrId = `UJR${Date.now().toString().slice(-6)}`;
    await db.query(
      `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
       VALUES ($1, $2, $3)`,
      [ujrId, extraRole.user_id, extraRole.job_role_id]
    );
  }
  extraRoleInserted = true;
  extraRole.ujr_id = ujrId;
}

async function cleanupExtraRole() {
  if (!extraRoleInserted) return;
  await db.query(
    `DELETE FROM "tblUserJobRoles" WHERE user_id = $1 AND job_role_id = $2 AND user_job_role_id = $3`,
    [extraRole.user_id, extraRole.job_role_id, extraRole.ujr_id]
  );
}

function installNotificationCapture() {
  const original = fcmService.sendNotificationToUser.bind(fcmService);
  fcmService.sendNotificationToUser = async (notificationData) => {
    const key = notificationData.data?.asset_id || '_unknown';
    if (!notifiedByCase[key]) notifiedByCase[key] = [];
    notifiedByCase[key].push(notificationData.userId);
    return { success: true, captured: true, userId: notificationData.userId };
  };
  return () => {
    fcmService.sendNotificationToUser = original;
  };
}

function sameUsers(actualIds, expectedRows) {
  const actual = [...new Set(actualIds)].sort();
  const expected = expectedRows.map((r) => r.user_id).sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function main() {
  const failures = [];
  console.log('\n=== Branch-wise maintenance notification test ===');
  console.log('DB:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  console.log('Time:', new Date().toISOString());

  const restoreNotify = installNotificationCapture();

  try {
    const facts = await loadCaseFacts();
    await ensurePollachiHasSameRole();

    const allJr001 = await allRoleUsers(ROLE_ID);
    console.log('\nJR001 users after test setup:');
    allJr001.forEach((u) => {
      console.log(`  ${u.user_id}  ${u.full_name}  branch=${u.branch_id}`);
    });
    assert(
      allJr001.some((u) => u.branch_id === 'BR001') &&
        allJr001.some((u) => u.branch_id === 'BR002'),
      'Need JR001 users in both BR001 and BR002 to prove branch filtering'
    );

    console.log('\n--- Expected routing ---');
    for (const fact of facts) {
      const expected = await expectedRecipients(fact.expectedBranchId, fact.jobRoleId);
      console.log(
        `\n${fact.name}\n  asset=${fact.asset.asset_id} (${fact.asset.asset_name})\n  branch=${fact.asset.branch_id} ${fact.asset.branch_name}\n  first approval role=${fact.jobRoleId} ${fact.jobRole}`
      );
      expected.forEach((u) => {
        console.log(`  SHOULD notify: ${u.user_id} ${u.full_name}`);
      });
      const leak = allJr001.filter(
        (u) => u.branch_id !== fact.expectedBranchId
      );
      leak.forEach((u) => {
        console.log(`  MUST NOT notify: ${u.user_id} ${u.full_name} (${u.branch_id})`);
      });
      fact.expected = expected;
      fact.mustNot = leak;
    }

    console.log('\n--- Triggering notifications (captured, no live FCM) ---');
    for (const fact of facts) {
      notifiedByCase[fact.assetId] = [];
      const result = await workflowNotificationService.notifyNewWorkflowDetail({
        wfamsd_id: fact.wfamsdId,
        wfamsh_id: fact.wfamshId,
        job_role_id: fact.jobRoleId,
        status: 'AP',
        sequence: 1,
        org_id: ORG_ID,
      });
      const actual = notifiedByCase[fact.assetId] || [];
      console.log(
        `\nTriggered ${fact.assetId}: success=${result.success} totalUsers=${result.totalUsers} captured=${actual.join(',') || '(none)'}`
      );

      if (!sameUsers(actual, fact.expected)) {
        failures.push(
          `${fact.assetId}: expected [${fact.expected.map((r) => r.user_id).join(', ')}] got [${actual.join(', ')}]`
        );
      }
      const leaked = actual.filter((id) => fact.mustNot.some((u) => u.user_id === id));
      if (leaked.length) {
        failures.push(`${fact.assetId}: leaked to other branch users ${leaked.join(', ')}`);
      }
    }

    console.log('\n--- Unfiltered role send still reaches every JR001 (control) ---');
    notifiedByCase._unknown = [];
    const unfiltered = await fcmService.sendNotificationToRole({
      jobRoleId: ROLE_ID,
      title: 'Control',
      body: 'No branch filter',
      data: {},
      notificationType: 'workflow_approval',
    });
    const unfilteredIds = (unfiltered.results || []).map((r) => r.userId).sort();
    const allIds = allJr001.map((u) => u.user_id).sort();
    console.log(`  unfiltered recipients: ${unfilteredIds.join(', ')}`);
    if (JSON.stringify(unfilteredIds) !== JSON.stringify(allIds)) {
      failures.push(
        `control unfiltered send expected [${allIds.join(', ')}] got [${unfilteredIds.join(', ')}]`
      );
    }

    console.log('\n=== RESULT ===');
    if (failures.length) {
      failures.forEach((f) => console.error('FAIL:', f));
      throw new Error(`${failures.length} assertion(s) failed`);
    }
    console.log('PASS: maintenance notifications are branch-wise for JR001.');
    console.log('  ASS001 (BR001) → Ramanathapuram JR001 only');
    console.log('  ASS002 (BR002) → Pollachi JR001 only');
  } finally {
    restoreNotify();
    await cleanupExtraRole();
    if (typeof db.end === 'function') {
      try {
        await db.end();
      } catch (_) {
        /* ignore */
      }
    }
    if (typeof db.shutdownPool === 'function') {
      try {
        await db.shutdownPool();
      } catch (_) {
        /* ignore */
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nTEST FAILED:', error.message);
    process.exit(1);
  });
