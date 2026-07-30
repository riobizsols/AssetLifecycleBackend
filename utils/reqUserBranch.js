/** Branch context from auth middleware — avoids redundant getUserWithBranch + tblBranches queries. */

function branchCodeFromReq(req) {
  const sel = req.user?.acmSelection || {};
  if (sel.orgId || sel.branchId || sel.deptId) {
    // Org-only ACM selection → all branches in that org
    if (!sel.branchId) return null;
    return req.user?.acmSelectionBranchCode || req.user?.branch_code || null;
  }
  if (req.user?.hasSuperAccess) return null;
  return req.user?.branch_code || null;
}

function branchIdFromReq(req) {
  const sel = req.user?.acmSelection || {};
  if (sel.branchId) return sel.branchId;
  if (sel.orgId && !sel.branchId) return null;
  return req.user?.branch_id || null;
}

module.exports = {
  branchCodeFromReq,
  branchIdFromReq,
};
