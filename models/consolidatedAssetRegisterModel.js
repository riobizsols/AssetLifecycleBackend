/**
 * Consolidated Asset Register — KPIs, org/campus/dept/asset-type distribution,
 * and paginated register (no custodian).
 */
const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

const ACQUISITION_SQL = `COALESCE(CAST(a.purchased_cost AS NUMERIC), 0)`;
const DEPRECIATION_SQL = `COALESCE(CAST(a.accumulated_depreciation AS NUMERIC), 0)`;
const BOOK_VALUE_SQL = `
  COALESCE(
    CAST(a.current_book_value AS NUMERIC),
    CAST(a.purchased_cost AS NUMERIC) - COALESCE(CAST(a.accumulated_depreciation AS NUMERIC), 0),
    CAST(a.purchased_cost AS NUMERIC),
    0
  )
`;

const DEPT_NAME_SQL = `
  COALESCE(NULLIF(TRIM(d_assign.text), ''), NULLIF(TRIM(d_asset.text), ''), 'Unassigned')
`;

const ASSET_TYPE_NAME_SQL = `
  COALESCE(NULLIF(TRIM(at.text), ''), NULLIF(TRIM(a.asset_type_id), ''), 'Unassigned')
`;

const BASE_JOINS = `
  FROM "tblAssets" a
  LEFT JOIN "tblOrgs" o ON o.org_id = a.org_id
  LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
  LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
  LEFT JOIN "tblDepartments" d_asset ON d_asset.dept_id = a.dept_id
  LEFT JOIN "tblAssetAssignments" aa
    ON aa.asset_id = a.asset_id
   AND aa.action = 'A'
   AND aa.latest_assignment_flag = true
  LEFT JOIN "tblDepartments" d_assign ON d_assign.dept_id = aa.dept_id
`;

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve org / branch / status / asset-type filters.
 * Multi-org: ACM orgIds (or all orgs when ACM grants all / super) + optional UI orgIds intersect.
 */
function buildAssetScope(filters = {}) {
  const conditions = [];
  const params = [];
  let i = 0;

  const acmCtx = filters.acmCtx || {};
  const acm = acmCtx.acm || {};
  const requestedOrgIds = parseList(filters.orgIds);
  const requestedBranchIds = parseList(filters.branchIds);
  const requestedDeptIds = parseList(filters.deptIds);
  const statuses = parseList(filters.statuses);
  const assetTypeIds = parseList(filters.assetTypeIds || filters.asset_type_ids);

  let allowedOrgIds = null; // null = all orgs in tenant DB
  if (acm.allOrgs) {
    allowedOrgIds = null;
  } else if (Array.isArray(acm.orgIds) && acm.orgIds.length > 0) {
    allowedOrgIds = acm.orgIds.map(String);
  } else if (acmCtx.orgId) {
    allowedOrgIds = [String(acmCtx.orgId)];
  } else if (filters.orgId) {
    allowedOrgIds = [String(filters.orgId)];
  }

  let orgIds = allowedOrgIds;
  if (requestedOrgIds.length) {
    if (allowedOrgIds == null) {
      orgIds = requestedOrgIds;
    } else {
      const allow = new Set(allowedOrgIds);
      orgIds = requestedOrgIds.filter((id) => allow.has(id));
      if (!orgIds.length) {
        conditions.push('1=0');
        return { conditions, params, paramCount: i };
      }
    }
  }

  if (orgIds && orgIds.length) {
    i += 1;
    conditions.push(`a.org_id = ANY($${i}::text[])`);
    params.push(orgIds);
  }

  let branchIds = requestedBranchIds;
  if (!branchIds.length && !acmCtx.allBranches && Array.isArray(acmCtx.branchIds) && acmCtx.branchIds.length) {
    branchIds = acmCtx.branchIds.map(String);
  }
  if (branchIds.length) {
    i += 1;
    conditions.push(`a.branch_id = ANY($${i}::text[])`);
    params.push(branchIds);
  }

  let deptIds = requestedDeptIds;
  if (!deptIds.length && !acmCtx.allDepts && Array.isArray(acmCtx.deptIds) && acmCtx.deptIds.length) {
    deptIds = acmCtx.deptIds.map(String);
  } else if (!deptIds.length && acmCtx.deptId) {
    deptIds = [String(acmCtx.deptId)];
  }
  if (deptIds.length) {
    i += 1;
    conditions.push(`COALESCE(aa.dept_id, a.dept_id) = ANY($${i}::text[])`);
    params.push(deptIds);
  }

  if (statuses.length) {
    i += 1;
    conditions.push(`a.current_status = ANY($${i}::text[])`);
    params.push(statuses);
  }

  if (assetTypeIds.length) {
    i += 1;
    conditions.push(`a.asset_type_id = ANY($${i}::text[])`);
    params.push(assetTypeIds);
  }

  if (filters.search) {
    i += 1;
    conditions.push(`(
      a.asset_id ILIKE $${i}
      OR COALESCE(a.serial_number, '') ILIKE $${i}
      OR COALESCE(a.text, '') ILIKE $${i}
      OR COALESCE(at.text, '') ILIKE $${i}
    )`);
    params.push(`%${String(filters.search).trim()}%`);
  }

  return { conditions, params, paramCount: i };
}

function whereSql(scope) {
  return scope.conditions.length ? `WHERE ${scope.conditions.join(' AND ')}` : '';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getFilterOptions(filters = {}) {
  const db = getDb();
  const scope = buildAssetScope({
    ...filters,
    orgIds: [],
    branchIds: [],
    deptIds: [],
    statuses: [],
    assetTypeIds: [],
    search: null,
  });
  const where = whereSql(scope);

  const [orgs, campuses, departments, statuses, assetTypes] = await Promise.all([
    db.query(
      `
        SELECT DISTINCT a.org_id AS id, COALESCE(o.text, a.org_id) AS label
        ${BASE_JOINS}
        ${where}
        AND a.org_id IS NOT NULL
        ORDER BY 2 ASC
      `,
      scope.params,
    ),
    db.query(
      `
        SELECT DISTINCT
          a.branch_id AS id,
          COALESCE(b.text, a.branch_id) AS label,
          a.org_id,
          COALESCE(o.text, a.org_id) AS institution
        ${BASE_JOINS}
        ${where}
        AND a.branch_id IS NOT NULL
        ORDER BY 4 ASC, 2 ASC
      `,
      scope.params,
    ),
    db.query(
      `
        SELECT DISTINCT
          COALESCE(aa.dept_id, a.dept_id) AS id,
          ${DEPT_NAME_SQL} AS label,
          a.org_id,
          a.branch_id
        ${BASE_JOINS}
        ${where}
        AND COALESCE(aa.dept_id, a.dept_id) IS NOT NULL
        ORDER BY 2 ASC
      `,
      scope.params,
    ),
    db.query(
      `
        SELECT DISTINCT a.current_status AS id, a.current_status AS label
        ${BASE_JOINS}
        ${where}
        AND a.current_status IS NOT NULL
        ORDER BY 1 ASC
      `,
      scope.params,
    ),
    db.query(
      `
        SELECT DISTINCT
          a.asset_type_id AS id,
          ${ASSET_TYPE_NAME_SQL} AS label
        ${BASE_JOINS}
        ${where}
        AND a.asset_type_id IS NOT NULL
        ORDER BY 2 ASC
      `,
      scope.params,
    ),
  ]);

  return {
    institutions: orgs.rows,
    campuses: campuses.rows,
    departments: departments.rows,
    statuses: statuses.rows,
    assetTypes: assetTypes.rows,
  };
}

async function getSummary(filters = {}) {
  const db = getDb();
  const scope = buildAssetScope(filters);
  const where = whereSql(scope);

  const consolidatedQ = db.query(
    `
      SELECT
        COUNT(*)::int AS asset_count,
        COALESCE(SUM(${ACQUISITION_SQL}), 0)::float8 AS acquisition_value,
        COALESCE(SUM(${DEPRECIATION_SQL}), 0)::float8 AS total_depreciation,
        COALESCE(SUM(${BOOK_VALUE_SQL}), 0)::float8 AS book_value
      ${BASE_JOINS}
      ${where}
    `,
    scope.params,
  );

  const institutionsQ = db.query(
    `
      SELECT
        a.org_id,
        COALESCE(o.text, a.org_id, 'Unknown') AS institution,
        COUNT(*)::int AS asset_count,
        COALESCE(SUM(${ACQUISITION_SQL}), 0)::float8 AS acquisition_value,
        COALESCE(SUM(${DEPRECIATION_SQL}), 0)::float8 AS depreciation,
        COALESCE(SUM(${BOOK_VALUE_SQL}), 0)::float8 AS book_value
      ${BASE_JOINS}
      ${where}
      GROUP BY a.org_id, o.text
      ORDER BY institution ASC
    `,
    scope.params,
  );

  const campusQ = db.query(
    `
      SELECT
        a.org_id,
        COALESCE(o.text, a.org_id, 'Unknown') AS institution,
        a.branch_id,
        COALESCE(b.text, a.branch_id, 'Unassigned campus') AS campus,
        COUNT(*)::int AS asset_count,
        COALESCE(SUM(${ACQUISITION_SQL}), 0)::float8 AS acquisition_value,
        COALESCE(SUM(${BOOK_VALUE_SQL}), 0)::float8 AS book_value
      ${BASE_JOINS}
      ${where}
      GROUP BY a.org_id, o.text, a.branch_id, b.text
      ORDER BY institution ASC, campus ASC
    `,
    scope.params,
  );

  const deptQ = db.query(
    `
      SELECT
        a.org_id,
        COALESCE(o.text, a.org_id, 'Unknown') AS institution,
        ${DEPT_NAME_SQL} AS department,
        COUNT(*)::int AS asset_count,
        COALESCE(SUM(${ACQUISITION_SQL}), 0)::float8 AS acquisition_value,
        COALESCE(SUM(${BOOK_VALUE_SQL}), 0)::float8 AS book_value
      ${BASE_JOINS}
      ${where}
      GROUP BY a.org_id, o.text, ${DEPT_NAME_SQL}
      ORDER BY institution ASC, department ASC
    `,
    scope.params,
  );

  const assetTypeQ = db.query(
    `
      WITH typed AS (
        SELECT
          a.asset_type_id,
          ${ASSET_TYPE_NAME_SQL} AS asset_type,
          ${ACQUISITION_SQL} AS acquisition_value,
          ${BOOK_VALUE_SQL} AS book_value
        ${BASE_JOINS}
        ${where}
      ),
      totals AS (
        SELECT COUNT(*)::float8 AS total_count FROM typed
      )
      SELECT
        t.asset_type_id,
        t.asset_type,
        COUNT(*)::int AS asset_count,
        COALESCE(SUM(t.acquisition_value), 0)::float8 AS acquisition_value,
        COALESCE(SUM(t.book_value), 0)::float8 AS book_value,
        CASE
          WHEN tot.total_count > 0
            THEN ROUND((COUNT(*)::numeric / tot.total_count::numeric) * 100, 1)
          ELSE 0
        END::float8 AS share_pct
      FROM typed t
      CROSS JOIN totals tot
      GROUP BY t.asset_type_id, t.asset_type, tot.total_count
      ORDER BY asset_count DESC, asset_type ASC
    `,
    scope.params,
  );

  const [consolidatedR, institutionsR, campusR, deptR, assetTypeR] = await Promise.all([
    consolidatedQ,
    institutionsQ,
    campusQ,
    deptQ,
    assetTypeQ,
  ]);

  const consolidated = consolidatedR.rows[0] || {
    asset_count: 0,
    acquisition_value: 0,
    total_depreciation: 0,
    book_value: 0,
  };

  const byDepartment = deptR.rows.map((r) => ({
    org_id: r.org_id,
    institution: r.institution,
    department: r.department,
    asset_count: num(r.asset_count),
    acquisition_value: num(r.acquisition_value),
    book_value: num(r.book_value),
  }));

  const deptAllUnassigned =
    byDepartment.length > 0 && byDepartment.every((d) => d.department === 'Unassigned');

  return {
    asOf: new Date().toISOString(),
    asOfLabel: new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    consolidated: {
      asset_count: num(consolidated.asset_count),
      acquisition_value: num(consolidated.acquisition_value),
      total_depreciation: num(consolidated.total_depreciation),
      book_value: num(consolidated.book_value),
    },
    institutions: institutionsR.rows.map((r) => ({
      org_id: r.org_id,
      institution: r.institution,
      asset_count: num(r.asset_count),
      acquisition_value: num(r.acquisition_value),
      depreciation: num(r.depreciation),
      book_value: num(r.book_value),
    })),
    byCampus: campusR.rows.map((r) => ({
      org_id: r.org_id,
      institution: r.institution,
      branch_id: r.branch_id,
      campus: r.campus,
      asset_count: num(r.asset_count),
      acquisition_value: num(r.acquisition_value),
      book_value: num(r.book_value),
    })),
    byDepartment,
    assetTypeDistribution: assetTypeR.rows.map((r) => ({
      asset_type_id: r.asset_type_id,
      asset_type: r.asset_type,
      asset_count: num(r.asset_count),
      acquisition_value: num(r.acquisition_value),
      book_value: num(r.book_value),
      share_pct: num(r.share_pct),
    })),
    dataQuality: {
      departmentAllUnassigned: deptAllUnassigned,
      depreciationIsZero: num(consolidated.total_depreciation) === 0,
    },
  };
}

async function getRegister(filters = {}) {
  const db = getDb();
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(filters.pageSize, 10) || 50));
  const offset = (page - 1) * pageSize;

  const scope = buildAssetScope(filters);
  const where = whereSql(scope);

  const countParams = [...scope.params];
  const dataParams = [...scope.params, pageSize, offset];
  const limitIdx = scope.paramCount + 1;
  const offsetIdx = scope.paramCount + 2;

  const [countR, dataR] = await Promise.all([
    db.query(
      `
        SELECT COUNT(*)::int AS total
        ${BASE_JOINS}
        ${where}
      `,
      countParams,
    ),
    db.query(
      `
        SELECT
          a.org_id,
          COALESCE(o.text, a.org_id, 'Unknown') AS institution,
          a.branch_id,
          COALESCE(b.text, a.branch_id, '—') AS campus,
          ${DEPT_NAME_SQL} AS department,
          a.asset_id,
          COALESCE(NULLIF(TRIM(a.serial_number), ''), '—') AS serial_number,
          COALESCE(at.text, a.asset_type_id, '—') AS asset_type,
          a.asset_type_id,
          COALESCE(a.current_status, '—') AS status,
          ${ACQUISITION_SQL}::float8 AS acquisition_value,
          ${BOOK_VALUE_SQL}::float8 AS book_value
        ${BASE_JOINS}
        ${where}
        ORDER BY institution ASC, campus ASC, a.asset_id ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
      dataParams,
    ),
  ]);

  const total = num(countR.rows[0]?.total);

  return {
    rows: dataR.rows.map((r) => ({
      org_id: r.org_id,
      institution: r.institution,
      branch_id: r.branch_id,
      campus: r.campus,
      department: r.department,
      asset_id: r.asset_id,
      serial_number: r.serial_number,
      asset_type: r.asset_type,
      asset_type_id: r.asset_type_id,
      status: r.status,
      acquisition_value: num(r.acquisition_value),
      book_value: num(r.book_value),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
  };
}

/** Full register for export (capped). */
async function getRegisterExport(filters = {}, maxRows = 5000) {
  return getRegister({ ...filters, page: 1, pageSize: maxRows });
}

module.exports = {
  parseList,
  getFilterOptions,
  getSummary,
  getRegister,
  getRegisterExport,
};
