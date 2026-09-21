/**
 * SLA & Vendor Performance Report
 *
 * Built on existing SLA + maintenance data — does NOT redesign Vendor SLA config.
 *
 * Data sources (actual):
 * - tblAssetMaintSch ……… work orders / service executions (unit of analysis)
 * - tblVendorSLAs ……… agreed targets ("SLA-1" First response, "SLA-3" Resolution) as free-text hours/days
 * - tblvendorslarecs ……… optional per-AMS recorded SLA values + sla_rating (0–5)
 * - tblAssetBRDet ……… breakdown / failure history (repeat failures)
 * - tblATBRReasonCodes … breakdown reasons
 *
 * Calculation rules:
 * - Request start …… COALESCE(ams.created_on, ams.act_maint_st_date)
 * - Completion ……… ams.act_main_end_date when status = 'CO'
 * - Cancelled ……… status = 'CA' → excluded from compliance & averages
 * - Open …………… not CO/CA → excluded from resolution averages
 * - Resolution target … parse numeric from Vendor SLA-3; "day"/"days" ⇒ ×24 hours
 * - SLA due ………… request_start + resolution_target_hours
 * - Resolution breach … completed AND target present AND completion > due  (PRIMARY breach)
 * - Response ……… no response timestamp exists; when sla1_value is numeric, use as
 *                   recorded response hours vs Vendor SLA-1 (separate from resolution breach)
 * - Service rating …… tblvendorslarecs.sla_rating only (never fabricated)
 * - Repeat failure …… same asset_id with ≥2 breakdowns in selected period
 */
const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

let vendorSlaRecsAvailable = null;

async function hasVendorSlaRecs() {
  const db = getDb();
  const { rows } = await db.query(
    `SELECT to_regclass('public.tblvendorslarecs') IS NOT NULL AS ok`,
  );
  vendorSlaRecsAvailable = Boolean(rows[0]?.ok);
  return vendorSlaRecsAvailable;
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolvePeriod(period, dateFrom, dateTo) {
  const now = new Date();
  const y = now.getFullYear();
  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };
  const iso = (d) => d.toISOString().slice(0, 10);

  if (period === 'today') {
    const from = startOfDay(now);
    return { from: iso(from), to: iso(now), label: 'Today', prevFrom: iso(new Date(from - 86400000)), prevTo: iso(new Date(from - 1)) };
  }
  if (period === 'last_7_days') {
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getTime() - 6 * 86400000));
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = startOfDay(new Date(prevTo.getTime() - 6 * 86400000));
    return { from: iso(from), to: iso(to), label: 'Last 7 days', prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
  }
  if (period === 'last_90_days') {
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getTime() - 89 * 86400000));
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = startOfDay(new Date(prevTo.getTime() - 89 * 86400000));
    return { from: iso(from), to: iso(to), label: 'Last 90 days', prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
  }
  if (period === 'this_year') {
    return {
      from: `${y}-01-01`,
      to: iso(now),
      label: `This year (${y})`,
      prevFrom: `${y - 1}-01-01`,
      prevTo: `${y - 1}-12-31`,
    };
  }
  if (period === 'last_year') {
    return {
      from: `${y - 1}-01-01`,
      to: `${y - 1}-12-31`,
      label: `Last year (${y - 1})`,
      prevFrom: `${y - 2}-01-01`,
      prevTo: `${y - 2}-12-31`,
    };
  }
  if (period === 'custom' && dateFrom && dateTo) {
    const from = startOfDay(dateFrom);
    const to = endOfDay(dateTo);
    const ms = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - ms);
    return {
      from: iso(from),
      to: iso(to),
      label: `Custom (${iso(from)} → ${iso(to)})`,
      prevFrom: iso(prevFrom),
      prevTo: iso(prevTo),
    };
  }
  // default last_30_days
  const to = endOfDay(now);
  const from = startOfDay(new Date(now.getTime() - 29 * 86400000));
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = startOfDay(new Date(prevTo.getTime() - 29 * 86400000));
  return { from: iso(from), to: iso(to), label: 'Last 30 days', prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
}

/** SQL snippet: parse free-text SLA target to hours (NULL if unparseable). */
function sqlParseHours(expr) {
  return `
    CASE
      WHEN ${expr} IS NULL OR BTRIM(${expr}::text) = '' THEN NULL
      WHEN LOWER(${expr}::text) ~ 'day' THEN
        NULLIF(regexp_replace(${expr}::text, '[^0-9.]', '', 'g'), '')::numeric * 24
      ELSE
        NULLIF(regexp_replace(${expr}::text, '[^0-9.]', '', 'g'), '')::numeric
    END
  `;
}

function buildScope(filters = {}) {
  const conditions = [`ams.org_id = $1`];
  const params = [filters.orgId];
  let i = 1;

  const from = filters.dateFrom;
  const to = filters.dateTo;
  if (from && to) {
    i += 1;
    conditions.push(`COALESCE(ams.act_maint_st_date, ams.changed_on)::date BETWEEN $${i}::date AND $${i + 1}::date`);
    params.push(from, to);
    i += 1;
  }

  const vendorIds = parseList(filters.vendorIds);
  if (vendorIds.length) {
    i += 1;
    conditions.push(`ams.vendor_id = ANY($${i}::text[])`);
    params.push(vendorIds);
  }

  const assetIds = parseList(filters.assetIds);
  if (assetIds.length) {
    i += 1;
    conditions.push(`ams.asset_id = ANY($${i}::text[])`);
    params.push(assetIds);
  }

  const assetTypeIds = parseList(filters.assetTypeIds);
  if (assetTypeIds.length) {
    i += 1;
    conditions.push(`a.asset_type_id = ANY($${i}::text[])`);
    params.push(assetTypeIds);
  }

  const branchIds = parseList(filters.branchIds);
  if (branchIds.length) {
    i += 1;
    conditions.push(`a.branch_id = ANY($${i}::text[])`);
    params.push(branchIds);
  }

  const maintTypeIds = parseList(filters.maintTypeIds);
  if (maintTypeIds.length) {
    i += 1;
    conditions.push(`ams.maint_type_id = ANY($${i}::text[])`);
    params.push(maintTypeIds);
  }

  const reasonIds = parseList(filters.reasonIds);
  if (reasonIds.length) {
    i += 1;
    conditions.push(`br.atbrrc_id = ANY($${i}::text[])`);
    params.push(reasonIds);
  }

  // slaStatus applied in outer queries on derived columns
  return { conditions, params, paramCount: i, whereSql: `WHERE ${conditions.join(' AND ')}` };
}

/**
 * Core fact rows: one per AMS in scope with derived SLA fields.
 */
function factCteSql(scope, { includeSlaRecs = vendorSlaRecsAvailable === true } = {}) {
  const resTarget = sqlParseHours(`vs."SLA-3"`);
  const respTarget = sqlParseHours(`vs."SLA-1"`);
  const recordedResp = includeSlaRecs
    ? sqlParseHours(`vsr.sla1_value`)
    : 'NULL::numeric';
  const recordedRes = includeSlaRecs
    ? sqlParseHours(`vsr.sla3_value`)
    : 'NULL::numeric';
  const ratingExpr = includeSlaRecs
    ? `CASE
         WHEN vsr.sla_rating IS NULL OR BTRIM(vsr.sla_rating::text) = '' THEN NULL
         WHEN BTRIM(vsr.sla_rating::text) ~ '^[0-9]+(\\.[0-9]+)?$'
           THEN BTRIM(vsr.sla_rating::text)::numeric
         ELSE NULL
       END`
    : 'NULL::numeric';
  const slaRecJoin = includeSlaRecs
    ? 'LEFT JOIN "tblvendorslarecs" vsr ON vsr.ams_id = ams.ams_id'
    : '';

  return `
    WITH scoped AS (
      SELECT
        ams.ams_id,
        COALESCE(NULLIF(BTRIM(ams.wo_id), ''), ams.ams_id) AS request_id,
        ams.asset_id,
        a.serial_number,
        at.asset_type_id,
        COALESCE(at.text, '—') AS asset_type_name,
        ams.vendor_id,
        COALESCE(v.vendor_name, 'Unassigned') AS vendor_name,
        ams.maint_type_id,
        COALESCE(mt.text, ams.maint_type_id, '—') AS service_type_name,
        COALESCE(a.branch_id) AS branch_id,
        COALESCE(b.text, a.branch_id, '—') AS location_name,
        ams.status,
        COALESCE(ams.act_maint_st_date, ams.changed_on) AS request_start,
        ams.act_maint_st_date,
        ams.act_main_end_date AS completed_at,
        br.abr_id,
        br.atbrrc_id AS reason_id,
        brc.text AS breakdown_reason,
        ${ratingExpr} AS sla_rating,
        ${respTarget} AS response_target_hours,
        ${recordedResp} AS recorded_response_hours,
        ${resTarget} AS resolution_target_hours,
        ${recordedRes} AS recorded_resolution_hours,
        CASE
          WHEN ams.status = 'CO' AND ams.act_main_end_date IS NOT NULL
            AND COALESCE(ams.act_maint_st_date, ams.changed_on) IS NOT NULL
          THEN EXTRACT(EPOCH FROM (ams.act_main_end_date - COALESCE(ams.act_maint_st_date, ams.changed_on))) / 3600.0
          ELSE NULL
        END AS resolution_hours,
        CASE
          WHEN (${resTarget}) IS NOT NULL
            AND COALESCE(ams.act_maint_st_date, ams.changed_on) IS NOT NULL
          THEN COALESCE(ams.act_maint_st_date, ams.changed_on)
               + ((${resTarget}) * INTERVAL '1 hour')
          ELSE NULL
        END AS sla_due_at
      FROM "tblAssetMaintSch" ams
      LEFT JOIN "tblAssets" a ON a.asset_id = ams.asset_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
      LEFT JOIN "tblVendorSLAs" vs ON vs.vendor_id = ams.vendor_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      ${slaRecJoin}
      LEFT JOIN LATERAL (
        SELECT brd.abr_id, brd.atbrrc_id
        FROM "tblAssetBRDet" brd
        WHERE brd.org_id = ams.org_id
          AND brd.asset_id = ams.asset_id
          AND ams.wo_id IS NOT NULL
          AND ams.wo_id ILIKE '%' || brd.abr_id || '%'
        ORDER BY brd.created_on DESC NULLS LAST
        LIMIT 1
      ) br ON true
      LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = br.atbrrc_id
      ${scope.whereSql}
    ),
    fact AS (
      SELECT
        s.*,
        CASE
          WHEN s.status = 'CA' THEN 'cancelled'
          WHEN s.status <> 'CO' OR s.completed_at IS NULL THEN 'open'
          WHEN s.resolution_target_hours IS NULL THEN 'no_sla'
          WHEN s.completed_at > s.sla_due_at THEN 'breached'
          ELSE 'within_sla'
        END AS sla_status,
        CASE
          WHEN s.status = 'CO' AND s.completed_at IS NOT NULL AND s.sla_due_at IS NOT NULL
            AND s.completed_at > s.sla_due_at
          THEN EXTRACT(EPOCH FROM (s.completed_at - s.sla_due_at)) / 3600.0
          ELSE NULL
        END AS delay_hours,
        CASE
          WHEN s.recorded_response_hours IS NOT NULL AND s.response_target_hours IS NOT NULL
            AND s.recorded_response_hours <= s.response_target_hours
          THEN true
          WHEN s.recorded_response_hours IS NOT NULL AND s.response_target_hours IS NOT NULL
          THEN false
          ELSE NULL
        END AS response_within_sla
      FROM scoped s
    )
  `;
}

async function factSql(scope) {
  const includeSlaRecs = await hasVendorSlaRecs();
  return factCteSql(scope, { includeSlaRecs });
}

function applySlaStatusFilter(filters, baseAlias = 'f') {
  const status = String(filters.slaStatus || 'all').toLowerCase();
  if (status === 'breached') return ` AND ${baseAlias}.sla_status = 'breached'`;
  if (status === 'within_sla') return ` AND ${baseAlias}.sla_status = 'within_sla'`;
  if (status === 'open') return ` AND ${baseAlias}.sla_status = 'open'`;
  if (status === 'no_sla') return ` AND ${baseAlias}.sla_status = 'no_sla'`;
  return '';
}

function hoursLabel(h) {
  if (h == null || !Number.isFinite(Number(h))) return null;
  const n = Number(h);
  if (n < 1) {
    const m = Math.round(n * 60);
    return `${m}m`;
  }
  if (n < 48) {
    const hrs = Math.floor(n);
    const m = Math.round((n - hrs) * 60);
    return m ? `${hrs}h ${m}m` : `${hrs}h`;
  }
  const d = Math.floor(n / 24);
  const hrs = Math.round(n - d * 24);
  return hrs ? `${d}d ${hrs}h` : `${d}d`;
}

function mapRow(r) {
  return {
    ...r,
    resolution_hours: r.resolution_hours != null ? Number(r.resolution_hours) : null,
    delay_hours: r.delay_hours != null ? Number(r.delay_hours) : null,
    resolution_target_hours: r.resolution_target_hours != null ? Number(r.resolution_target_hours) : null,
    response_target_hours: r.response_target_hours != null ? Number(r.response_target_hours) : null,
    recorded_response_hours: r.recorded_response_hours != null ? Number(r.recorded_response_hours) : null,
    recorded_resolution_hours: r.recorded_resolution_hours != null ? Number(r.recorded_resolution_hours) : null,
    sla_rating: r.sla_rating != null ? Number(r.sla_rating) : null,
    resolution_label: hoursLabel(r.resolution_hours),
    delay_label: hoursLabel(r.delay_hours),
    response_target_label: hoursLabel(r.response_target_hours),
    resolution_target_label: hoursLabel(r.resolution_target_hours),
    recorded_response_label: hoursLabel(r.recorded_response_hours),
  };
}

async function getFilterOptions(filters = {}) {
  const db = getDb();
  const orgId = filters.orgId;
  const [vendors, assetTypes, maintTypes, branches, reasons] = await Promise.all([
    db.query(
      `
        SELECT DISTINCT v.vendor_id AS id, v.vendor_name AS label
        FROM "tblVendors" v
        WHERE v.org_id = $1 AND COALESCE(v.int_status, 1) = 1
        ORDER BY 2
      `,
      [orgId],
    ),
    db.query(
      `
        SELECT DISTINCT at.asset_type_id AS id, at.text AS label
        FROM "tblAssetTypes" at
        WHERE at.org_id = $1 OR at.org_id IS NULL
        ORDER BY 2
      `,
      [orgId],
    ),
    db.query(
      `
        SELECT DISTINCT mt.maint_type_id AS id, mt.text AS label
        FROM "tblMaintTypes" mt
        ORDER BY 2
      `,
    ),
    db.query(
      `
        SELECT DISTINCT b.branch_id AS id, b.text AS label
        FROM "tblBranches" b
        WHERE b.org_id = $1 OR b.org_id IS NULL
        ORDER BY 2
      `,
      [orgId],
    ),
    db.query(
      `
        SELECT DISTINCT brc.atbrrc_id AS id, brc.text AS label
        FROM "tblATBRReasonCodes" brc
        ORDER BY 2
      `,
    ),
  ]);

  return {
    vendors: vendors.rows,
    assetTypes: assetTypes.rows,
    maintTypes: maintTypes.rows,
    locations: branches.rows,
    breakdownReasons: reasons.rows,
    periods: [
      { id: 'today', label: 'Today' },
      { id: 'last_7_days', label: 'Last 7 Days' },
      { id: 'last_30_days', label: 'Last 30 Days' },
      { id: 'last_90_days', label: 'Last 90 Days' },
      { id: 'this_year', label: 'This Year' },
      { id: 'last_year', label: 'Last Year' },
      { id: 'custom', label: 'Custom Range' },
    ],
    slaStatuses: [
      { id: 'all', label: 'All' },
      { id: 'within_sla', label: 'Within SLA' },
      { id: 'breached', label: 'Breached' },
      { id: 'open', label: 'Open / In progress' },
      { id: 'no_sla', label: 'No SLA configured' },
    ],
    definitions: {
      slaCompliance:
        'Percentage of completed work orders finished on or before the vendor Resolution (SLA-3) due time.',
      avgResponse:
        'Average of recorded First-response (SLA-1) hours entered on the maintenance Vendor SLA form. Clock-based first-response timestamps are not stored in the system.',
      avgResolution:
        'Average hours between work-order start (created_on / act_maint_st_date) and act_main_end_date for completed (CO) work orders.',
      slaBreach:
        'Completed work order where completion time is after request_start + vendor Resolution (SLA-3) target.',
      repeatFailure:
        'Asset with two or more breakdown records (tblAssetBRDet) in the selected period.',
      serviceRating:
        'Average of sla_rating (0–5) captured on tblvendorslarecs during supervisor approval. Not fabricated when missing.',
    },
  };
}

async function summarizePeriod(filters) {
  await hasVendorSlaRecs();
  const db = getDb();
  const scope = buildScope(filters);
  const statusFilter = applySlaStatusFilter(filters);
  const sql = `
    ${factCteSql(scope)}
    SELECT
      COUNT(*)::int AS total_requests,
      COUNT(*) FILTER (WHERE f.sla_status = 'within_sla')::int AS within_sla,
      COUNT(*) FILTER (WHERE f.sla_status = 'breached')::int AS breached,
      COUNT(*) FILTER (WHERE f.sla_status = 'open')::int AS open_requests,
      COUNT(*) FILTER (WHERE f.sla_status = 'no_sla')::int AS no_sla,
      COUNT(*) FILTER (WHERE f.sla_status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE f.sla_status IN ('within_sla','breached'))::int AS scored,
      AVG(f.resolution_hours) FILTER (WHERE f.resolution_hours IS NOT NULL) AS avg_resolution_hours,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY f.resolution_hours)
        FILTER (WHERE f.resolution_hours IS NOT NULL) AS median_resolution_hours,
      MIN(f.resolution_hours) FILTER (WHERE f.resolution_hours IS NOT NULL) AS min_resolution_hours,
      MAX(f.resolution_hours) FILTER (WHERE f.resolution_hours IS NOT NULL) AS max_resolution_hours,
      AVG(f.recorded_response_hours) FILTER (WHERE f.recorded_response_hours IS NOT NULL) AS avg_response_hours,
      MIN(f.recorded_response_hours) FILTER (WHERE f.recorded_response_hours IS NOT NULL) AS min_response_hours,
      MAX(f.recorded_response_hours) FILTER (WHERE f.recorded_response_hours IS NOT NULL) AS max_response_hours,
      COUNT(*) FILTER (WHERE f.response_within_sla IS TRUE)::int AS response_within,
      COUNT(*) FILTER (WHERE f.response_within_sla IS FALSE)::int AS response_breached,
      COUNT(*) FILTER (WHERE f.response_within_sla IS NOT NULL)::int AS response_scored,
      AVG(f.sla_rating) FILTER (WHERE f.sla_rating IS NOT NULL) AS avg_rating,
      COUNT(*) FILTER (WHERE f.sla_rating IS NOT NULL)::int AS rating_count,
      COUNT(DISTINCT f.vendor_id) FILTER (WHERE f.sla_status = 'breached' AND f.vendor_id IS NOT NULL)::int AS vendors_with_breaches
    FROM fact f
    WHERE 1=1 ${statusFilter}
  `;
  const { rows } = await db.query(sql, scope.params);
  const r = rows[0] || {};
  const scored = Number(r.scored) || 0;
  const within = Number(r.within_sla) || 0;
  const respScored = Number(r.response_scored) || 0;
  const respWithin = Number(r.response_within) || 0;
  return {
    total_requests: Number(r.total_requests) || 0,
    within_sla: within,
    breached: Number(r.breached) || 0,
    open_requests: Number(r.open_requests) || 0,
    no_sla: Number(r.no_sla) || 0,
    cancelled: Number(r.cancelled) || 0,
    sla_compliance_pct: scored ? Math.round((within / scored) * 1000) / 10 : null,
    avg_resolution_hours: r.avg_resolution_hours != null ? Number(r.avg_resolution_hours) : null,
    median_resolution_hours: r.median_resolution_hours != null ? Number(r.median_resolution_hours) : null,
    min_resolution_hours: r.min_resolution_hours != null ? Number(r.min_resolution_hours) : null,
    max_resolution_hours: r.max_resolution_hours != null ? Number(r.max_resolution_hours) : null,
    avg_response_hours: r.avg_response_hours != null ? Number(r.avg_response_hours) : null,
    min_response_hours: r.min_response_hours != null ? Number(r.min_response_hours) : null,
    max_response_hours: r.max_response_hours != null ? Number(r.max_response_hours) : null,
    response_compliance_pct: respScored ? Math.round((respWithin / respScored) * 1000) / 10 : null,
    response_data_available: respScored > 0,
    avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
    rating_count: Number(r.rating_count) || 0,
    rating_data_available: Number(r.rating_count) > 0,
    vendors_with_breaches: Number(r.vendors_with_breaches) || 0,
    avg_resolution_label: hoursLabel(r.avg_resolution_hours),
    avg_response_label: hoursLabel(r.avg_response_hours),
  };
}

async function getSummary(filters = {}) {
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const currentFilters = { ...filters, dateFrom: bounds.from, dateTo: bounds.to };
  const prevFilters = { ...filters, dateFrom: bounds.prevFrom, dateTo: bounds.prevTo };

  const [current, previous, repeat] = await Promise.all([
    summarizePeriod(currentFilters),
    summarizePeriod(prevFilters).catch(() => null),
    getRepeatFailureStats(currentFilters),
  ]);

  const delta = (cur, prev) => {
    if (cur == null || prev == null || !Number.isFinite(prev) || prev === 0) return null;
    return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
  };

  return {
    period: bounds,
    kpis: {
      ...current,
      repeat_failure_assets: repeat.asset_count,
      repeat_failure_events: repeat.event_count,
      top_failure_reason: repeat.top_reason,
      vs_previous: previous
        ? {
            sla_compliance_pct: delta(current.sla_compliance_pct, previous.sla_compliance_pct),
            breached: delta(current.breached, previous.breached),
            total_requests: delta(current.total_requests, previous.total_requests),
            avg_resolution_hours: delta(current.avg_resolution_hours, previous.avg_resolution_hours),
          }
        : null,
    },
    status_distribution: {
      within_sla: current.within_sla,
      breached: current.breached,
      open: current.open_requests,
      no_sla: current.no_sla,
      cancelled: current.cancelled,
    },
  };
}

async function getTrends(filters = {}) {
  await hasVendorSlaRecs();
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const scope = buildScope({ ...filters, dateFrom: bounds.from, dateTo: bounds.to });
  const grain = String(filters.grain || 'month').toLowerCase();
  const trunc =
    grain === 'day' ? 'day' : grain === 'week' ? 'week' : 'month';

  const sql = `
    ${factCteSql(scope)}
    SELECT
      to_char(date_trunc('${trunc}', f.request_start)::date, 'YYYY-MM-DD') AS bucket,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE f.sla_status = 'within_sla')::int AS within_sla,
      COUNT(*) FILTER (WHERE f.sla_status = 'breached')::int AS breached,
      COUNT(*) FILTER (WHERE f.sla_status IN ('within_sla','breached'))::int AS scored,
      AVG(f.resolution_hours) FILTER (WHERE f.resolution_hours IS NOT NULL) AS avg_resolution_hours,
      AVG(f.recorded_response_hours) FILTER (WHERE f.recorded_response_hours IS NOT NULL) AS avg_response_hours
    FROM fact f
    WHERE f.request_start IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await db.query(sql, scope.params);

  const byBucket = new Map();
  for (const r of rows) {
    const key = toDateKey(r.bucket);
    if (!key) continue;
    const scored = Number(r.scored) || 0;
    const within = Number(r.within_sla) || 0;
    byBucket.set(key, {
      bucket: key,
      total: Number(r.total) || 0,
      within_sla: within,
      breached: Number(r.breached) || 0,
      scored,
      // null when no completed/scored WOs — chart gap is intentional
      sla_compliance_pct: scored ? Math.round((within / scored) * 1000) / 10 : null,
      avg_resolution_hours: r.avg_resolution_hours != null ? Number(r.avg_resolution_hours) : null,
      avg_response_hours: r.avg_response_hours != null ? Number(r.avg_response_hours) : null,
    });
  }

  const points = buildTrendBuckets(bounds.from, bounds.to, trunc).map((key) => {
    const hit = byBucket.get(key);
    if (hit) return hit;
    return {
      bucket: key,
      total: 0,
      within_sla: 0,
      breached: 0,
      scored: 0,
      sla_compliance_pct: null,
      avg_resolution_hours: null,
      avg_response_hours: null,
    };
  });

  return {
    period: bounds,
    grain: trunc,
    points,
  };
}

/** YYYY-MM-DD in local calendar from a Date / ISO string / pg date. */
function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC date parts — pg `date` / date_trunc::date arrives as UTC midnight
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateKey(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Continuous day / ISO-week / month keys covering [from, to]. */
function buildTrendBuckets(fromStr, toStr, trunc) {
  const start = parseDateKey(fromStr);
  const end = parseDateKey(toStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const keys = [];
  if (trunc === 'day') {
    const cur = new Date(start);
    while (cur <= end) {
      keys.push(formatDateKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }

  if (trunc === 'week') {
    // Align to Monday of the week containing `from` (ISO-ish, matching Postgres date_trunc('week'))
    const cur = new Date(start);
    const dow = cur.getUTCDay(); // 0 Sun … 6 Sat
    const toMon = dow === 0 ? -6 : 1 - dow;
    cur.setUTCDate(cur.getUTCDate() + toMon);
    while (cur <= end) {
      keys.push(formatDateKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
    return keys;
  }

  // month
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cur <= endMonth) {
    keys.push(formatDateKey(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return keys;
}

async function getBreaches(filters = {}) {
  await hasVendorSlaRecs();
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const scope = buildScope({ ...filters, dateFrom: bounds.from, dateTo: bounds.to });
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(filters.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;
  const sort = String(filters.sort || 'delay_desc');
  const orderBy =
    sort === 'newest'
      ? 'f.request_start DESC NULLS LAST'
      : sort === 'oldest'
        ? 'f.request_start ASC NULLS LAST'
        : sort === 'vendor'
          ? 'f.vendor_name ASC'
          : sort === 'asset'
            ? 'f.asset_id ASC'
            : 'f.delay_hours DESC NULLS LAST';

  const countSql = `
    ${factCteSql(scope)}
    SELECT COUNT(*)::int AS total FROM fact f WHERE f.sla_status = 'breached'
  `;
  const dataSql = `
    ${factCteSql(scope)}
    SELECT f.* FROM fact f
    WHERE f.sla_status = 'breached'
    ORDER BY ${orderBy}
    LIMIT $${scope.paramCount + 1} OFFSET $${scope.paramCount + 2}
  `;
  const [countR, dataR, byVendor, byType, byMonth] = await Promise.all([
    db.query(countSql, scope.params),
    db.query(dataSql, [...scope.params, pageSize, offset]),
    db.query(
      `
        ${factCteSql(scope)}
        SELECT f.vendor_id, f.vendor_name, COUNT(*)::int AS breaches
        FROM fact f WHERE f.sla_status = 'breached' AND f.vendor_id IS NOT NULL
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20
      `,
      scope.params,
    ),
    db.query(
      `
        ${factCteSql(scope)}
        SELECT f.asset_type_id, f.asset_type_name, COUNT(*)::int AS breaches
        FROM fact f WHERE f.sla_status = 'breached'
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20
      `,
      scope.params,
    ),
    db.query(
      `
        ${factCteSql(scope)}
        SELECT date_trunc('month', f.request_start)::date AS month, COUNT(*)::int AS breaches
        FROM fact f WHERE f.sla_status = 'breached' AND f.request_start IS NOT NULL
        GROUP BY 1 ORDER BY 1
      `,
      scope.params,
    ),
  ]);

  const total = Number(countR.rows[0]?.total) || 0;
  return {
    period: bounds,
    rows: dataR.rows.map(mapRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    byVendor: byVendor.rows,
    byAssetType: byType.rows,
    byMonth: byMonth.rows,
  };
}

async function getVendors(filters = {}) {
  await hasVendorSlaRecs();
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const scope = buildScope({ ...filters, dateFrom: bounds.from, dateTo: bounds.to });
  const statusFilter = applySlaStatusFilter(filters);

  const sql = `
    ${factCteSql(scope)}
    SELECT
      f.vendor_id,
      f.vendor_name,
      COUNT(*)::int AS requests,
      COUNT(*) FILTER (WHERE f.sla_status = 'within_sla')::int AS within_sla,
      COUNT(*) FILTER (WHERE f.sla_status = 'breached')::int AS breaches,
      COUNT(*) FILTER (WHERE f.sla_status IN ('within_sla','breached'))::int AS scored,
      AVG(f.resolution_hours) FILTER (WHERE f.resolution_hours IS NOT NULL) AS avg_resolution_hours,
      AVG(f.recorded_response_hours) FILTER (WHERE f.recorded_response_hours IS NOT NULL) AS avg_response_hours,
      AVG(f.sla_rating) FILTER (WHERE f.sla_rating IS NOT NULL) AS avg_rating,
      COUNT(*) FILTER (WHERE f.sla_rating IS NOT NULL)::int AS rating_count
    FROM fact f
    WHERE f.vendor_id IS NOT NULL ${statusFilter}
    GROUP BY 1, 2
    ORDER BY breaches DESC, requests DESC
  `;
  const { rows } = await db.query(sql, scope.params);

  // Repeat failures linked by vendor via AMS in period (approx: breakdowns on assets this vendor served)
  const repeatSql = `
    SELECT ams.vendor_id, COUNT(*)::int AS related_breakdowns
    FROM "tblAssetBRDet" br
    INNER JOIN "tblAssetMaintSch" ams
      ON ams.asset_id = br.asset_id AND ams.org_id = br.org_id AND ams.vendor_id IS NOT NULL
    WHERE br.org_id = $1
      AND br.created_on::date BETWEEN $2::date AND $3::date
    GROUP BY 1
  `;
  const repeatR = await db.query(repeatSql, [filters.orgId, bounds.from, bounds.to]).catch(() => ({ rows: [] }));
  const repeatMap = Object.fromEntries(repeatR.rows.map((r) => [r.vendor_id, Number(r.related_breakdowns) || 0]));

  return {
    period: bounds,
    rows: rows.map((r) => {
      const scored = Number(r.scored) || 0;
      const within = Number(r.within_sla) || 0;
      return {
        vendor_id: r.vendor_id,
        vendor_name: r.vendor_name,
        requests: Number(r.requests) || 0,
        breaches: Number(r.breaches) || 0,
        within_sla: within,
        sla_compliance_pct: scored ? Math.round((within / scored) * 1000) / 10 : null,
        avg_resolution_hours: r.avg_resolution_hours != null ? Number(r.avg_resolution_hours) : null,
        avg_response_hours: r.avg_response_hours != null ? Number(r.avg_response_hours) : null,
        avg_resolution_label: hoursLabel(r.avg_resolution_hours),
        avg_response_label: hoursLabel(r.avg_response_hours),
        avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
        rating_count: Number(r.rating_count) || 0,
        repeat_failures: repeatMap[r.vendor_id] || 0,
      };
    }),
  };
}

async function getVendorDetail(filters = {}) {
  const vendorId = filters.vendorId;
  if (!vendorId) {
    const err = new Error('vendorId is required');
    err.status = 400;
    throw err;
  }
  const list = await getVendors({ ...filters, vendorIds: [vendorId] });
  const vendor = list.rows[0] || {
    vendor_id: vendorId,
    vendor_name: 'Unknown',
    requests: 0,
    breaches: 0,
    sla_compliance_pct: null,
  };
  const trends = await getTrends({ ...filters, vendorIds: [vendorId] });
  const breaches = await getBreaches({ ...filters, vendorIds: [vendorId], page: 1, pageSize: 50 });
  return { period: list.period, vendor, trends: trends.points, breaches: breaches.rows };
}

async function getRepeatFailureStats(filters = {}) {
  const db = getDb();
  const sql = `
    WITH br AS (
      SELECT
        br.asset_id,
        br.atbrrc_id,
        brc.text AS reason,
        br.created_on
      FROM "tblAssetBRDet" br
      LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = br.atbrrc_id
      WHERE br.org_id = $1
        AND br.created_on::date BETWEEN $2::date AND $3::date
    ),
    by_asset AS (
      SELECT asset_id, COUNT(*)::int AS failure_count
      FROM br GROUP BY 1 HAVING COUNT(*) >= 2
    )
    SELECT
      (SELECT COUNT(*)::int FROM by_asset) AS asset_count,
      (SELECT COUNT(*)::int FROM br) AS event_count,
      (SELECT reason FROM br WHERE reason IS NOT NULL GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 1) AS top_reason
  `;
  const { rows } = await db.query(sql, [filters.orgId, filters.dateFrom, filters.dateTo]);
  return {
    asset_count: Number(rows[0]?.asset_count) || 0,
    event_count: Number(rows[0]?.event_count) || 0,
    top_reason: rows[0]?.top_reason || null,
  };
}

async function getRepeatFailures(filters = {}) {
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const params = [filters.orgId, bounds.from, bounds.to];
  let i = 3;
  let extra = '';
  const assetTypeIds = parseList(filters.assetTypeIds);
  if (assetTypeIds.length) {
    i += 1;
    extra += ` AND a.asset_type_id = ANY($${i}::text[])`;
    params.push(assetTypeIds);
  }
  const reasonIds = parseList(filters.reasonIds);
  if (reasonIds.length) {
    i += 1;
    extra += ` AND br.atbrrc_id = ANY($${i}::text[])`;
    params.push(reasonIds);
  }

  const sql = `
    WITH br AS (
      SELECT
        br.abr_id,
        br.asset_id,
        br.atbrrc_id,
        brc.text AS reason,
        br.created_on,
        br.status,
        a.serial_number,
        at.text AS asset_type_name
      FROM "tblAssetBRDet" br
      LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = br.atbrrc_id
      LEFT JOIN "tblAssets" a ON a.asset_id = br.asset_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE br.org_id = $1
        AND br.created_on::date BETWEEN $2::date AND $3::date
        ${extra}
    ),
    agg AS (
      SELECT
        asset_id,
        MAX(serial_number) AS serial_number,
        MAX(asset_type_name) AS asset_type_name,
        COUNT(*)::int AS failure_count,
        MAX(created_on) AS last_failure,
        (ARRAY_AGG(reason ORDER BY created_on DESC NULLS LAST)
          FILTER (WHERE reason IS NOT NULL))[1] AS primary_reason
      FROM br
      GROUP BY asset_id
      HAVING COUNT(*) >= 2
    )
    SELECT
      agg.*,
      (
        SELECT v.vendor_name
        FROM "tblAssetMaintSch" ams
        LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
        WHERE ams.asset_id = agg.asset_id AND ams.org_id = $1 AND ams.vendor_id IS NOT NULL
        ORDER BY ams.created_on DESC NULLS LAST
        LIMIT 1
      ) AS vendor_name,
      (
        SELECT COUNT(*)::int
        FROM "tblAssetMaintSch" ams
        WHERE ams.asset_id = agg.asset_id AND ams.org_id = $1
          AND ams.status NOT IN ('CO', 'CA')
      ) AS open_requests
    FROM agg
    ORDER BY failure_count DESC, last_failure DESC NULLS LAST
    LIMIT 100
  `;

  const reasonsSql = `
    SELECT brc.text AS reason, COUNT(*)::int AS occurrences
    FROM "tblAssetBRDet" br
    LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = br.atbrrc_id
    WHERE br.org_id = $1 AND br.created_on::date BETWEEN $2::date AND $3::date
      AND brc.text IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 15
  `;

  const trendSql = `
    SELECT date_trunc('month', br.created_on)::date AS bucket, COUNT(*)::int AS failures
    FROM "tblAssetBRDet" br
    WHERE br.org_id = $1 AND br.created_on::date BETWEEN $2::date AND $3::date
    GROUP BY 1 ORDER BY 1
  `;

  const [assets, reasons, trend, stats] = await Promise.all([
    db.query(sql, params),
    db.query(reasonsSql, [filters.orgId, bounds.from, bounds.to]),
    db.query(trendSql, [filters.orgId, bounds.from, bounds.to]),
    getRepeatFailureStats({ orgId: filters.orgId, dateFrom: bounds.from, dateTo: bounds.to }),
  ]);

  return {
    period: bounds,
    overview: stats,
    assets: assets.rows,
    reasons: reasons.rows,
    trend: trend.rows,
  };
}

async function getServiceQuality(filters = {}) {
  await hasVendorSlaRecs();
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const scope = buildScope({ ...filters, dateFrom: bounds.from, dateTo: bounds.to });

  const sql = `
    ${factCteSql(scope)}
    SELECT
      f.vendor_id,
      f.vendor_name,
      AVG(f.sla_rating) FILTER (WHERE f.sla_rating IS NOT NULL) AS avg_rating,
      COUNT(*) FILTER (WHERE f.sla_rating IS NOT NULL)::int AS rating_count,
      COUNT(*)::int AS requests
    FROM fact f
    WHERE f.vendor_id IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) FILTER (WHERE f.sla_rating IS NOT NULL) > 0
    ORDER BY avg_rating DESC NULLS LAST, rating_count DESC
  `;
  const { rows } = await db.query(sql, scope.params);
  return {
    period: bounds,
    rating_data_available: rows.length > 0,
    message: rows.length
      ? null
      : 'Rating data unavailable for selected period. Ratings are captured as sla_rating on maintenance Vendor SLA records during supervisor approval.',
    rows: rows.map((r) => ({
      vendor_id: r.vendor_id,
      vendor_name: r.vendor_name,
      avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      rating_count: Number(r.rating_count) || 0,
      requests: Number(r.requests) || 0,
    })),
  };
}

async function getDetails(filters = {}) {
  await hasVendorSlaRecs();
  const db = getDb();
  const bounds = resolvePeriod(filters.period, filters.dateFrom, filters.dateTo);
  const scope = buildScope({ ...filters, dateFrom: bounds.from, dateTo: bounds.to });
  const statusFilter = applySlaStatusFilter(filters);
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(filters.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;
  let searchSql = '';
  const params = [...scope.params];
  if (filters.search) {
    const idx = params.length + 1;
    searchSql = ` AND (
      f.request_id ILIKE $${idx}
      OR f.ams_id ILIKE $${idx}
      OR f.asset_id ILIKE $${idx}
      OR COALESCE(f.serial_number,'') ILIKE $${idx}
      OR f.vendor_name ILIKE $${idx}
    )`;
    params.push(`%${String(filters.search).trim()}%`);
  }

  const countSql = `
    ${factCteSql(scope)}
    SELECT COUNT(*)::int AS total FROM fact f WHERE 1=1 ${statusFilter} ${searchSql}
  `;
  const limIdx = params.length + 1;
  const dataSql = `
    ${factCteSql(scope)}
    SELECT f.* FROM fact f
    WHERE 1=1 ${statusFilter} ${searchSql}
    ORDER BY f.request_start DESC NULLS LAST
    LIMIT $${limIdx} OFFSET $${limIdx + 1}
  `;
  const [countR, dataR] = await Promise.all([
    db.query(countSql, params),
    db.query(dataSql, [...params, pageSize, offset]),
  ]);
  const total = Number(countR.rows[0]?.total) || 0;
  return {
    period: bounds,
    rows: dataR.rows.map(mapRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
  };
}

module.exports = {
  parseList,
  resolvePeriod,
  hoursLabel,
  getFilterOptions,
  getSummary,
  getTrends,
  getBreaches,
  getVendors,
  getVendorDetail,
  getRepeatFailures,
  getServiceQuality,
  getDetails,
};
