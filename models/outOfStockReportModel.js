/**
 * Out of Stock report — MVP
 * Stock-out when available qty (unused tblSPIndDet units) <= 0.
 */
const { getDb } = require('../utils/dbContext');

function parseList(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function listBranches(orgId) {
  const db = getDb();
  const res = await db.query(
    `
    SELECT branch_id AS id, text AS label
      FROM "tblBranches"
     WHERE org_id = $1
       AND COALESCE(int_status, 1) = 1
     ORDER BY text
    `,
    [orgId],
  );
  return res.rows;
}

async function listStores(orgId, branchId = null) {
  const db = getDb();
  const params = [orgId];
  let sql = `
    SELECT ss_id AS id, COALESCE(store_name, store_code, ss_id) AS label, branch_id
      FROM "tblSpareStore"
     WHERE org_id = $1
  `;
  if (branchId) {
    params.push(branchId);
    sql += ` AND (branch_id IS NULL OR branch_id = $${params.length})`;
  }
  sql += ` ORDER BY 2`;
  const res = await db.query(sql, params);
  return res.rows;
}

async function listCategories(orgId) {
  const db = getDb();
  const res = await db.query(
    `
    SELECT spc_id AS id, text AS label, uom
      FROM "tblSPCategory"
     WHERE org_id = $1
       AND COALESCE(int_status, 1) = 1
     ORDER BY text
    `,
    [orgId],
  );
  return res.rows;
}

/**
 * @param {object} opts
 */
async function getOutOfStockReport({
  orgId,
  branchIds = [],
  storeIds = [],
  categoryIds = [],
  impact = 'all',
  branchId = null,
  hasSuperAccess = false,
} = {}) {
  const db = getDb();
  const params = [orgId];
  const whereCat = [`c.org_id = $1`, `COALESCE(c.int_status, 1) = 1`];

  let stockBranchSql = '';
  let issueBranchSql = '';
  let assetBranchSql = '';
  let altExcludeSql = '';

  if (branchIds.length) {
    params.push(branchIds);
    const p = `$${params.length}::text[]`;
    stockBranchSql = ` AND (ind.branch_id IS NULL OR ind.branch_id = ANY(${p}))`;
    issueBranchSql = ` AND (si.branch_id IS NULL OR si.branch_id = ANY(${p}))`;
    assetBranchSql = ` AND a.branch_id = ANY(${p})`;
    whereCat.push(`(c.branch_id IS NULL OR c.branch_id = ANY(${p}))`);
    altExcludeSql = ` AND (ind.branch_id IS NULL OR NOT (ind.branch_id = ANY(${p})))`;
  } else if (!hasSuperAccess && branchId) {
    params.push(branchId);
    const p = `$${params.length}`;
    stockBranchSql = ` AND (ind.branch_id IS NULL OR ind.branch_id = ${p})`;
    issueBranchSql = ` AND (si.branch_id IS NULL OR si.branch_id = ${p})`;
    assetBranchSql = ` AND a.branch_id = ${p}`;
    whereCat.push(`(c.branch_id IS NULL OR c.branch_id = ${p})`);
    altExcludeSql = ` AND ind.branch_id IS DISTINCT FROM ${p}`;
  }

  if (categoryIds.length) {
    params.push(categoryIds);
    whereCat.push(`c.spc_id = ANY($${params.length}::text[])`);
  }

  let storeFilterSql = '';
  if (storeIds.length) {
    params.push(storeIds);
    storeFilterSql = ` AND si.ss_id = ANY($${params.length}::text[])`;
  }

  const sql = `
    WITH stock AS (
      SELECT
        ind.spc_id,
        COUNT(*)::int AS on_hand_qty,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS available_qty,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 1)::int AS used_qty
      FROM "tblSPIndDet" ind
      WHERE ind.org_id = $1
        ${stockBranchSql}
      GROUP BY ind.spc_id
    ),
    reserved AS (
      SELECT
        COALESCE(
          CASE
            WHEN si.remarks ~ '^\\s*\\{' THEN (si.remarks::jsonb->>'spc_id')
            ELSE NULL
          END,
          ind.spc_id
        ) AS spc_id,
        COALESCE(SUM(si.quantity_issued), 0)::int AS reserved_qty,
        MIN(si.created_on) AS earliest_reserve_on
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'IS'
        ${issueBranchSql}
        ${storeFilterSql}
      GROUP BY 1
    ),
    requested AS (
      SELECT
        COALESCE(
          CASE
            WHEN si.remarks ~ '^\\s*\\{' THEN (si.remarks::jsonb->>'spc_id')
            ELSE NULL
          END,
          ind.spc_id
        ) AS spc_id,
        COALESCE(SUM(si.quantity_issued), 0)::int AS requested_qty
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'RQ'
        ${issueBranchSql}
        ${storeFilterSql}
      GROUP BY 1
    ),
    open_wo AS (
      SELECT
        m.spc_id,
        COUNT(DISTINCT ams.ams_id)::int AS open_wo_count,
        COUNT(DISTINCT a.asset_id)::int AS affected_asset_count,
        COUNT(DISTINCT ams.ams_id) FILTER (
          WHERE COALESCE(ams.maint_type_id, '') = 'MT002'
             OR UPPER(COALESCE(mt.text, '')) LIKE '%PREVENT%'
        )::int AS upcoming_pm_count,
        MIN(ams.act_maint_st_date)::date AS earliest_required_date,
        STRING_AGG(DISTINCT COALESCE(ams.wo_id, ams.ams_id), ', ') AS work_order_numbers
      FROM "tblSPCatATMap" m
      INNER JOIN "tblAssets" a
        ON a.asset_type_id = m.asset_type_id AND a.org_id = m.org_id
      INNER JOIN "tblAssetMaintSch" ams
        ON ams.asset_id = a.asset_id AND ams.org_id = m.org_id
      LEFT JOIN "tblMaintTypes" mt
        ON mt.maint_type_id = ams.maint_type_id
      WHERE m.org_id = $1
        AND COALESCE(m.int_status, 1) = 1
        AND ams.status IS DISTINCT FROM 'CO'
        AND ams.status IS DISTINCT FROM 'CA'
        ${assetBranchSql}
      GROUP BY m.spc_id
    ),
    alt_stock AS (
      SELECT
        ind.spc_id,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS alt_available_qty
      FROM "tblSPIndDet" ind
      WHERE ind.org_id = $1
        AND COALESCE(ind.is_used, 0) = 0
        ${altExcludeSql}
      GROUP BY ind.spc_id
    )
    SELECT
      c.spc_id AS part_code,
      c.text AS description,
      c.uom,
      c.minimum_stock,
      c.re_order_level,
      c.branch_id,
      b.text AS branch_name,
      COALESCE(s.on_hand_qty, 0) AS on_hand,
      COALESCE(r.reserved_qty, 0) AS reserved,
      COALESCE(s.available_qty, 0) AS available,
      COALESCE(q.requested_qty, 0) AS requested,
      COALESCE(s.used_qty, 0) AS blocked,
      r.earliest_reserve_on AS stock_out_start_date,
      COALESCE(w.affected_asset_count, 0) AS affected_asset_count,
      COALESCE(w.open_wo_count, 0) AS open_wo_count,
      COALESCE(w.upcoming_pm_count, 0) AS upcoming_pm_count,
      w.work_order_numbers,
      w.earliest_required_date,
      COALESCE(alt.alt_available_qty, 0) AS alt_branch_available
    FROM "tblSPCategory" c
    LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id AND b.org_id = c.org_id
    LEFT JOIN stock s ON s.spc_id = c.spc_id
    LEFT JOIN reserved r ON r.spc_id = c.spc_id
    LEFT JOIN requested q ON q.spc_id = c.spc_id
    LEFT JOIN open_wo w ON w.spc_id = c.spc_id
    LEFT JOIN alt_stock alt ON alt.spc_id = c.spc_id
    WHERE ${whereCat.join(' AND ')}
      AND COALESCE(s.available_qty, 0) <= 0
    ORDER BY
      COALESCE(w.open_wo_count, 0) DESC,
      COALESCE(w.upcoming_pm_count, 0) DESC,
      c.text
  `;

  const result = await db.query(sql, params);
  let rows = result.rows;

  const impactKey = String(impact || 'all').toLowerCase();
  if (impactKey === 'open_wo') {
    rows = rows.filter((r) => Number(r.open_wo_count) > 0);
  } else if (impactKey === 'upcoming_pm') {
    rows = rows.filter((r) => Number(r.upcoming_pm_count) > 0);
  } else if (impactKey === 'no_demand') {
    rows = rows.filter(
      (r) =>
        Number(r.open_wo_count) === 0 &&
        Number(r.upcoming_pm_count) === 0 &&
        Number(r.requested) === 0,
    );
  }

  const summary = {
    totals: {
      out_of_stock_parts: rows.length,
      with_open_wo: rows.filter((r) => Number(r.open_wo_count) > 0).length,
      with_upcoming_pm: rows.filter((r) => Number(r.upcoming_pm_count) > 0).length,
      with_on_hand_no_available: rows.filter(
        (r) => Number(r.on_hand) > 0 && Number(r.available) <= 0,
      ).length,
      with_alt_branch_stock: rows.filter((r) => Number(r.alt_branch_available) > 0).length,
    },
  };

  return { summary, rows };
}

module.exports = {
  parseList,
  listBranches,
  listStores,
  listCategories,
  getOutOfStockReport,
};
