/**
 * Maintenance Status Report — due / overdue / completed / expiry
 * for facility asset types over yearly, monthly, or custom periods.
 */
const { getDbFromContext } = require('../utils/dbContext');
const {
  FACILITY_TYPE_NAME_REGEX,
  isFacilityAssetTypeName,
} = require('../constants/facilityMaintenance');

const getDb = () => getDbFromContext();

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function resolvePeriodBounds(period, dateFrom, dateTo) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === 'current_year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Current year (${y})` };
  }
  if (period === 'last_year') {
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: `Last year (${y - 1})` };
  }
  if (period === 'current_month') {
    const from = `${y}-${pad(m + 1)}-01`;
    const to = isoDate(lastDayOfMonth(y, m));
    return { from, to, label: `Current month (${from.slice(0, 7)})` };
  }
  if (period === 'last_month') {
    const prev = new Date(y, m - 1, 1);
    const from = isoDate(prev);
    const to = isoDate(lastDayOfMonth(prev.getFullYear(), prev.getMonth()));
    return { from, to, label: `Last month (${from.slice(0, 7)})` };
  }

  const from = dateFrom || `${y}-01-01`;
  const to = dateTo || `${y}-12-31`;
  return { from, to, label: `Custom range (${from} → ${to})` };
}

function parseAssetTypeIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function applyBranchFilter(sql, params, { branchId, hasSuperAccess }) {
  if (hasSuperAccess || !branchId) return { sql, params };
  params.push(branchId);
  return {
    sql: `${sql} AND a.branch_id = $${params.length}`,
    params,
  };
}

async function listFacilityAssetTypes(orgId) {
  const db = getDb();
  const { rows } = await db.query(
    `
      SELECT asset_type_id, text AS asset_type_name, required_maint, inspection_required
        FROM "tblAssetTypes"
       WHERE org_id = $1
         AND COALESCE(int_status, 1) = 1
         AND LOWER(COALESCE(text, '')) ~ $2
       ORDER BY text ASC
    `,
    [orgId, FACILITY_TYPE_NAME_REGEX],
  );
  return rows;
}

async function listAllAssetTypes(orgId) {
  const db = getDb();
  const { rows } = await db.query(
    `
      SELECT asset_type_id, text AS asset_type_name
        FROM "tblAssetTypes"
       WHERE org_id = $1
         AND COALESCE(int_status, 1) = 1
       ORDER BY text ASC
    `,
    [orgId],
  );
  return rows;
}

function complianceSql() {
  return `
    CASE
      WHEN ams.status = 'CO' THEN 'COMPLETED'
      WHEN ams.status = 'CA' THEN 'CANCELLED'
      WHEN ams.act_maint_st_date IS NOT NULL
           AND ams.act_maint_st_date::date < CURRENT_DATE
           AND ams.status NOT IN ('CO', 'CA')
        THEN 'OVERDUE'
      ELSE 'DUE'
    END
  `;
}

async function getMaintenanceRows({ orgId, assetTypeIds, from, to, branchId, hasSuperAccess }) {
  const db = getDb();
  const params = [orgId, from, to];
  let sql = `
    SELECT
      ams.ams_id,
      ams.wo_id,
      ams.asset_id,
      a.text AS asset_name,
      a.serial_number,
      a.location,
      a.branch_id,
      b.text AS branch_name,
      a.asset_type_id,
      at.text AS asset_type_name,
      mt.text AS maintenance_type_name,
      ams.status,
      ams.act_maint_st_date,
      ams.act_main_end_date,
      ams.notes,
      v.vendor_name,
      ${complianceSql()} AS compliance_status
    FROM "tblAssetMaintSch" ams
    JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
    LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
    WHERE a.org_id = $1
      AND ams.status IS DISTINCT FROM 'CA'
      AND (
        (ams.act_maint_st_date IS NOT NULL AND ams.act_maint_st_date::date BETWEEN $2::date AND $3::date)
        OR (
          ams.status = 'CO'
          AND COALESCE(ams.act_main_end_date, ams.act_maint_st_date)::date BETWEEN $2::date AND $3::date
        )
        OR (
          ams.status NOT IN ('CO', 'CA')
          AND ams.act_maint_st_date IS NOT NULL
          AND ams.act_maint_st_date::date <= $3::date
        )
      )
  `;

  if (assetTypeIds.length) {
    params.push(assetTypeIds);
    sql += ` AND a.asset_type_id = ANY($${params.length}::text[])`;
  } else {
    sql += ` AND LOWER(COALESCE(at.text, '')) ~ '${FACILITY_TYPE_NAME_REGEX}'`;
  }

  const scoped = applyBranchFilter(sql, params, { branchId, hasSuperAccess });
  scoped.sql += ` ORDER BY at.text ASC, ams.act_maint_st_date ASC NULLS LAST, a.text ASC`;
  const { rows } = await db.query(scoped.sql, scoped.params);
  return rows;
}

async function getExpiryRows({ orgId, assetTypeIds, from, to, branchId, hasSuperAccess }) {
  const db = getDb();
  const params = [orgId, from, to];
  let sql = `
    SELECT
      a.asset_id,
      a.text AS asset_name,
      a.serial_number,
      a.location,
      a.branch_id,
      b.text AS branch_name,
      a.asset_type_id,
      at.text AS asset_type_name,
      a.warranty_period,
      a.expiry_date,
      CASE
        WHEN a.expiry_date IS NOT NULL AND a.expiry_date::date BETWEEN $2::date AND $3::date
             AND a.warranty_period IS NOT NULL AND a.warranty_period::date BETWEEN $2::date AND $3::date
          THEN 'WARRANTY_AND_ASSET'
        WHEN a.expiry_date IS NOT NULL AND a.expiry_date::date BETWEEN $2::date AND $3::date
          THEN 'ASSET_EXPIRY'
        ELSE 'WARRANTY_EXPIRY'
      END AS expiry_kind
    FROM "tblAssets" a
    JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
    WHERE a.org_id = $1
      AND (
        (a.expiry_date IS NOT NULL AND a.expiry_date::date BETWEEN $2::date AND $3::date)
        OR (a.warranty_period IS NOT NULL AND a.warranty_period::date BETWEEN $2::date AND $3::date)
      )
  `;

  if (assetTypeIds.length) {
    params.push(assetTypeIds);
    sql += ` AND a.asset_type_id = ANY($${params.length}::text[])`;
  } else {
    sql += ` AND LOWER(COALESCE(at.text, '')) ~ '${FACILITY_TYPE_NAME_REGEX}'`;
  }

  const scoped = applyBranchFilter(sql, params, { branchId, hasSuperAccess });
  scoped.sql += ` ORDER BY at.text ASC, a.text ASC`;
  const { rows } = await db.query(scoped.sql, scoped.params);
  return rows;
}

async function getAssetCountsByType({ orgId, assetTypeIds, branchId, hasSuperAccess }) {
  const db = getDb();
  const params = [orgId];
  let sql = `
    SELECT a.asset_type_id, at.text AS asset_type_name, COUNT(*)::int AS asset_count
    FROM "tblAssets" a
    JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    WHERE a.org_id = $1
      AND COALESCE(a.current_status, '') <> 'SCRAPPED'
  `;
  if (assetTypeIds.length) {
    params.push(assetTypeIds);
    sql += ` AND a.asset_type_id = ANY($${params.length}::text[])`;
  } else {
    sql += ` AND LOWER(COALESCE(at.text, '')) ~ '${FACILITY_TYPE_NAME_REGEX}'`;
  }
  const scoped = applyBranchFilter(sql, params, { branchId, hasSuperAccess });
  scoped.sql += ` GROUP BY a.asset_type_id, at.text ORDER BY at.text ASC`;
  const { rows } = await db.query(scoped.sql, scoped.params);
  return rows;
}

function buildSummary(maintenanceRows, expiryRows, assetCounts) {
  const byType = new Map();

  const ensure = (id, name) => {
    if (!byType.has(id)) {
      byType.set(id, {
        asset_type_id: id,
        asset_type_name: name,
        due: 0,
        overdue: 0,
        completed: 0,
        expiry: 0,
        asset_count: 0,
      });
    }
    return byType.get(id);
  };

  for (const row of assetCounts) {
    ensure(row.asset_type_id, row.asset_type_name).asset_count = Number(row.asset_count) || 0;
  }

  for (const row of maintenanceRows) {
    const bucket = ensure(row.asset_type_id, row.asset_type_name);
    if (row.compliance_status === 'COMPLETED') bucket.completed += 1;
    else if (row.compliance_status === 'OVERDUE') bucket.overdue += 1;
    else if (row.compliance_status !== 'CANCELLED') bucket.due += 1;
  }

  for (const row of expiryRows) {
    ensure(row.asset_type_id, row.asset_type_name).expiry += 1;
  }

  const by_asset_type = [...byType.values()].sort((a, b) =>
    String(a.asset_type_name).localeCompare(String(b.asset_type_name)),
  );

  const totals = by_asset_type.reduce(
    (acc, row) => {
      acc.due += row.due;
      acc.overdue += row.overdue;
      acc.completed += row.completed;
      acc.expiry += row.expiry;
      acc.assets += row.asset_count;
      return acc;
    },
    { due: 0, overdue: 0, completed: 0, expiry: 0, assets: 0 },
  );

  return { totals, by_asset_type };
}

async function getMaintenanceStatusReport({
  orgId,
  assetTypeIds,
  period,
  dateFrom,
  dateTo,
  branchId,
  hasSuperAccess,
}) {
  const bounds = resolvePeriodBounds(period, dateFrom, dateTo);
  const ids = parseAssetTypeIds(assetTypeIds);
  const context = { orgId, assetTypeIds: ids, from: bounds.from, to: bounds.to, branchId, hasSuperAccess };

  const [facilityTypes, allTypes, maintenance, expiry, assetCounts] = await Promise.all([
    listFacilityAssetTypes(orgId),
    listAllAssetTypes(orgId),
    getMaintenanceRows(context),
    getExpiryRows(context),
    getAssetCountsByType(context),
  ]);

  return {
    period: bounds,
    facility_types: facilityTypes,
    asset_types: allTypes,
    summary: buildSummary(maintenance, expiry, assetCounts),
    details: {
      maintenance,
      expiry,
    },
  };
}

module.exports = {
  resolvePeriodBounds,
  parseAssetTypeIds,
  isFacilityAssetTypeName,
  listFacilityAssetTypes,
  listAllAssetTypes,
  getMaintenanceStatusReport,
};
