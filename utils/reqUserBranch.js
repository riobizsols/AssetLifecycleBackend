/** Branch context from auth middleware — avoids redundant getUserWithBranch + tblBranches queries. */

function branchCodeFromReq(req) {
  if (req.user?.hasSuperAccess) return null;
  return req.user?.branch_code || null;
}

function branchIdFromReq(req) {
  return req.user?.branch_id || null;
}

module.exports = {
  branchCodeFromReq,
  branchIdFromReq,
};
