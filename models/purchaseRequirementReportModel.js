/**
 * Stock & Purchase report (existing tables only)
 *
 * Minimum qty = category.minimum_stock only.
 * Status:
 *   - available === 0            → Out of stock
 *   - 0 < available <= min stock → Needs purchase
 *   - available > min stock      → excluded
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

function parseHorizonDays(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 365);
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
async function getPurchaseRequirementReport({
  orgId,
  branchIds = [],
  categoryIds = [],
  demandSource = 'all',
  focus = 'all',
  horizonDays = 30,
  branchId = null,
  hasSuperAccess = false,
} = {}) {
  const db = getDb();
  const params = [orgId];
  const whereCat = [`c.org_id = $1`, `COALESCE(c.int_status, 1) = 1`];

  let stockBranchSql = '';
  let issueBranchSql = '';
  let assetBranchSql = '';

  if (branchIds.length) {
    params.push(branchIds);
    const p = `$${params.length}::text[]`;
    stockBranchSql = ` AND (ind.branch_id IS NULL OR ind.branch_id = ANY(${p}))`;
    issueBranchSql = ` AND (si.branch_id IS NULL OR si.branch_id = ANY(${p}))`;
    assetBranchSql = ` AND a.branch_id = ANY(${p})`;
    whereCat.push(`(c.branch_id IS NULL OR c.branch_id = ANY(${p}))`);
  } else if (!hasSuperAccess && branchId) {
    params.push(branchId);
    const p = `$${params.length}`;
    stockBranchSql = ` AND (ind.branch_id IS NULL OR ind.branch_id = ${p})`;
    issueBranchSql = ` AND (si.branch_id IS NULL OR si.branch_id = ${p})`;
    assetBranchSql = ` AND a.branch_id = ${p}`;
    whereCat.push(`(c.branch_id IS NULL OR c.branch_id = ${p})`);
  }

  if (categoryIds.length) {
    params.push(categoryIds);
    whereCat.push(`c.spc_id = ANY($${params.length}::text[])`);
  }

  const horizon = parseHorizonDays(horizonDays, 30);
  params.push(horizon);
  const horizonParam = `$${params.length}`;

  const sql = `
    WITH stock AS (
      SELECT
        ind.spc_id,
        COUNT(*)::int AS on_hand_qty,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS available_qty
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
        COALESCE(SUM(si.quantity_issued), 0)::int AS reserved_qty
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'IS'
        ${issueBranchSql}
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
        COALESCE(SUM(si.quantity_issued), 0)::int AS requested_qty,
        MIN(si.created_on)::date AS earliest_request_date
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'RQ'
        ${issueBranchSql}
      GROUP BY 1
    ),
    open_issues AS (
      SELECT DISTINCT
        ams.ams_id,
        COALESCE(
          CASE
            WHEN si.remarks ~ '^\\s*\\{' THEN (si.remarks::jsonb->>'spc_id')
            ELSE NULL
          END,
          ind.spc_id
        ) AS spc_id
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      INNER JOIN "tblAssetMaintSch" ams
        ON ams.ams_id = si.assetmaintsch_id AND ams.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status IN ('RQ', 'IS')
        AND si.assetmaintsch_id IS NOT NULL
        ${issueBranchSql}
    ),
    open_wo AS (
      SELECT
        m.spc_id,
        COUNT(DISTINCT ams.ams_id)::int AS open_wo_count,
        COUNT(DISTINCT ams.ams_id) FILTER (
          WHERE open_iss.ams_id IS NULL
            AND (
              COALESCE(ams.maint_type_id, '') = 'MT002'
              OR UPPER(COALESCE(mt.text, '')) LIKE '%PREVENT%'
            )
        )::int AS upcoming_pm_demand,
        COUNT(DISTINCT ams.ams_id) FILTER (
          WHERE open_iss.ams_id IS NULL
        )::int AS uncovered_wo_demand,
        MIN(ams.act_maint_st_date)::date AS earliest_required_date
      FROM "tblSPCatATMap" m
      INNER JOIN "tblAssets" a
        ON a.asset_type_id = m.asset_type_id AND a.org_id = m.org_id
      INNER JOIN "tblAssetMaintSch" ams
        ON ams.asset_id = a.asset_id AND ams.org_id = m.org_id
      LEFT JOIN "tblMaintTypes" mt
        ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN open_issues open_iss
        ON open_iss.ams_id = ams.ams_id AND open_iss.spc_id = m.spc_id
      WHERE m.org_id = $1
        AND COALESCE(m.int_status, 1) = 1
        AND ams.status IS DISTINCT FROM 'CO'
        AND ams.status IS DISTINCT FROM 'CA'
        AND (
          ams.act_maint_st_date IS NULL
          OR ams.act_maint_st_date::date <= (CURRENT_DATE + (${horizonParam} || ' days')::interval)::date
        )
        ${assetBranchSql}
      GROUP BY m.spc_id
    ),
    usage90 AS (
      SELECT
        COALESCE(
          CASE
            WHEN si.remarks ~ '^\\s*\\{' THEN (si.remarks::jsonb->>'spc_id')
            ELSE NULL
          END,
          ind.spc_id
        ) AS spc_id,
        COALESCE(SUM(si.quantity_issued), 0)::int AS issued_qty_90d
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spid_id = si.spid_id AND ind.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'IE'
        AND COALESCE(si.changed_on, si.created_on) >= (CURRENT_DATE - INTERVAL '90 days')
        ${issueBranchSql}
      GROUP BY 1
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
      COALESCE(s.available_qty, 0) AS available,
      COALESCE(r.reserved_qty, 0) AS reserved,
      COALESCE(q.requested_qty, 0) AS requested,
      COALESCE(w.upcoming_pm_demand, 0) AS upcoming_pm_demand,
      COALESCE(w.open_wo_count, 0) AS open_wo_count,
      COALESCE(w.uncovered_wo_demand, 0) AS uncovered_wo_demand,
      COALESCE(u.issued_qty_90d, 0) AS avg_usage_90d,
      q.earliest_request_date,
      w.earliest_required_date
    FROM "tblSPCategory" c
    LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id AND b.org_id = c.org_id
    LEFT JOIN stock s ON s.spc_id = c.spc_id
    LEFT JOIN reserved r ON r.spc_id = c.spc_id
    LEFT JOIN requested q ON q.spc_id = c.spc_id
    LEFT JOIN open_wo w ON w.spc_id = c.spc_id
    LEFT JOIN usage90 u ON u.spc_id = c.spc_id
    WHERE ${whereCat.join(' AND ')}
    ORDER BY c.text
  `;

  const result = await db.query(sql, params);

  let rows = result.rows.map((row) => {
    const available = Number(row.available) || 0;
    const requested = Number(row.requested) || 0;
    const reserved = Number(row.reserved) || 0;
    const upcomingPm = Number(row.upcoming_pm_demand) || 0;
    const minStock =
      row.minimum_stock == null || row.minimum_stock === ''
        ? null
        : Number(row.minimum_stock);
    const hasMin = minStock != null && !Number.isNaN(minStock) && minStock > 0;

    // 0 → Out of stock; at or below min (and not 0) → Needs purchase
    const isOutOfStock = available <= 0;
    const needsPurchase = hasMin && available > 0 && available <= minStock;

    const earliestCandidates = [row.earliest_request_date, row.earliest_required_date].filter(Boolean);
    let earliestDemandDate = null;
    for (const d of earliestCandidates) {
      const t = new Date(d).getTime();
      if (Number.isNaN(t)) continue;
      if (!earliestDemandDate || t < new Date(earliestDemandDate).getTime()) {
        earliestDemandDate = d;
      }
    }

    const minimumQty = hasMin ? minStock : null;

    return {
      part_code: row.part_code,
      description: row.description,
      uom: row.uom,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      available,
      on_hand: Number(row.on_hand) || 0,
      minimum_stock: minimumQty,
      re_order_level: row.re_order_level,
      reserved,
      requested,
      upcoming_pm_demand: upcomingPm,
      open_wo_count: Number(row.open_wo_count) || 0,
      avg_usage_90d: Number(row.avg_usage_90d) || 0,
      // Minimum qty column = category minimum_stock only
      recommended_qty: minimumQty,
      net_requirement: minimumQty,
      earliest_demand_date: earliestDemandDate,
      is_out_of_stock: isOutOfStock,
      needs_purchase: needsPurchase,
    };
  });

  // Keep only out-of-stock or at/below minimum stock
  rows = rows.filter((r) => r.is_out_of_stock || r.needs_purchase);

  const focusKey = String(focus || demandSource || 'all').toLowerCase();
  if (focusKey === 'out_of_stock') {
    rows = rows.filter((r) => r.is_out_of_stock);
  } else if (focusKey === 'needs_purchase' || focusKey === 'purchase') {
    rows = rows.filter((r) => r.needs_purchase || r.is_out_of_stock);
  }

  rows.sort(
    (a, b) =>
      Number(a.available) - Number(b.available) ||
      Number(b.recommended_qty || 0) - Number(a.recommended_qty || 0) ||
      String(a.description || '').localeCompare(String(b.description || '')),
  );

  const summary = {
    totals: {
      parts_to_buy: rows.filter((r) => r.needs_purchase || r.is_out_of_stock).length,
      out_of_stock: rows.filter((r) => r.is_out_of_stock).length,
      total_recommended_qty: rows.reduce((sum, r) => sum + (Number(r.recommended_qty) || 0), 0),
      with_wo_impact: rows.filter((r) => Number(r.open_wo_count) > 0).length,
      with_upcoming_pm: rows.filter((r) => Number(r.upcoming_pm_demand) > 0).length,
    },
    horizon_days: horizon,
  };

  return { summary, rows };
}

module.exports = {
  parseList,
  parseHorizonDays,
  listBranches,
  listCategories,
  getPurchaseRequirementReport,
};
