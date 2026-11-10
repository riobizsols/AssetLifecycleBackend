/**
 * Upcoming Maintenance Schedule Report
 * All AMS rows for the selected period with derived schedule / coverage status.
 */
const { getDbFromContext } = require('../utils/dbContext');

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
  const today = isoDate(now);

  if (period === 'upcoming_30') {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    // from = today for the forward window; open overdue rows are included separately
    return {
      from: today,
      to: isoDate(end),
      label: 'Next 30 days (incl. overdue)',
      includeOverdue: true,
    };
  }
  if (period === 'upcoming_90') {
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
    return {
      from: today,
      to: isoDate(end),
      label: 'Next 90 days (incl. overdue)',
      includeOverdue: true,
    };
  }
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

  const from = dateFrom || today;
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

function coverageStatusSql(dateExpr) {
  return `
    CASE
      WHEN ${dateExpr} IS NULL THEN 'N/A'
      WHEN (${dateExpr})::date < CURRENT_DATE THEN 'Expired'
      WHEN (${dateExpr})::date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Expiring'
      ELSE 'Active'
    END
  `;
}

function normalizeMaintenanceTypeLabel(name, maintTypeId) {
  const raw = String(name || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return '—';
  if (lower.includes('regular') || lower.includes('prevent')) return 'Preventive';
  if (lower.includes('break')) return 'Breakdown';
  if (lower.includes('calibrat')) return 'Calibration';
  if (lower.includes('inspect')) return 'Inspection';
  if (String(maintTypeId || '').toUpperCase() === 'MT002') return 'Preventive';
  if (String(maintTypeId || '').toUpperCase() === 'MT004') return 'Breakdown';
  if (String(maintTypeId || '').toUpperCase() === 'MT017') return 'Calibration';
  return raw;
}

function formatFrequencyLabel(frequency, uomName, uomId) {
  if (frequency == null || frequency === '') return '—';
  const n = Number(frequency);
  const uom = String(uomName || uomId || '').toLowerCase();

  if (Number.isFinite(n)) {
    if (uom.includes('month')) {
      if (n === 1) return 'Monthly';
      if (n === 3) return 'Quarterly';
      if (n === 6) return 'Half-yearly';
      if (n === 12) return 'Annually';
    }
    if (uom.includes('year') && n === 1) return 'Annually';
    if (uom.includes('week') && n === 1) return 'Weekly';
    if (uom.includes('day') && n === 1) return 'Daily';
  }

  const unit = uomName || uomId || '';
  return unit ? `Every ${frequency} ${unit}` : String(frequency);
}

function normalizePriority(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  const lower = s.toLowerCase();
  if (lower === 'bf01' || lower.includes('very high') || lower === 'critical') return 'Critical';
  if (lower === 'bf02' || lower === 'high') return 'High';
  if (lower === 'bf03' || lower === 'medium') return 'Medium';
  if (lower === 'low') return 'Low';
  if (lower.includes('critical')) return 'Critical';
  if (lower.includes('high')) return 'High';
  if (lower.includes('medium')) return 'Medium';
  if (lower.includes('low')) return 'Low';
  return s;
}

function deriveScheduleStatus(row) {
  const status = String(row.status || '').toUpperCase();
  if (status === 'CO') return 'Completed';
  if (status === 'CA') return 'Cancelled';

  const scheduleDate = row.act_maint_st_date ? new Date(row.act_maint_st_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (scheduleDate && !Number.isNaN(scheduleDate.getTime())) {
    scheduleDate.setHours(0, 0, 0, 0);
  }

  const isRescheduled =
    row.pl_sch_date &&
    row.act_maint_st_date &&
    String(row.pl_sch_date).slice(0, 10) !== String(row.act_maint_st_date).slice(0, 10);

  if (scheduleDate && !Number.isNaN(scheduleDate.getTime())) {
    if (scheduleDate.getTime() < today.getTime()) return 'Overdue';
    if (scheduleDate.getTime() === today.getTime()) return 'Due Today';
  }

  if (isRescheduled || status === 'RE') return 'Rescheduled';
  return 'Upcoming';
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

async function getScheduleRows({
  orgId,
  assetTypeIds,
  from,
  to,
  branchId,
  hasSuperAccess,
  scheduleStatusFilter,
  includeOverdue = false,
}) {
  const db = getDb();
  const params = [orgId, from, to];
  let sql = `
    SELECT
      ams.ams_id,
      ams.wo_id,
      ams.asset_id,
      COALESCE(NULLIF(BTRIM(a.text), ''), NULLIF(BTRIM(a.description), ''), a.asset_id) AS asset_name,
      a.serial_number,
      a.asset_type_id,
      at.text AS asset_type_name,
      ams.maint_type_id,
      mt.text AS maintenance_type_raw,
      ams.act_maint_st_date,
      ams.act_main_end_date,
      ams.status,
      ams.notes,
      ams.technician_name,
      ams.emp_int_id,
      COALESCE(
        NULLIF(BTRIM(ams.technician_name), ''),
        NULLIF(BTRIM(e.name), ''),
        NULLIF(BTRIM(CONCAT_WS(' ', e.first_name, e.last_name)), '')
      ) AS assigned_technician,
      COALESCE(v.vendor_name, sv.vendor_name) AS vendor_name,
      ams.vendor_id,
      ams.at_main_freq_id,
      freq.frequency AS frequency_value,
      freq.uom AS frequency_uom_id,
      uom.uom AS frequency_uom_name,
      wfh.pl_sch_date,
      a.warranty_period,
      a.amc_end_date,
      a.cmc_end_date,
      ${coverageStatusSql('a.warranty_period')} AS warranty_status,
      ${coverageStatusSql('a.amc_end_date')} AS amc_status,
      ${coverageStatusSql('a.cmc_end_date')} AS cmc_status,
      (
        SELECT COALESCE(prev.act_main_end_date, prev.act_maint_st_date)
          FROM "tblAssetMaintSch" prev
         WHERE prev.asset_id = ams.asset_id
           AND prev.org_id = ams.org_id
           AND prev.status = 'CO'
           AND prev.ams_id IS DISTINCT FROM ams.ams_id
         ORDER BY COALESCE(prev.act_main_end_date, prev.act_maint_st_date) DESC NULLS LAST
         LIMIT 1
      ) AS last_maintenance_date,
      (
        SELECT br.decision_code
          FROM "tblAssetBRDet" br
         WHERE br.asset_id = ams.asset_id
           AND br.org_id = ams.org_id
         ORDER BY br.created_on DESC NULLS LAST, br.abr_id DESC
         LIMIT 1
      ) AS breakdown_priority
    FROM "tblAssetMaintSch" ams
    JOIN "tblAssets" a ON a.asset_id = ams.asset_id
    JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
    LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
    LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
    LEFT JOIN "tblATMaintFreq" freq ON freq.at_main_freq_id = ams.at_main_freq_id
    LEFT JOIN "tblUom" uom ON uom.uom_id = freq.uom
    LEFT JOIN "tblWFAssetMaintSch_H" wfh ON wfh.wfamsh_id = ams.wfamsh_id
    LEFT JOIN "tblEmployees" e ON e.emp_int_id = ams.emp_int_id
    WHERE a.org_id = $1
      AND ams.status IS DISTINCT FROM 'CA'
      AND ams.act_maint_st_date IS NOT NULL
      AND (
        ams.act_maint_st_date::date BETWEEN $2::date AND $3::date
        ${includeOverdue
          ? `OR (
               ams.status IS DISTINCT FROM 'CO'
               AND ams.act_maint_st_date::date < $2::date
             )`
          : ''}
      )
  `;

  if (assetTypeIds.length) {
    params.push(assetTypeIds);
    sql += ` AND a.asset_type_id = ANY($${params.length}::text[])`;
  }

  const scoped = applyBranchFilter(sql, params, { branchId, hasSuperAccess });
  scoped.sql += `
    ORDER BY ams.act_maint_st_date ASC NULLS LAST, at.text ASC, a.text ASC
  `;

  const { rows } = await db.query(scoped.sql, scoped.params);

  const mapped = rows.map((row, index) => {
    const scheduleStatus = deriveScheduleStatus(row);
    const amc = row.amc_status || 'N/A';
    const cmc = row.cmc_status || 'N/A';
    let amcCmcStatus = 'N/A';
    if (amc !== 'N/A' && cmc !== 'N/A') amcCmcStatus = `AMC ${amc} / CMC ${cmc}`;
    else if (amc !== 'N/A') amcCmcStatus = `AMC ${amc}`;
    else if (cmc !== 'N/A') amcCmcStatus = `CMC ${cmc}`;

    const maintenanceType = normalizeMaintenanceTypeLabel(
      row.maintenance_type_raw,
      row.maint_type_id,
    );
    const isBreakdown = maintenanceType === 'Breakdown';

    return {
      sno: index + 1,
      ams_id: row.ams_id,
      asset_id: row.asset_id,
      asset_code: row.asset_id,
      asset_name: row.asset_name,
      asset_type_id: row.asset_type_id,
      asset_type_name: row.asset_type_name,
      maintenance_type: maintenanceType,
      maintenance_type_raw: row.maintenance_type_raw,
      maintenance_schedule_date: row.act_maint_st_date,
      last_maintenance_date: row.last_maintenance_date,
      maintenance_frequency: formatFrequencyLabel(
        row.frequency_value,
        row.frequency_uom_name,
        row.frequency_uom_id,
      ),
      frequency_value: row.frequency_value,
      assigned_technician: row.assigned_technician || '—',
      vendor_name: row.vendor_name || '—',
      priority: isBreakdown ? normalizePriority(row.breakdown_priority) : '—',
      schedule_status: scheduleStatus,
      warranty_status: row.warranty_status || 'N/A',
      amc_cmc_status: amcCmcStatus,
      wo_id: row.wo_id || '—',
      remarks: row.notes || '',
      status: row.status,
      pl_sch_date: row.pl_sch_date,
    };
  });

  if (!scheduleStatusFilter || scheduleStatusFilter === 'ALL') return mapped;
  return mapped.filter((row) => row.schedule_status === scheduleStatusFilter);
}

async function getUpcomingMaintenanceScheduleReport({
  orgId,
  assetTypeIds = [],
  period = 'upcoming_90',
  dateFrom = null,
  dateTo = null,
  branchId = null,
  hasSuperAccess = false,
  scheduleStatus = 'ALL',
}) {
  const bounds = resolvePeriodBounds(period, dateFrom, dateTo);
  const rows = await getScheduleRows({
    orgId,
    assetTypeIds: parseAssetTypeIds(assetTypeIds),
    from: bounds.from,
    to: bounds.to,
    branchId,
    hasSuperAccess,
    scheduleStatusFilter: scheduleStatus,
    includeOverdue: Boolean(bounds.includeOverdue),
  });

  // Re-number after status filter
  const details = rows.map((row, index) => ({ ...row, sno: index + 1 }));

  const totals = {
    total: details.length,
    upcoming: details.filter((r) => r.schedule_status === 'Upcoming').length,
    due_today: details.filter((r) => r.schedule_status === 'Due Today').length,
    overdue: details.filter((r) => r.schedule_status === 'Overdue').length,
    completed: details.filter((r) => r.schedule_status === 'Completed').length,
    rescheduled: details.filter((r) => r.schedule_status === 'Rescheduled').length,
  };

  return {
    period: bounds,
    summary: { totals },
    details,
  };
}

module.exports = {
  parseAssetTypeIds,
  resolvePeriodBounds,
  listAllAssetTypes,
  getUpcomingMaintenanceScheduleReport,
};
