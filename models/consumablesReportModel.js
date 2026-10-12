/**
 * Consumables report: stock register, stock movements (tblConsumInvenLog) and
 * department allocations (tblConsumeUsage) for one org, with shared filters.
 *
 * Filters: from / to (YYYY-MM-DD, inclusive) apply to movements, allocations and the
 * period columns of the stock register; branchIds / consumIds / brands / deptIds /
 * statuses / txnTypes narrow the respective datasets.
 */
const { getDbFromContext } = require('../utils/dbContext');
const { ensureConsumablesSchema } = require('../utils/ensureConsumablesSchema');

const getDb = () => getDbFromContext();

const STOCK_STATUS_SQL = `
  CASE
    WHEN i.quantity <= 0 THEN 'OUT_OF_STOCK'
    WHEN i.quantity <= i.reorder_level THEN 'REORDER'
    WHEN i.quantity <= i.min_stock THEN 'LOW_STOCK'
    ELSE 'OK'
  END`;

const IN_TYPES = ['OPENING', 'RESTOCK'];
const OUT_TYPES = ['ISSUE', 'ISSUE_EDIT', 'ISSUE_REVERSAL'];

const toList = (value) => {
  if (value == null || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((v) => String(v).trim()).filter(Boolean);
};

const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null);

function normalizeFilters(raw = {}) {
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - 29 * 86400000);
  return {
    from: isoDate(raw.from) || defaultFrom.toISOString().slice(0, 10),
    to: isoDate(raw.to) || today.toISOString().slice(0, 10),
    branchIds: toList(raw.branchIds),
    consumIds: toList(raw.consumIds),
    brands: toList(raw.brands).map((b) => b.toLowerCase()),
    deptIds: toList(raw.deptIds),
    statuses: toList(raw.statuses),
    txnTypes: toList(raw.txnTypes),
  };
}

async function getReportOptions({ orgId, branchId }) {
  await ensureConsumablesSchema(getDb());
  const db = getDb();
  const [branches, consumables, brands, departments] = await Promise.all([
    db.query(
      `
        SELECT DISTINCT b.branch_id, b.text AS branch_name
        FROM "tblConsumables" c
        JOIN "tblBranches" b ON b.branch_id = c.branch_id
        WHERE ($1::text IS NULL OR c.org_id = $1)
          AND ($2::text IS NULL OR c.branch_id = $2)
        ORDER BY b.text
      `,
      [orgId || null, branchId || null],
    ),
    db.query(
      `
        SELECT c.consum_id, c.consumable, u.uom AS uom_name, c.branch_id
        FROM "tblConsumables" c
        LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
        WHERE ($1::text IS NULL OR c.org_id = $1)
          AND ($2::text IS NULL OR c.branch_id = $2)
        ORDER BY c.consumable
      `,
      [orgId || null, branchId || null],
    ),
    db.query(
      `
        SELECT DISTINCT TRIM(i.brand) AS brand
        FROM "tblConsumInven" i
        JOIN "tblConsumables" c ON c.consum_id = i.consum_id
        WHERE COALESCE(TRIM(i.brand), '') <> ''
          AND ($1::text IS NULL OR i.org_id = $1)
          AND ($2::text IS NULL OR c.branch_id = $2)
        ORDER BY 1
      `,
      [orgId || null, branchId || null],
    ),
    db.query(
      `
        SELECT dept_id, text AS dept_name
        FROM "tblDepartments"
        WHERE ($1::text IS NULL OR org_id = $1)
          AND (int_status IS NULL OR int_status::text IN ('1', 'true'))
        ORDER BY text
      `,
      [orgId || null],
    ),
  ]);

  return {
    branches: branches.rows,
    consumables: consumables.rows,
    brands: brands.rows.map((r) => r.brand),
    departments: departments.rows,
    statuses: ['OK', 'LOW_STOCK', 'REORDER', 'OUT_OF_STOCK'],
    txnTypes: [...IN_TYPES, 'ADJUSTMENT', ...OUT_TYPES],
  };
}

/** Shared WHERE for rows joined to tblConsumInven i + tblConsumables c. Params start at $1. */
function scopeClause(f, { orgId, branchId }) {
  const params = [
    orgId || null,
    branchId || null,
    f.branchIds.length ? f.branchIds : null,
    f.consumIds.length ? f.consumIds : null,
    f.brands.length ? f.brands : null,
  ];
  const sql = `
    ($1::text IS NULL OR i.org_id = $1)
    AND ($2::text IS NULL OR c.branch_id = $2)
    AND ($3::text[] IS NULL OR c.branch_id = ANY($3))
    AND ($4::text[] IS NULL OR c.consum_id = ANY($4))
    AND ($5::text[] IS NULL OR LOWER(COALESCE(TRIM(i.brand), '')) = ANY($5))`;
  return { sql, params };
}

async function getStockRegister(f, scope) {
  const { sql, params } = scopeClause(f, scope);
  const p = params.length;
  const { rows } = await getDb().query(
    `
      SELECT * FROM (
        SELECT i.cinven_id, i.consum_id, c.consumable, i.brand, u.uom AS uom_name,
               c.branch_id, b.text AS branch_name,
               i.quantity, i.min_stock, i.reorder_level,
               ${STOCK_STATUS_SQL} AS stock_status,
               i.created_on,
               COALESCE(m.received, 0) AS received_qty,
               COALESCE(m.allocated, 0) AS allocated_qty,
               COALESCE(m.adjusted, 0) AS adjusted_qty,
               COALESCE(m.allocations, 0) AS allocation_count,
               lr.last_restocked_on, la.last_allocated_on
        FROM "tblConsumInven" i
        JOIN "tblConsumables" c ON c.consum_id = i.consum_id
        LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
        LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
        LEFT JOIN LATERAL (
          SELECT
            SUM(CASE WHEN l.txn_type = ANY($${p + 3}) THEN l.qty_change ELSE 0 END) AS received,
            -SUM(CASE WHEN l.txn_type = ANY($${p + 4}) THEN l.qty_change ELSE 0 END) AS allocated,
            SUM(CASE WHEN l.txn_type = 'ADJUSTMENT' THEN l.qty_change ELSE 0 END) AS adjusted,
            COUNT(*) FILTER (WHERE l.txn_type = 'ISSUE') AS allocations
          FROM "tblConsumInvenLog" l
          WHERE l.cinven_id = i.cinven_id
            AND l.created_on >= $${p + 1}::date
            AND l.created_on < ($${p + 2}::date + 1)
        ) m ON TRUE
        LEFT JOIN LATERAL (
          SELECT MAX(l.created_on) AS last_restocked_on
          FROM "tblConsumInvenLog" l
          WHERE l.cinven_id = i.cinven_id AND l.txn_type = ANY($${p + 3})
        ) lr ON TRUE
        LEFT JOIN LATERAL (
          SELECT MAX(l.created_on) AS last_allocated_on
          FROM "tblConsumInvenLog" l
          WHERE l.cinven_id = i.cinven_id AND l.txn_type = 'ISSUE'
        ) la ON TRUE
        WHERE ${sql}
      ) s
      WHERE ($${p + 5}::text[] IS NULL OR s.stock_status = ANY($${p + 5}))
      ORDER BY s.consumable, s.brand NULLS LAST, s.cinven_id
    `,
    [...params, f.from, f.to, IN_TYPES, OUT_TYPES, f.statuses.length ? f.statuses : null],
  );
  return rows;
}

async function getMovements(f, scope) {
  const { sql, params } = scopeClause(f, scope);
  const p = params.length;
  const { rows } = await getDb().query(
    `
      SELECT l.log_id, l.created_on, l.txn_type, l.qty_change, l.qty_before, l.qty_after,
             l.cinven_id, i.consum_id, c.consumable, i.brand, u.uom AS uom_name,
             c.branch_id, b.text AS branch_name,
             l.cusage_id, l.dept_id, d.text AS dept_name,
             l.reference, l.remarks, l.created_by, us.full_name AS created_by_name
      FROM "tblConsumInvenLog" l
      JOIN "tblConsumInven" i ON i.cinven_id = l.cinven_id
      JOIN "tblConsumables" c ON c.consum_id = i.consum_id
      LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
      LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = l.dept_id
      LEFT JOIN "tblUsers" us ON us.user_id = l.created_by
      WHERE ${sql}
        AND l.created_on >= $${p + 1}::date
        AND l.created_on < ($${p + 2}::date + 1)
        AND ($${p + 3}::text[] IS NULL OR l.dept_id = ANY($${p + 3}))
        AND ($${p + 4}::text[] IS NULL OR l.txn_type = ANY($${p + 4}))
      ORDER BY l.created_on DESC, l.log_id DESC
    `,
    [
      ...params,
      f.from,
      f.to,
      f.deptIds.length ? f.deptIds : null,
      f.txnTypes.length ? f.txnTypes : null,
    ],
  );
  return rows;
}

async function getAllocations(f, scope) {
  const { sql, params } = scopeClause(f, scope);
  const p = params.length;
  const { rows } = await getDb().query(
    `
      SELECT g.cusage_id, g.created_on, g.allocated_qty, g.balance,
             g.cinven_id, i.consum_id, c.consumable, i.brand, u.uom AS uom_name,
             c.branch_id, b.text AS branch_name,
             g.dept_id, d.text AS dept_name,
             g.created_by, us.full_name AS created_by_name, g.changed_on
      FROM "tblConsumeUsage" g
      JOIN "tblConsumInven" i ON i.cinven_id = g.cinven_id
      JOIN "tblConsumables" c ON c.consum_id = i.consum_id
      LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
      LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = g.dept_id
      LEFT JOIN "tblUsers" us ON us.user_id = g.created_by
      WHERE ${sql}
        AND g.created_on >= $${p + 1}::date
        AND g.created_on < ($${p + 2}::date + 1)
        AND ($${p + 3}::text[] IS NULL OR g.dept_id = ANY($${p + 3}))
      ORDER BY g.created_on DESC, g.cusage_id DESC
    `,
    [...params, f.from, f.to, f.deptIds.length ? f.deptIds : null],
  );
  return rows;
}

const num = (v) => Number(v) || 0;

function buildSummary({ stock, movements, allocations }) {
  const statusCounts = { OK: 0, LOW_STOCK: 0, REORDER: 0, OUT_OF_STOCK: 0 };
  stock.forEach((r) => {
    statusCounts[r.stock_status] = (statusCounts[r.stock_status] || 0) + 1;
  });

  let receivedQty = 0;
  let allocatedQty = 0;
  let restockCount = 0;
  movements.forEach((m) => {
    if (IN_TYPES.includes(m.txn_type)) {
      receivedQty += num(m.qty_change);
      restockCount += 1;
    } else if (OUT_TYPES.includes(m.txn_type)) {
      allocatedQty -= num(m.qty_change);
    }
  });

  const byDept = new Map();
  allocations.forEach((a) => {
    const key = a.dept_id || '—';
    const cur = byDept.get(key) || {
      dept_id: a.dept_id,
      dept_name: a.dept_name || a.dept_id || 'Unassigned',
      allocation_count: 0,
      items: new Set(),
      qty_by_uom: {},
    };
    cur.allocation_count += 1;
    cur.items.add(a.consum_id);
    const uom = a.uom_name || 'units';
    cur.qty_by_uom[uom] = (cur.qty_by_uom[uom] || 0) + num(a.allocated_qty);
    byDept.set(key, cur);
  });

  const byConsumable = new Map();
  allocations.forEach((a) => {
    const key = a.consum_id;
    const cur = byConsumable.get(key) || {
      consum_id: a.consum_id,
      consumable: a.consumable,
      uom_name: a.uom_name,
      allocated_qty: 0,
      allocation_count: 0,
      departments: new Set(),
    };
    cur.allocated_qty += num(a.allocated_qty);
    cur.allocation_count += 1;
    if (a.dept_id) cur.departments.add(a.dept_id);
    byConsumable.set(key, cur);
  });

  const trend = new Map();
  movements.forEach((m) => {
    const d = new Date(m.created_on);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const cur = trend.get(key) || { date: key, received: 0, allocated: 0 };
    if (IN_TYPES.includes(m.txn_type)) cur.received += num(m.qty_change);
    else if (OUT_TYPES.includes(m.txn_type)) cur.allocated -= num(m.qty_change);
    trend.set(key, cur);
  });

  return {
    stockEntries: stock.length,
    consumables: new Set(stock.map((r) => r.consum_id)).size,
    statusCounts,
    attentionCount: statusCounts.LOW_STOCK + statusCounts.REORDER + statusCounts.OUT_OF_STOCK,
    receivedQty,
    allocatedQty,
    restockCount,
    allocationCount: allocations.length,
    departmentsServed: new Set(allocations.map((a) => a.dept_id).filter(Boolean)).size,
    byDepartment: [...byDept.values()]
      .map((d) => ({ ...d, items: d.items.size }))
      .sort((a, b) => b.allocation_count - a.allocation_count),
    topConsumables: [...byConsumable.values()]
      .map((c) => ({ ...c, departments: c.departments.size }))
      .sort((a, b) => b.allocated_qty - a.allocated_qty),
    trend: [...trend.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function getReport(rawFilters, scope) {
  await ensureConsumablesSchema(getDb());
  const f = normalizeFilters(rawFilters);
  const [stock, movements, allocations] = await Promise.all([
    getStockRegister(f, scope),
    getMovements(f, scope),
    getAllocations(f, scope),
  ]);
  return {
    filters: f,
    generatedAt: new Date().toISOString(),
    summary: buildSummary({ stock, movements, allocations }),
    stock,
    movements,
    allocations,
  };
}

module.exports = { getReportOptions, getReport };
