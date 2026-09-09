const { getDbFromContext } = require('./dbContext');
const { userHasSystemAdminRole } = require('./systemAdmin');

const CROSS_BRANCH_VIEW_ONLY_MESSAGE =
  'This approval belongs to another branch. You can view it but cannot approve or reject it.';

function evaluateApprovalBranchAccess({ isSystemAdmin, userBranchId, assetBranchId }) {
  if (isSystemAdmin) {
    return { canAct: true, viewOnly: false, reason: 'system_admin' };
  }

  const assetBranch = String(assetBranchId || '').trim();
  if (!assetBranch) {
    return { canAct: true, viewOnly: false, reason: 'no_asset_branch' };
  }

  const userBranch = String(userBranchId || '').trim();
  if (!userBranch || userBranch !== assetBranch) {
    return { canAct: false, viewOnly: true, reason: 'cross_branch' };
  }

  return { canAct: true, viewOnly: false, reason: 'same_branch' };
}

async function resolveUserBranchId(userId, db = getDbFromContext()) {
  if (!userId) return null;
  const result = await db.query(
    `
      SELECT COALESCE(NULLIF(BTRIM(u.branch_id), ''), NULLIF(BTRIM(e.branch_id), '')) AS branch_id
      FROM "tblUsers" u
      LEFT JOIN "tblEmployees" e ON e.emp_int_id = u.emp_int_id
      WHERE u.user_id = $1
         OR LEFT(u.user_id, 20) = LEFT($1::varchar, 20)
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0]?.branch_id || null;
}

async function getAssetBranchId(assetId, db = getDbFromContext()) {
  if (!assetId) return null;
  const result = await db.query(
    `SELECT branch_id FROM "tblAssets" WHERE asset_id = $1 LIMIT 1`,
    [assetId]
  );
  return result.rows[0]?.branch_id || null;
}

async function getMaintenanceAssetBranchId(assetOrWfamshId, db = getDbFromContext()) {
  if (!assetOrWfamshId) return null;
  if (String(assetOrWfamshId).startsWith('WFAMSH_')) {
    const result = await db.query(
      `
        SELECT a.branch_id
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON a.asset_id = wfh.asset_id
        WHERE wfh.wfamsh_id = $1
        LIMIT 1
      `,
      [assetOrWfamshId]
    );
    return result.rows[0]?.branch_id || null;
  }
  return getAssetBranchId(assetOrWfamshId, db);
}

async function getInspectionAssetBranchId(wfaiishId, db = getDbFromContext()) {
  if (!wfaiishId) return null;
  const result = await db.query(
    `
      SELECT a.branch_id
      FROM "tblWFAATInspSch_H" h
      INNER JOIN "tblAssets" a ON a.asset_id = h.asset_id
      WHERE h.wfaiish_id = $1
      LIMIT 1
    `,
    [wfaiishId]
  );
  return result.rows[0]?.branch_id || null;
}

async function getScrapAssetBranchId(wfscrapHId, db = getDbFromContext()) {
  if (!wfscrapHId) return null;
  const result = await db.query(
    `
      SELECT a.branch_id
      FROM "tblWFScrap_H" wh
      LEFT JOIN "tblAssetScrap" s ON s.asset_group_id = wh.assetgroup_id
      LEFT JOIN "tblAssetGroup_D" gd ON gd.assetgroup_h_id = wh.assetgroup_id
      INNER JOIN "tblAssets" a ON a.asset_id = COALESCE(s.asset_id, gd.asset_id)
      WHERE wh.id_d = $1
        AND a.branch_id IS NOT NULL
        AND BTRIM(a.branch_id) <> ''
      LIMIT 1
    `,
    [wfscrapHId]
  );
  return result.rows[0]?.branch_id || null;
}

async function getApprovalBranchAccessForUser(user, assetBranchId, db = getDbFromContext()) {
  const isSystemAdmin = userHasSystemAdminRole(user);
  let userBranchId = user?.branch_id || null;
  if (!userBranchId && user?.user_id) {
    userBranchId = await resolveUserBranchId(user.user_id, db);
  }
  const access = evaluateApprovalBranchAccess({
    isSystemAdmin,
    userBranchId,
    assetBranchId,
  });
  return {
    ...access,
    isSystemAdmin,
    userBranchId: userBranchId || null,
    assetBranchId: assetBranchId || null,
  };
}

function attachBranchAccess(payload, access) {
  return {
    ...payload,
    canAct: access.canAct,
    viewOnly: access.viewOnly,
    branchAccess: {
      canAct: access.canAct,
      viewOnly: access.viewOnly,
      reason: access.reason,
      isSystemAdmin: access.isSystemAdmin,
      userBranchId: access.userBranchId,
      assetBranchId: access.assetBranchId,
    },
  };
}

function crossBranchForbiddenBody() {
  return {
    success: false,
    viewOnly: true,
    message: CROSS_BRANCH_VIEW_ONLY_MESSAGE,
  };
}

module.exports = {
  CROSS_BRANCH_VIEW_ONLY_MESSAGE,
  evaluateApprovalBranchAccess,
  resolveUserBranchId,
  getAssetBranchId,
  getMaintenanceAssetBranchId,
  getInspectionAssetBranchId,
  getScrapAssetBranchId,
  getApprovalBranchAccessForUser,
  attachBranchAccess,
  crossBranchForbiddenBody,
};
