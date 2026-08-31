/** Branch context from auth middleware — avoids redundant getUserWithBranch + tblBranches queries. */

function branchCodeFromReq(req) {
  if (req.user?.hasSuperAccess || req.user?.acmAllBranches) return null;
  const sel = req.user?.acmSelection || {};
  if (sel.branchId) {
    return req.user?.acmSelectionBranchCode || req.user?.branch_code || null;
  }
  // Org-only (or default ACM): use overlaid branch_code when locked to a single grant
  return req.user?.branch_code || null;
}

function branchIdFromReq(req) {
  if (req.user?.hasSuperAccess || req.user?.acmAllBranches) return null;
  const sel = req.user?.acmSelection || {};
  if (sel.branchId) return sel.branchId;
  // Org-only: prefer ACM overlay (single granted branch) on req.user.branch_id
  return req.user?.branch_id || null;
}

module.exports = {
  branchCodeFromReq,
  branchIdFromReq,
};
