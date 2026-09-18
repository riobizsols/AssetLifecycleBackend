#!/usr/bin/env node
/**
 * Regression: org-level ACM with full-org access must list maintenance approvals.
 *
 * Reproduces the former bug where org view (no branch_id) filtered to
 * `a.branch_id IS NULL` only → 0 rows on tenants where every asset has a branch.
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/test-org-view-maintenance-approvals.js
 * Optional: TENANT_DB=ngp_db EMP_INT_ID=EMP_INT_0035 ORG_ID=ORG003 JOB_ROLE_ID=JR002
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dbContext = require('../utils/dbContext');
const { getMaintenanceApprovals } = require('../models/approvalDetailModel');
const { evaluateApprovalBranchAccess } = require('../utils/approvalBranchAccess');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const EMP = process.env.EMP_INT_ID || 'EMP_INT_0035';
const ORG = process.env.ORG_ID || 'ORG003';
const ROLE = process.env.JOB_ROLE_ID || 'JR002';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('TENANT_DATABASE_URL or DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function withPool(pool, fn) {
  if (typeof dbContext.runWithDb === 'function') return dbContext.runWithDb(pool, fn);
  if (dbContext.als?.run) return dbContext.als.run({ db: pool, pool }, fn);
  const orig = dbContext.getDbFromContext;
  dbContext.getDbFromContext = () => pool;
  try {
    return await fn();
  } finally {
    dbContext.getDbFromContext = orig;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const modelPath = path.join(__dirname, '..', 'models', 'approvalDetailModel.js');
  const src = fs.readFileSync(modelPath, 'utf8');
  assert(
    !src.includes('else if (!hasSuperAccess && !userBranchId)'),
    'Deadly null-only branch fallback was reintroduced in approvalDetailModel.js',
  );

  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false, max: 3 });
  let failed = 0;

  try {
    await withPool(pool, async () => {
      const orgFull = await getMaintenanceApprovals(EMP, ORG, null, true, ROLE, null, []);
      console.log(`org full access: ${orgFull.length}`);
      assert(orgFull.length > 0, 'Org-level full access returned 0 approvals');

      const br001 = await getMaintenanceApprovals(EMP, ORG, 'BR001', false, ROLE, 'BR001', []);
      console.log(`branch BR001: ${br001.length}`);
      assert(br001.length > 0, 'Branch BR001 returned 0 approvals');
      assert(br001.length <= orgFull.length, 'Branch count should not exceed org-full count');

      const multi = await getMaintenanceApprovals(EMP, ORG, null, false, ROLE, null, ['BR001', 'BR005']);
      console.log(`multi-branch grants BR001+BR005: ${multi.length}`);
      assert(multi.length > 0, 'Multi-branch org view returned 0');

      // Old bug path: not super, no branch id, no grants → must NOT force empty via null-only filter
      const noBranchNoSuper = await getMaintenanceApprovals(EMP, ORG, null, false, ROLE, null, []);
      console.log(`no-branch no-super (no null-only filter): ${noBranchNoSuper.length}`);
      assert(noBranchNoSuper.length > 0, 'Regression: null-only branch filter emptied org view again');

      const oldNullOnly = await pool.query(`
        SELECT COUNT(DISTINCT wfh.wfamsh_id)::int AS c
        FROM "tblWFAssetMaintSch_H" wfh
        JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
        JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        WHERE wfd.org_id = $1 AND a.org_id = $1
          AND (a.branch_id IS NULL OR BTRIM(a.branch_id) = '')
          AND wfd.job_role_id = $2 AND wfd.status = 'AP'
          AND wfh.status IN ('IN', 'IP') AND COALESCE(wfh.maint_type_id, '') != 'MT005'
      `, [ORG, ROLE]);
      console.log(`SQL null-only asset branches pending: ${oldNullOnly.rows[0].c}`);
    });

    const detailOrgWide = evaluateApprovalBranchAccess({
      isSystemAdmin: false,
      userBranchId: 'BR001',
      assetBranchId: 'BR005',
      acmAllBranches: true,
    });
    assert(detailOrgWide.canAct === true, 'Detail: org-wide ACM should allow act on other branch asset');

    const detailCross = evaluateApprovalBranchAccess({
      isSystemAdmin: false,
      userBranchId: 'BR001',
      assetBranchId: 'BR005',
      acmAllBranches: false,
      acmBranchIds: ['BR001'],
    });
    assert(detailCross.canAct === false, 'Detail: limited ACM should deny other branch');

    console.log('\nALL CHECKS PASSED');
  } catch (err) {
    failed = 1;
    console.error('\nFAILED:', err.message);
  } finally {
    await pool.end().catch(() => {});
  }

  process.exit(failed);
}

main();
