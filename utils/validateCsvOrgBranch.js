const orgModel = require('../models/orgModel');
const branchModel = require('../models/branchModel');

/**
 * org_id / branch_id must exist when provided.
 * orgRequired / branchRequired control whether a blank value is allowed.
 */
const validateCsvOrgBranch = async ({
  orgId,
  branchId,
  orgRequired = true,
  branchRequired = false,
}) => {
  const trimmedOrg = orgId ? String(orgId).trim() : '';
  const trimmedBranch = branchId ? String(branchId).trim() : '';

  if (!trimmedOrg) {
    if (orgRequired) {
      throw new Error('org_id is required and must be an existing organization');
    }
  } else {
    const org = await orgModel.getOrganizationById(trimmedOrg);
    if (!org) {
      throw new Error(`org_id '${trimmedOrg}' does not exist`);
    }
  }

  if (!trimmedBranch) {
    if (branchRequired) {
      throw new Error('branch_id is required and must be an existing branch');
    }
    return { orgId: trimmedOrg || null, branchId: null };
  }

  const branch = await branchModel.getBranchById(trimmedBranch);
  if (!branch) {
    throw new Error(`branch_id '${trimmedBranch}' does not exist`);
  }
  if (trimmedOrg && branch.org_id && branch.org_id !== trimmedOrg) {
    throw new Error(
      `branch_id '${trimmedBranch}' does not belong to org_id '${trimmedOrg}'`
    );
  }

  return { orgId: trimmedOrg || null, branchId: trimmedBranch };
};

module.exports = { validateCsvOrgBranch };
