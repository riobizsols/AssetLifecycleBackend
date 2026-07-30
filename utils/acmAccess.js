/**
 * Access Control Management (tblACM) — DATA access only.
 * Screen/menu access remains tblJobRoleNav (role-based).
 *
 * === ACM Context Manager (backend) ===
 * Single source of truth for the active working context on each request:
 *   - X-ACM-Org-Id / X-ACM-Branch-Id / X-ACM-Dept-Id headers (client selection)
 *   - OR deterministic default from first ACM row (resolveDefaultAcmSelection)
 * Controllers should use getEffectiveListContext(req) / overlaid req.user.org_id|branch_id|dept_id.
 * Never treat tblUsers home Organization/Branch/Department as the active runtime context.
 *
 * Header selection narrows the effective filter:
 *   - Org only → data for that org (ACM-allowed branches/depts)
 *   - Org + Branch → filter by branch
 *   - Org + Branch + Dept → filter by department
 */

const WILDCARD = '*';

function isWild(value) {
  return !value || String(value).trim() === WILDCARD || String(value).trim() === '';
}

function cleanId(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === WILDCARD || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return null;
  }
  return s;
}

function rowMatchesSelection(row, { orgId, branchId, deptId } = {}) {
  if (!row) return false;
  if (orgId && !isWild(row.org_id) && String(row.org_id) !== orgId) return false;
  if (branchId && !isWild(row.branch_id) && String(row.branch_id) !== branchId) return false;
  if (deptId && !isWild(row.dept_id) && String(row.dept_id) !== deptId) return false;
  return true;
}

function buildAcmScope(rows = [], legacyUser = {}) {
  const active = (rows || []).filter((r) => r && (r.int_status === 1 || r.int_status === undefined));

  if (active.length === 0) {
    const orgIds = legacyUser.org_id ? [legacyUser.org_id] : [];
    const branchIds = legacyUser.branch_id ? [legacyUser.branch_id] : [];
    const deptIds = legacyUser.dept_id ? [legacyUser.dept_id] : [];
    return {
      hasAcm: false,
      legacyFallback: true,
      rows: [],
      allOrgs: false,
      allBranches: false,
      allDepts: false,
      orgIds,
      branchIds,
      deptIds,
      canRead: Boolean(legacyUser.branch_id || legacyUser.org_id),
      canWrite: false,
      accessLevels: [],
      selection: null,
    };
  }

  const orgIds = new Set();
  const branchIds = new Set();
  const deptIds = new Set();
  let allOrgs = false;
  let allBranches = false;
  let allDepts = false;
  let canWrite = false;
  let canRead = false;
  const accessLevels = new Set();

  for (const row of active) {
    const level = String(row.access_level || '').trim();
    accessLevels.add(level);
    if (level === 'Write') canWrite = true;
    if (level === 'Read' || level === 'Write') canRead = true;

    if (isWild(row.org_id)) allOrgs = true;
    else orgIds.add(String(row.org_id).trim());

    if (isWild(row.branch_id)) allBranches = true;
    else branchIds.add(String(row.branch_id).trim());

    if (isWild(row.dept_id)) allDepts = true;
    else deptIds.add(String(row.dept_id).trim());
  }

  return {
    hasAcm: true,
    legacyFallback: false,
    rows: active,
    allOrgs,
    allBranches,
    allDepts,
    orgIds: allOrgs ? [] : [...orgIds],
    branchIds: allBranches ? [] : [...branchIds],
    deptIds: allDepts ? [] : [...deptIds],
    canRead,
    canWrite,
    accessLevels: [...accessLevels],
    selection: null,
  };
}

function resolveActiveAcmScope(baseAcm, selection = {}) {
  const orgId = cleanId(selection.orgId);
  const branchId = cleanId(selection.branchId);
  const deptId = cleanId(selection.deptId);

  if (!baseAcm) {
    return buildAcmScope([], {});
  }

  if (!orgId && !branchId && !deptId) {
    return { ...baseAcm, selection: { orgId: null, branchId: null, deptId: null } };
  }

  const rows = baseAcm.rows || [];
  const matching = rows.filter((row) => rowMatchesSelection(row, { orgId, branchId, deptId }));

  if (baseAcm.hasAcm && matching.length === 0) {
    return {
      hasAcm: true,
      legacyFallback: false,
      rows: [],
      allOrgs: false,
      allBranches: false,
      allDepts: false,
      orgIds: orgId ? [orgId] : [],
      branchIds: branchId ? [branchId] : [],
      deptIds: deptId ? [deptId] : [],
      canRead: false,
      canWrite: false,
      accessLevels: [],
      selection: { orgId, branchId, deptId },
    };
  }

  const fromRows = buildAcmScope(matching.length ? matching : rows, {});
  const result = {
    ...fromRows,
    selection: { orgId, branchId, deptId },
  };

  if (orgId) {
    result.allOrgs = false;
    result.orgIds = [orgId];
  }

  if (branchId) {
    result.allBranches = false;
    result.branchIds = [branchId];
  } else if (orgId) {
    result.allBranches = matching.some((r) => isWild(r.branch_id)) || fromRows.allBranches;
    if (result.allBranches) result.branchIds = [];
  }

  if (deptId) {
    result.allDepts = false;
    result.deptIds = [deptId];
  } else if (branchId || orgId) {
    result.allDepts = matching.some((r) => isWild(r.dept_id)) || fromRows.allDepts;
    if (result.allDepts) result.deptIds = [];
  }

  result.canWrite = matching.some((r) => String(r.access_level).trim() === 'Write');
  result.canRead = matching.some((r) => {
    const lvl = String(r.access_level).trim();
    return lvl === 'Read' || lvl === 'Write';
  });

  return result;
}

function getRequestAcm(req) {
  return req?.user?.acmFilter || req?.user?.acm || null;
}

/**
 * Deterministic default ACM working context for a user.
 * - Uses first ACM row ordered by acm_id (stable across logins)
 * - Wildcard org  → first active org (ORDER BY org_id)
 * - Wildcard branch/dept → left empty (org-wide / all depts) so selection stays stable
 */
async function resolveDefaultAcmSelection(acmRows = [], db = null) {
  const active = (acmRows || [])
    .filter((r) => r && (r.int_status === 1 || r.int_status === undefined))
    .slice()
    .sort((a, b) => String(a.acm_id || '').localeCompare(String(b.acm_id || '')));

  const first = active[0];
  if (!first) {
    return { orgId: null, branchId: null, deptId: null, acmId: null, accessLevel: null };
  }

  let orgId = isWild(first.org_id) ? null : String(first.org_id).trim();
  const branchId = isWild(first.branch_id) ? null : String(first.branch_id).trim();
  const deptId = isWild(first.dept_id) ? null : String(first.dept_id).trim();

  if (!orgId && db) {
    try {
      const r = await db.query(
        `SELECT org_id FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id ASC LIMIT 1`
      );
      orgId = r.rows[0]?.org_id || null;
    } catch (_) {
      orgId = null;
    }
  }

  // Specific branch with wild org: keep branch; ensure org from branch if needed
  if (!orgId && branchId && db) {
    try {
      const r = await db.query(
        `SELECT org_id FROM "tblBranches" WHERE branch_id = $1 LIMIT 1`,
        [branchId]
      );
      orgId = r.rows[0]?.org_id || null;
    } catch (_) {
      /* ignore */
    }
  }

  return {
    orgId,
    branchId,
    deptId,
    acmId: first.acm_id || null,
    accessLevel: first.access_level || null,
  };
}

function attachAcmFilterFromHeaders(req) {
  const {
    resolveActiveAcmScope: resolve,
    applyAcmSelectionToRequestUser,
    resolveDefaultAcmSelection: resolveDefault,
  } = module.exports;

  if (!req.user) return Promise.resolve();

  let orgId = cleanId(req.headers['x-acm-org-id']);
  let branchId = cleanId(req.headers['x-acm-branch-id']);
  let deptId = cleanId(req.headers['x-acm-dept-id']);

  const applySelection = (o, b, d) => {
    req.user.acmFilter = resolve(req.user.acm, { orgId: o, branchId: b, deptId: d });
    req.user.acmSelection = { orgId: o, branchId: b, deptId: d };
    return undefined;
  };

  const loadBranchCodeThenFinish = (o, b, d) => {
    applySelection(o, b, d);
    req.user.acmSelectionBranchCode = null;

    const finish = () => {
      applyAcmSelectionToRequestUser(req);
      return undefined;
    };

    if (!b || !req.db) {
      finish();
      return Promise.resolve();
    }

    return req.db
      .query(`SELECT branch_code FROM "tblBranches" WHERE branch_id = $1 LIMIT 1`, [b])
      .then((r) => {
        req.user.acmSelectionBranchCode = r.rows[0]?.branch_code || null;
        finish();
      })
      .catch(() => {
        req.user.acmSelectionBranchCode = null;
        finish();
      });
  };

  // No client selection → deterministic default from first ACM row
  if (!orgId && !branchId && !deptId && req.user?.acm?.rows?.length) {
    return Promise.resolve(resolveDefault(req.user.acm.rows, req.db)).then((def) => {
      req.user.acmDefaultSelection = def;
      return loadBranchCodeThenFinish(def.orgId, def.branchId, def.deptId);
    });
  }

  return loadBranchCodeThenFinish(orgId, branchId, deptId);
}

/**
 * Overlay saved ACM header selection onto req.user so ALL controllers that
 * read req.user.org_id / branch_id / hasSuperAccess automatically respect ACM.
 * Must run on a per-request clone of req.user (never mutate the auth cache object).
 */
function applyAcmSelectionToRequestUser(req) {
  if (!req?.user) return;
  const selection = req.user.acmSelection || {};
  const selOrg = cleanId(selection.orgId);
  const selBranch = cleanId(selection.branchId);
  const selDept = cleanId(selection.deptId);
  if (!selOrg && !selBranch && !selDept) return;

  // Preserve originals for debugging / rare callers
  if (req.user._acmOriginalScope == null) {
    req.user._acmOriginalScope = {
      org_id: req.user.org_id || null,
      branch_id: req.user.branch_id || null,
      branch_code: req.user.branch_code || null,
      dept_id: req.user.dept_id || null,
      hasSuperAccess: Boolean(req.user.hasSuperAccess),
    };
  }

  if (selOrg) {
    req.user.org_id = selOrg;
  }

  if (selBranch) {
    req.user.branch_id = selBranch;
    req.user.branch_code = req.user.acmSelectionBranchCode || req.user.branch_code || null;
    req.user.hasSuperAccess = false;
  } else if (selOrg) {
    // Org-only ACM selection → all branches in that org
    req.user.branch_id = null;
    req.user.branch_code = null;
    req.user.hasSuperAccess = true;
  }

  if (selDept) {
    req.user.dept_id = selDept;
  }
}

/**
 * Effective org/branch/dept + super-access for list APIs.
 * Header ACM selection (X-ACM-*) overrides the user's login org/branch so
 * screens filter to the saved context picker values.
 */
function getEffectiveListContext(req) {
  const selection = req.user?.acmSelection || {};
  const selOrg = cleanId(selection.orgId);
  const selBranch = cleanId(selection.branchId);
  const selDept = cleanId(selection.deptId);
  const hasSelection = Boolean(selOrg || selBranch || selDept);
  const acm = getRequestAcm(req);

  if (hasSelection) {
    // Org-only → all branches in that org; org+branch → lock to branch
    const hasSuperAccess = !selBranch;
    return {
      orgId: selOrg || req.user?.org_id || null,
      branchId: selBranch || null,
      deptId: selDept || null,
      hasSuperAccess,
      hasSelection: true,
      acm,
    };
  }

  return {
    orgId: req.user?.org_id || null,
    branchId: req.user?.branch_id || null,
    deptId: req.user?.dept_id || null,
    hasSuperAccess: Boolean(req.user?.hasSuperAccess),
    hasSelection: false,
    acm,
  };
}

function applyAcmSqlFilters(acm, cols = {}, startIndex = 1) {
  if (!acm) {
    return { sql: '', params: [], nextIndex: startIndex };
  }

  // Header selection always wins over ACM wildcards for SQL list filters
  const sel = acm.selection || {};
  const effective = { ...acm };
  if (sel.orgId) {
    effective.allOrgs = false;
    effective.orgIds = [String(sel.orgId)];
  }
  if (sel.branchId) {
    effective.allBranches = false;
    effective.branchIds = [String(sel.branchId)];
  }
  if (sel.deptId) {
    effective.allDepts = false;
    effective.deptIds = [String(sel.deptId)];
  }

  if (effective.allOrgs && effective.allBranches && effective.allDepts) {
    return { sql: '', params: [], nextIndex: startIndex };
  }

  const parts = [];
  const params = [];
  let i = startIndex;

  if (cols.org && !effective.allOrgs) {
    if (!effective.orgIds.length) parts.push('1=0');
    else {
      parts.push(`${cols.org} = ANY($${i}::text[])`);
      params.push(effective.orgIds);
      i += 1;
    }
  }

  if (cols.branch && !effective.allBranches) {
    if (!effective.branchIds.length) parts.push('1=0');
    else {
      parts.push(`${cols.branch} = ANY($${i}::text[])`);
      params.push(effective.branchIds);
      i += 1;
    }
  }

  if (cols.dept && !effective.allDepts) {
    if (!effective.deptIds.length) parts.push('1=0');
    else {
      parts.push(`${cols.dept} = ANY($${i}::text[])`);
      params.push(effective.deptIds);
      i += 1;
    }
  }

  return {
    sql: parts.length ? ` AND ${parts.join(' AND ')}` : '',
    params,
    nextIndex: i,
  };
}

function isResourceInAcmScope(acm, { org_id, branch_id, dept_id } = {}) {
  if (!acm) return false;
  if (!acm.canRead && !acm.canWrite) return false;
  if (acm.allOrgs && acm.allBranches && acm.allDepts) return true;

  if (org_id != null && !acm.allOrgs) {
    if (!acm.orgIds.includes(String(org_id))) return false;
  }
  if (branch_id != null && !acm.allBranches) {
    if (!acm.branchIds.includes(String(branch_id))) return false;
  }
  if (dept_id != null && !acm.allDepts) {
    if (!acm.deptIds.includes(String(dept_id))) return false;
  }
  return true;
}

function requireAcmWrite(req, res, next) {
  const acm = getRequestAcm(req);
  if (acm?.canWrite) return next();
  return res.status(403).json({
    error: 'Access denied',
    message: 'Write access is not granted in Access Control Management (tblACM) for the current selection',
  });
}

function filterRowsByAcm(rows, acm, mapFn) {
  if (!Array.isArray(rows)) return [];
  if (!acm) return [];
  if (acm.allOrgs && acm.allBranches && acm.allDepts) return rows;
  return rows.filter((row) => isResourceInAcmScope(acm, mapFn(row)));
}

module.exports = {
  WILDCARD,
  isWild,
  cleanId,
  rowMatchesSelection,
  buildAcmScope,
  resolveActiveAcmScope,
  resolveDefaultAcmSelection,
  getRequestAcm,
  attachAcmFilterFromHeaders,
  applyAcmSelectionToRequestUser,
  getEffectiveListContext,
  applyAcmSqlFilters,
  isResourceInAcmScope,
  requireAcmWrite,
  filterRowsByAcm,
};
