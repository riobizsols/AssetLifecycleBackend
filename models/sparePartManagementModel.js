const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

/** Extract spc_id from JSON remarks {"spc_id":"..."} or legacy text. */
const SPC_FROM_REMARKS = `
  COALESCE(
    NULLIF(BTRIM((CASE
      WHEN si.remarks ~ '^\\s*\\{' THEN si.remarks::json->>'spc_id'
      ELSE NULL
    END)), ''),
    NULLIF(BTRIM(SUBSTRING(si.remarks FROM 'spc_id[=:]\\s*([^;,\\s}"]+)')), ''),
    ind.spc_id
  )
`;

function parseDays(value, fallback = 180) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function appendLikeFilter(params, sql, expr, value) {
  const text = String(value || '').trim();
  if (!text) return sql;
  params.push(`%${text}%`);
  return `${sql} AND ${expr} ILIKE $${params.length}`;
}

async function getSparePartManagementSummary(orgId, branchId = null, hasSuperAccess = false) {
  const db = getDb();
  const params = [orgId];
  let branchSql = '';
  if (branchId && !hasSuperAccess) {
    params.push(branchId);
    branchSql = ` AND si.branch_id = $${params.length}`;
  }

  const [onHand, issued, pending, categories] = await Promise.all([
    db.query(
      `
      SELECT COUNT(*)::int AS qty
      FROM "tblSPIndDet"
      WHERE org_id = $1 AND COALESCE(is_used, 0) = 0
    `,
      [orgId],
    ),
    db.query(
      `
      SELECT COALESCE(SUM(si.quantity_issued), 0)::numeric AS qty,
             COUNT(*)::int AS txn_count
      FROM "tblSpareIssue" si
      WHERE si.org_id = $1
        AND si.status = 'IE'
        AND si.created_on >= CURRENT_DATE - INTERVAL '30 days'
        ${branchSql}
    `,
      params,
    ),
    db.query(
      `
      SELECT COUNT(*)::int AS qty
      FROM "tblSpareIssue" si
      WHERE si.org_id = $1
        AND si.status IN ('RQ', 'IS')
        ${branchSql}
    `,
      params,
    ),
    db.query(
      `
      SELECT COUNT(*)::int AS qty
      FROM "tblSPCategory"
      WHERE org_id = $1 AND COALESCE(int_status, 1) = 1
    `,
      [orgId],
    ),
  ]);

  return {
    on_hand_units: onHand.rows[0]?.qty || 0,
    issued_last_30_days: Number(issued.rows[0]?.qty || 0),
    issue_txn_last_30_days: issued.rows[0]?.txn_count || 0,
    pending_approvals: pending.rows[0]?.qty || 0,
    active_categories: categories.rows[0]?.qty || 0,
  };
}

async function getSlowNonMovingInventory(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const thresholdDays = parseDays(opts.thresholdDays, 180);
  const params = [orgId, thresholdDays];
  let branchSql = '';
  if (opts.branchId && !opts.hasSuperAccess) {
    params.push(opts.branchId);
    branchSql = ` AND (lot.branch_id IS NULL OR lot.branch_id = $${params.length})`;
  }
  const invoiceSql = appendLikeFilter(
    params,
    '',
    `COALESCE(lot.invoice_no, '')`,
    opts.invoiceNumber,
  );
  let poSql = '';
  const poText = String(opts.poNumber || '').trim();
  if (poText) {
    params.push(`%${poText}%`);
    poSql = `
      AND s.spc_id IN (
        SELECT ${SPC_FROM_REMARKS}
        FROM "tblSpareIssue" si
        LEFT JOIN "tblSPIndDet" ind ON ind.spid_id = si.spid_id
        LEFT JOIN "tblAssetMaintSch" ams ON ams.ams_id = si.assetmaintsch_id
        LEFT JOIN "tblAssets" a ON a.asset_id = COALESCE(si.asset_id, ams.asset_id)
        WHERE si.org_id = $1
          AND COALESCE(a.po_number, ams.po_number, '') ILIKE $${params.length}
      )`;
  }

  const { rows } = await db.query(
    `
    WITH stock AS (
      SELECT
        ind.spc_id,
        c.text AS category_name,
        COALESCE(NULLIF(BTRIM(c.uom), ''), u.uom) AS uom,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS on_hand,
        MAX(ind.created_on) FILTER (WHERE COALESCE(ind.is_used, 0) = 0) AS last_receipt_on
      FROM "tblSPIndDet" ind
      LEFT JOIN "tblSPLotDet" lot ON lot.spld_id = ind.spld_id
      LEFT JOIN "tblSPCategory" c ON c.spc_id = ind.spc_id AND c.org_id = ind.org_id
      LEFT JOIN "tblUom" u ON u.uom_id = NULLIF(BTRIM(c.uom), '')
      WHERE ind.org_id = $1
        AND ind.spc_id IS NOT NULL
        ${branchSql}
        ${invoiceSql}
      GROUP BY ind.spc_id, c.text, COALESCE(NULLIF(BTRIM(c.uom), ''), u.uom)
      HAVING COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0) > 0
    ),
    last_issue AS (
      SELECT
        ${SPC_FROM_REMARKS} AS spc_id,
        MAX(si.created_on) FILTER (WHERE si.status = 'IE') AS last_issue_on,
        COUNT(*) FILTER (
          WHERE si.status = 'IE'
            AND si.created_on >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
        )::int AS issues_in_window
      FROM "tblSpareIssue" si
      LEFT JOIN "tblSPIndDet" ind ON ind.spid_id = si.spid_id
      WHERE si.org_id = $1
      GROUP BY 1
    )
    SELECT
      s.spc_id AS part_code,
      COALESCE(s.category_name, s.spc_id) AS description,
      s.category_name AS category,
      s.uom,
      s.on_hand,
      s.on_hand AS available,
      s.last_receipt_on::date AS last_receipt_date,
      li.last_issue_on::date AS last_consumption_date,
      CASE
        WHEN li.last_issue_on IS NULL THEN NULL
        ELSE (CURRENT_DATE - li.last_issue_on::date)
      END AS days_since_last_consumption,
      COALESCE(li.issues_in_window, 0) AS issues_in_analysis_period,
      CASE
        WHEN li.last_issue_on IS NULL THEN 'Non-moving'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > $2 THEN 'Non-moving'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > GREATEST(30, ($2::int / 2)) THEN 'Slow'
        ELSE 'Fast'
      END AS fsn_class,
      CASE
        WHEN li.last_issue_on IS NULL OR (CURRENT_DATE - li.last_issue_on::date) > $2
          THEN true
        ELSE false
      END AS dead_stock_flag,
      CASE
        WHEN li.last_issue_on IS NULL THEN 'Never issued'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > 730 THEN '730+ days'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > 365 THEN '365–730 days'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > 180 THEN '180–365 days'
        WHEN (CURRENT_DATE - li.last_issue_on::date) > 90 THEN '90–180 days'
        ELSE 'Under 90 days'
      END AS age_bucket,
      'Review stock' AS suggested_action
    FROM stock s
    LEFT JOIN last_issue li ON li.spc_id = s.spc_id
    WHERE 1 = 1
      ${poSql}
    ORDER BY
      CASE WHEN li.last_issue_on IS NULL THEN 0 ELSE 1 END,
      days_since_last_consumption DESC NULLS FIRST,
      s.on_hand DESC
    LIMIT 500
  `,
    params,
  );

  const summary = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.fsn_class === 'Fast') acc.fast += 1;
      else if (r.fsn_class === 'Slow') acc.slow += 1;
      else acc.nonMoving += 1;
      if (r.dead_stock_flag) acc.deadStock += 1;
      return acc;
    },
    { total: 0, fast: 0, slow: 0, nonMoving: 0, deadStock: 0 },
  );

  return { rows, summary, thresholdDays };
}

async function getSpareConsumption(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const dateFrom = opts.dateFrom || null;
  const dateTo = opts.dateTo || null;
  const params = [orgId];
  let dateSql = '';
  if (dateFrom) {
    params.push(dateFrom);
    dateSql += ` AND si.created_on::date >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    dateSql += ` AND si.created_on::date <= $${params.length}::date`;
  }
  if (opts.branchId && !opts.hasSuperAccess) {
    params.push(opts.branchId);
    dateSql += ` AND si.branch_id = $${params.length}`;
  }
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.po_number, ams.po_number, '')`,
    opts.poNumber,
  );
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.invoice_number, lot.invoice_no, '')`,
    opts.invoiceNumber,
  );

  const { rows } = await db.query(
    `
    SELECT
      si.si_id AS issue_number,
      si.created_on AS posting_datetime,
      CASE si.status
        WHEN 'IE' THEN 'WO consumption'
        WHEN 'IS' THEN 'Reserved'
        WHEN 'RQ' THEN 'Requested'
        ELSE si.status
      END AS transaction_type,
      si.quantity_issued AS quantity_issued,
      si.quantity_issued AS quantity_net,
      ${SPC_FROM_REMARKS} AS part_code,
      c.text AS part_description,
      c.text AS category,
      COALESCE(NULLIF(BTRIM(c.uom), ''), u.uom) AS uom,
      a.asset_id,
      a.text AS asset_name,
      a.serial_number,
      at.text AS asset_type,
      mt.text AS maintenance_type,
      si.assetmaintsch_id AS work_order,
      b.text AS branch,
      d.text AS department,
      si.remarks
    FROM "tblSpareIssue" si
    LEFT JOIN "tblSPIndDet" ind ON ind.spid_id = si.spid_id
    LEFT JOIN "tblSPLotDet" lot ON lot.spld_id = ind.spld_id
    LEFT JOIN "tblSPCategory" c ON c.spc_id = (${SPC_FROM_REMARKS})
      AND c.org_id = si.org_id
    LEFT JOIN "tblUom" u ON u.uom_id = NULLIF(BTRIM(c.uom), '')
    LEFT JOIN "tblAssetMaintSch" ams ON ams.ams_id = si.assetmaintsch_id
    LEFT JOIN "tblAssets" a ON a.asset_id = COALESCE(si.asset_id, ams.asset_id)
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
    LEFT JOIN "tblBranches" b ON b.branch_id = si.branch_id
    LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
    WHERE si.org_id = $1
      AND si.status = 'IE'
      ${dateSql}
    ORDER BY si.created_on DESC
    LIMIT 1000
  `,
    params,
  );

  const summary = rows.reduce(
    (acc, r) => {
      acc.txn += 1;
      acc.qty += Number(r.quantity_net || 0);
      return acc;
    },
    { txn: 0, qty: 0 },
  );

  return { rows, summary, dateFrom, dateTo };
}

async function getEquipmentWiseConsumption(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const dateFrom = opts.dateFrom || null;
  const dateTo = opts.dateTo || null;
  const params = [orgId];
  let dateSql = '';
  if (dateFrom) {
    params.push(dateFrom);
    dateSql += ` AND si.created_on::date >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    dateSql += ` AND si.created_on::date <= $${params.length}::date`;
  }
  if (opts.branchId && !opts.hasSuperAccess) {
    params.push(opts.branchId);
    dateSql += ` AND si.branch_id = $${params.length}`;
  }
  if (opts.assetId) {
    params.push(opts.assetId);
    dateSql += ` AND a.asset_id = $${params.length}`;
  }
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.po_number, ams.po_number, '')`,
    opts.poNumber,
  );
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.invoice_number, lot.invoice_no, '')`,
    opts.invoiceNumber,
  );

  const { rows } = await db.query(
    `
    WITH issued AS (
      SELECT
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        at.text AS asset_type,
        a.current_status AS asset_status,
        b.text AS branch,
        d.text AS department,
        ${SPC_FROM_REMARKS} AS part_code,
        c.text AS part_description,
        si.si_id,
        si.created_on AS issue_date,
        si.quantity_issued,
        si.assetmaintsch_id AS work_order,
        mt.text AS maintenance_type,
        LAG(si.created_on) OVER (
          PARTITION BY a.asset_id, (${SPC_FROM_REMARKS})
          ORDER BY si.created_on
        ) AS previous_issue_on
      FROM "tblSpareIssue" si
      LEFT JOIN "tblAssetMaintSch" ams ON ams.ams_id = si.assetmaintsch_id
      LEFT JOIN "tblAssets" a ON a.asset_id = COALESCE(si.asset_id, ams.asset_id)
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = COALESCE(si.branch_id, a.branch_id)
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblSPIndDet" ind ON ind.spid_id = si.spid_id
      LEFT JOIN "tblSPLotDet" lot ON lot.spld_id = ind.spld_id
      LEFT JOIN "tblSPCategory" c ON c.spc_id = (${SPC_FROM_REMARKS})
        AND c.org_id = si.org_id
      WHERE si.org_id = $1
        AND si.status = 'IE'
        AND a.asset_id IS NOT NULL
        ${dateSql}
    )
    SELECT
      asset_id,
      asset_name,
      serial_number,
      asset_type,
      asset_status,
      branch,
      department,
      part_code,
      part_description,
      si_id AS issue_number,
      issue_date::date AS issue_date,
      quantity_issued,
      work_order,
      maintenance_type,
      previous_issue_on::date AS previous_replacement_date,
      CASE
        WHEN previous_issue_on IS NULL THEN NULL
        ELSE (issue_date::date - previous_issue_on::date)
      END AS days_since_prior_replacement,
      COUNT(*) OVER (PARTITION BY asset_id, part_code) AS cumulative_replacements
    FROM issued
    ORDER BY asset_id, part_code, issue_date DESC
    LIMIT 1000
  `,
    params,
  );

  const byAsset = rows.reduce((acc, r) => {
    if (!acc[r.asset_id]) {
      acc[r.asset_id] = {
        asset_id: r.asset_id,
        asset_name: r.asset_name,
        serial_number: r.serial_number,
        asset_type: r.asset_type,
        lines: 0,
        qty: 0,
      };
    }
    acc[r.asset_id].lines += 1;
    acc[r.asset_id].qty += Number(r.quantity_issued || 0);
    return acc;
  }, {});

  return {
    rows,
    summary: {
      assets: Object.keys(byAsset).length,
      lines: rows.length,
      qty: rows.reduce((s, r) => s + Number(r.quantity_issued || 0), 0),
    },
    byAsset: Object.values(byAsset),
    dateFrom,
    dateTo,
  };
}

/**
 * Person-level hold duration: time from when a spare was reserved/handed out (IS)
 * until it was confirmed consumed (IE). Still-reserved lines use NOW as the end.
 * Same product can show A finishing in ~1 hour and B holding ~1 day.
 */
async function getHoldDuration(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const dateFrom = opts.dateFrom || null;
  const dateTo = opts.dateTo || null;
  const params = [orgId];
  let dateSql = '';
  if (dateFrom) {
    params.push(dateFrom);
    dateSql += ` AND si.created_on::date >= $${params.length}::date`;
  }
  if (dateTo) {
    params.push(dateTo);
    dateSql += ` AND si.created_on::date <= $${params.length}::date`;
  }
  if (opts.branchId && !opts.hasSuperAccess) {
    params.push(opts.branchId);
    dateSql += ` AND si.branch_id = $${params.length}`;
  }
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.po_number, ams.po_number, '')`,
    opts.poNumber,
  );
  dateSql = appendLikeFilter(
    params,
    dateSql,
    `COALESCE(a.invoice_number, lot.invoice_no, '')`,
    opts.invoiceNumber,
  );

  const { rows } = await db.query(
    `
    WITH hist AS (
      SELECT
        h.si_id,
        MIN(h.created_on) FILTER (WHERE h.status = 'IS') AS reserved_on,
        MIN(h.created_on) FILTER (WHERE h.status = 'IE') AS consumed_on
      FROM "tblSpareHistory" h
      WHERE h.org_id = $1
      GROUP BY h.si_id
    )
    SELECT
      si.si_id AS issue_number,
      COALESCE(NULLIF(BTRIM(si.issued_to), ''), si.issued_by, 'Unassigned') AS holder,
      si.issued_by,
      ${SPC_FROM_REMARKS} AS part_code,
      c.text AS part_description,
      COALESCE(NULLIF(BTRIM(c.uom), ''), u.uom) AS uom,
      si.quantity_issued,
      a.asset_id,
      a.text AS asset_name,
      a.serial_number,
      si.assetmaintsch_id AS work_order,
      b.text AS branch,
      CASE si.status
        WHEN 'IE' THEN 'Consumed'
        WHEN 'IS' THEN 'In hand'
        WHEN 'RQ' THEN 'Requested'
        ELSE si.status
      END AS hold_status,
      COALESCE(hist.reserved_on, si.created_on) AS handed_out_at,
      CASE
        WHEN si.status = 'IE' THEN COALESCE(hist.consumed_on, si.changed_on, si.created_on)
        WHEN si.status = 'IS' THEN CURRENT_TIMESTAMP
        ELSE NULL
      END AS finished_at,
      CASE
        WHEN si.status IN ('IS', 'IE') THEN
          EXTRACT(EPOCH FROM (
            CASE
              WHEN si.status = 'IE' THEN COALESCE(hist.consumed_on, si.changed_on, si.created_on)
              ELSE CURRENT_TIMESTAMP
            END
            - COALESCE(hist.reserved_on, si.created_on)
          ))
        ELSE NULL
      END AS hold_seconds,
      CASE
        WHEN si.status IN ('IS', 'IE') THEN
          ROUND(
            EXTRACT(EPOCH FROM (
              CASE
                WHEN si.status = 'IE' THEN COALESCE(hist.consumed_on, si.changed_on, si.created_on)
                ELSE CURRENT_TIMESTAMP
              END
              - COALESCE(hist.reserved_on, si.created_on)
            )) / 3600.0
          , 2)
        ELSE NULL
      END AS hold_hours,
      CASE
        WHEN si.status NOT IN ('IS', 'IE') THEN NULL
        WHEN EXTRACT(EPOCH FROM (
          CASE
            WHEN si.status = 'IE' THEN COALESCE(hist.consumed_on, si.changed_on, si.created_on)
            ELSE CURRENT_TIMESTAMP
          END
          - COALESCE(hist.reserved_on, si.created_on)
        )) < 2 * 3600 THEN 'Fast use'
        WHEN EXTRACT(EPOCH FROM (
          CASE
            WHEN si.status = 'IE' THEN COALESCE(hist.consumed_on, si.changed_on, si.created_on)
            ELSE CURRENT_TIMESTAMP
          END
          - COALESCE(hist.reserved_on, si.created_on)
        )) < 24 * 3600 THEN 'Same day'
        ELSE 'Long hold'
      END AS speed_class
    FROM "tblSpareIssue" si
    LEFT JOIN hist ON hist.si_id = si.si_id
    LEFT JOIN "tblSPIndDet" ind ON ind.spid_id = si.spid_id
    LEFT JOIN "tblSPLotDet" lot ON lot.spld_id = ind.spld_id
    LEFT JOIN "tblSPCategory" c ON c.spc_id = (${SPC_FROM_REMARKS})
      AND c.org_id = si.org_id
    LEFT JOIN "tblUom" u ON u.uom_id = NULLIF(BTRIM(c.uom), '')
    LEFT JOIN "tblAssetMaintSch" ams ON ams.ams_id = si.assetmaintsch_id
    LEFT JOIN "tblAssets" a ON a.asset_id = COALESCE(si.asset_id, ams.asset_id)
    LEFT JOIN "tblBranches" b ON b.branch_id = si.branch_id
    WHERE si.org_id = $1
      AND si.status IN ('IS', 'IE')
      ${dateSql}
    ORDER BY hold_seconds DESC NULLS LAST, si.created_on DESC
    LIMIT 1000
  `,
    params,
  );

  const summary = rows.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.hold_status === 'In hand') acc.inHand += 1;
      if (r.hold_status === 'Consumed') acc.consumed += 1;
      if (r.speed_class === 'Fast use') acc.fastUse += 1;
      if (r.speed_class === 'Same day') acc.sameDay += 1;
      if (r.speed_class === 'Long hold') acc.longHold += 1;
      if (r.hold_hours != null) {
        acc.hoursSum += Number(r.hold_hours);
        acc.hoursCount += 1;
      }
      return acc;
    },
    {
      total: 0,
      inHand: 0,
      consumed: 0,
      fastUse: 0,
      sameDay: 0,
      longHold: 0,
      hoursSum: 0,
      hoursCount: 0,
    },
  );
  summary.avg_hold_hours =
    summary.hoursCount > 0
      ? Math.round((summary.hoursSum / summary.hoursCount) * 100) / 100
      : null;

  return { rows, summary, dateFrom, dateTo };
}

module.exports = {
  getSparePartManagementSummary,
  getSlowNonMovingInventory,
  getSpareConsumption,
  getEquipmentWiseConsumption,
  getHoldDuration,
};
