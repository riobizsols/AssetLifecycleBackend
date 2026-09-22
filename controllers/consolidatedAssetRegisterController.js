const consolidatedAssetRegisterModel = require('../models/consolidatedAssetRegisterModel');

function parseListParam(value) {
  return consolidatedAssetRegisterModel.parseList(value);
}

/**
 * This report is meant to consolidate across institutions in the tenant DB.
 * Header ACM picks one org at a time for the rest of the app — here we use the
 * user's full ACM org grants (or all orgs) as the access boundary, and let the
 * report Institution filter narrow further. Branch/dept narrowing is via UI filters.
 */
function buildFilters(req) {
  const q = req.query || {};
  let acmCtx;

  try {
    const { getEffectiveListContext, getRequestAcm } = require('../utils/acmAccess');
    const effective = getEffectiveListContext(req);
    const acm = getRequestAcm(req) || effective.acm || {};

    const grantedOrgIds = Array.isArray(acm.orgIds)
      ? acm.orgIds.map(String).filter(Boolean)
      : [];
    const allOrgs = Boolean(
      acm.allOrgs ||
        effective.hasSuperAccess ||
        req.user?.is_super_admin ||
        (!acm.hasAcm && (effective.hasSuperAccess || req.user?.hasSuperAccess)),
    );

    acmCtx = {
      // Do not pin to header-selected org — consolidation uses grants below
      orgId: null,
      branchId: null,
      deptId: null,
      branchIds: [],
      deptIds: [],
      allBranches: true,
      allDepts: true,
      hasSuperAccess: Boolean(effective.hasSuperAccess || req.user?.is_super_admin),
      hasSelection: false,
      acm: {
        ...acm,
        allOrgs: allOrgs || grantedOrgIds.length === 0,
        orgIds: grantedOrgIds,
        hasAcm: Boolean(acm.hasAcm),
      },
    };

    // If ACM grants exactly one org, keep that as the only allowed org
    if (!acmCtx.acm.allOrgs && grantedOrgIds.length === 1) {
      acmCtx.acm.orgIds = grantedOrgIds;
    }
  } catch {
    acmCtx = {
      orgId: null,
      branchIds: [],
      deptIds: [],
      allBranches: true,
      allDepts: true,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
      hasSelection: false,
      acm: {
        allOrgs: true,
        orgIds: [],
        hasAcm: false,
      },
    };
  }

  return {
    orgIds: parseListParam(q.orgIds || q.org_ids),
    branchIds: parseListParam(q.branchIds || q.branch_ids),
    deptIds: parseListParam(q.deptIds || q.dept_ids),
    statuses: parseListParam(q.statuses || q.status),
    assetTypeIds: parseListParam(q.assetTypeIds || q.asset_type_ids || q.assetTypes),
    search: q.search ? String(q.search).trim() : null,
    page: q.page,
    pageSize: q.pageSize || q.page_size,
    orgId: null,
    acmCtx,
  };
}

const getFilterOptions = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const data = await consolidatedAssetRegisterModel.getFilterOptions(filters);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[ConsolidatedAssetRegister] getFilterOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const getSummary = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const data = await consolidatedAssetRegisterModel.getSummary(filters);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[ConsolidatedAssetRegister] getSummary:', err);
    return res.status(500).json({ error: err.message || 'Failed to load consolidated summary' });
  }
};

const getRegister = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const data = await consolidatedAssetRegisterModel.getRegister(filters);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[ConsolidatedAssetRegister] getRegister:', err);
    return res.status(500).json({ error: err.message || 'Failed to load asset register' });
  }
};

const getRegisterExport = async (req, res) => {
  try {
    const filters = buildFilters(req);
    const data = await consolidatedAssetRegisterModel.getRegisterExport(filters, 5000);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[ConsolidatedAssetRegister] getRegisterExport:', err);
    return res.status(500).json({ error: err.message || 'Failed to export asset register' });
  }
};

module.exports = {
  getFilterOptions,
  getSummary,
  getRegister,
  getRegisterExport,
};
