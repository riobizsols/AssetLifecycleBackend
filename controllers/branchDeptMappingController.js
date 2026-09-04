const model = require('../models/branchDeptMappingModel');
const operationalCache = require('../utils/operationalCache');
const { isResourceInAcmScope, getRequestAcm } = require('../utils/acmAccess');
const { ensureBrDeptSchema } = require('../utils/ensureBrDeptSchema');
const { getDbFromContext } = require('../utils/dbContext');

const listMappings = async (req, res) => {
  try {
    await ensureBrDeptSchema(getDbFromContext());
    const orgId = req.query.orgId || null;
    const branchId = req.query.branchId || null;
    const rows = await model.listMappings({ orgId, branchId });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error listing branch-dept mappings:', err);
    res.status(500).json({ success: false, message: 'Failed to list branch-department mappings' });
  }
};

const createMapping = async (req, res) => {
  try {
    await ensureBrDeptSchema(getDbFromContext());
    const acm = getRequestAcm(req);
    if (acm && acm.canWrite === false) {
      return res.status(403).json({
        success: false,
        message: 'Write access is not granted in Access Control Management (tblACM)',
      });
    }

    const { branch_id, dept_id } = req.body || {};
    if (!branch_id || !dept_id) {
      return res.status(400).json({
        success: false,
        message: 'branch_id and dept_id are required',
      });
    }

    const branch = await model.getBranch(branch_id);
    if (!branch || branch.int_status === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive branch' });
    }

    const dept = await model.getDepartment(dept_id);
    if (!dept || dept.int_status === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive department' });
    }

    if (branch.org_id && dept.org_id && branch.org_id !== dept.org_id) {
      return res.status(400).json({
        success: false,
        message: 'Branch and department must belong to the same organization',
      });
    }

    const org_id = branch.org_id || dept.org_id || req.user?.org_id;
    if (acm && !isResourceInAcmScope(acm, { org_id, branch_id, dept_id })) {
      return res.status(403).json({
        success: false,
        message: 'Selected branch/department is outside your ACM data scope',
      });
    }

    const mapping = await model.createMapping({
      branch_id,
      dept_id,
      org_id,
      created_by: req.user?.user_id || null,
    });

    if (org_id) operationalCache.invalidateOrgCaches(org_id).catch(() => {});

    res.status(201).json({
      success: true,
      data: mapping,
      message: 'Branch-department mapping saved',
    });
  } catch (err) {
    console.error('Error creating branch-dept mapping:', err);
    res.status(500).json({ success: false, message: 'Failed to create branch-department mapping' });
  }
};

const deleteMapping = async (req, res) => {
  try {
    await ensureBrDeptSchema(getDbFromContext());
    const acm = getRequestAcm(req);
    if (acm && acm.canWrite === false) {
      return res.status(403).json({
        success: false,
        message: 'Write access is not granted in Access Control Management (tblACM)',
      });
    }

    const branch_id = req.query.branch_id || req.body?.branch_id;
    const dept_id = req.query.dept_id || req.body?.dept_id;
    if (!branch_id || !dept_id) {
      return res.status(400).json({
        success: false,
        message: 'branch_id and dept_id are required',
      });
    }

    const branch = await model.getBranch(branch_id);
    const org_id = branch?.org_id || req.user?.org_id;
    if (acm && branch && !isResourceInAcmScope(acm, { org_id, branch_id, dept_id })) {
      return res.status(403).json({
        success: false,
        message: 'Selected branch/department is outside your ACM data scope',
      });
    }

    const deleted = await model.deleteMapping({ branch_id, dept_id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Mapping not found' });
    }

    if (org_id) operationalCache.invalidateOrgCaches(org_id).catch(() => {});

    res.json({ success: true, message: 'Branch-department mapping removed' });
  } catch (err) {
    console.error('Error deleting branch-dept mapping:', err);
    res.status(500).json({ success: false, message: 'Failed to delete branch-department mapping' });
  }
};

module.exports = {
  listMappings,
  createMapping,
  deleteMapping,
};
