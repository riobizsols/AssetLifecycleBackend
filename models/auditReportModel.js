/**
 * Audit Reports — aggregate asset evidence for a chosen audit type + period.
 * Uses tblAuditType / tblAuditATMapping + existing maint / BR / docs / asset tables.
 * Excludes rows tagged by scripts/seed-audit-report-demo-data.js ([Audit Demo] / audit-demo).
 */
const { getDbFromContext } = require('../utils/dbContext');
const { ensureAuditTablesSchema } = require('../utils/ensureAuditTablesSchema');

const getDb = () => getDbFromContext();

/** Seed markers from seed-audit-report-demo-data.js — never show these as audit evidence. */
const DEMO_NOTE = '[Audit Demo]';
const DEMO_DOC_PATH = '%audit-demo%';
const DEMO_TECH = 'Demo Technician';
const DEMO_ASSET_INV = /^INV-AUD-\d+$/i;
const DEMO_MAINT_INV = /^MINV-/i;
const DEMO_MAINT_PO = /^MPO-/i;

function isDemoAssetInvoice(invoiceNo) {
  return DEMO_ASSET_INV.test(String(invoiceNo || '').trim());
}

function isDemoMaintInvoice(invoiceNo) {
  return DEMO_MAINT_INV.test(String(invoiceNo || '').trim());
}

function isDemoMaintPo(poNumber) {
  return DEMO_MAINT_PO.test(String(poNumber || '').trim());
}

const REOPEN_MARKER = '[Reopened:';

/** Ensure downtime columns used by audit breakdown enrichment exist. */
async function ensureBreakdownReportColumns(db) {
  await db.query(`
    ALTER TABLE "tblATMaintFreq"
    ADD COLUMN IF NOT EXISTS downtime DECIMAL(10,2)
  `);
  await db.query(`
    ALTER TABLE "tblAssetMaintSch"
    ADD COLUMN IF NOT EXISTS actual_downtime DECIMAL(10,2)
  `);
  await db.query(`
    ALTER TABLE "tblAssetBRDet"
    ADD COLUMN IF NOT EXISTS dept_id character varying(50)
  `);
  await db.query(`
    ALTER TABLE "tblAssetBRDet"
    ADD COLUMN IF NOT EXISTS reopen_notes text
  `);
}

function resolvePeriodBounds(period, dateFrom, dateTo) {
  const now = new Date();
  const y = now.getFullYear();
  if (period === 'current_year') {
    return {
      from: `${y}-01-01`,
      to: `${y}-12-31`,
      label: `Current year (${y})`,
    };
  }
  if (period === 'last_year') {
    return {
      from: `${y - 1}-01-01`,
      to: `${y - 1}-12-31`,
      label: `Last year (${y - 1})`,
    };
  }
  const from = dateFrom || `${y}-01-01`;
  const to = dateTo || `${y}-12-31`;
  return {
    from,
    to,
    label: `Specific range (${from} → ${to})`,
  };
}

async function listAuditTypes(orgId) {
  const db = getDb();
  await ensureAuditTablesSchema(db);
  const { rows } = await db.query(
    `
      SELECT audtp_id, description, is_internal, int_status
      FROM "tblAuditType"
      WHERE COALESCE(int_status, 1) = 1
        AND (org_id IS NULL OR org_id = $1)
      ORDER BY description ASC, audtp_id ASC
    `,
    [orgId],
  );
  return rows;
}

async function listMappedAssetTypes(orgId, audtpId) {
  const db = getDb();
  await ensureAuditTablesSchema(db);
  const { rows } = await db.query(
    `
      SELECT DISTINCT
        m.assettype_id AS asset_type_id,
        COALESCE(at.text, m.assettype_id) AS asset_type_name
      FROM "tblAuditATMapping" m
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.assettype_id
      WHERE m.audtp_id = $1
        AND COALESCE(m.int_status, 1) = 1
        AND (m.org_id IS NULL OR m.org_id = $2)
      ORDER BY 2 ASC, 1 ASC
    `,
    [audtpId, orgId],
  );
  return rows;
}

async function getAuditType(orgId, audtpId) {
  const db = getDb();
  const { rows } = await db.query(
    `
      SELECT audtp_id, description, is_internal
      FROM "tblAuditType"
      WHERE audtp_id = $1
        AND COALESCE(int_status, 1) = 1
        AND (org_id IS NULL OR org_id = $2)
      LIMIT 1
    `,
    [audtpId, orgId],
  );
  return rows[0] || null;
}

/**
 * Build in-scope assets + optional history sections for the audit report.
 */
async function getAuditReportView(opts) {
  const db = getDb();
  await ensureAuditTablesSchema(db);

  const {
    orgId,
    audtpId,
    assetTypeIds = [],
    period,
    dateFrom = null,
    dateTo = null,
    sections = {},
    branchId = null,
    hasSuperAccess = false,
  } = opts;

  if (!audtpId) {
    const err = new Error('audtp_id is required');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(assetTypeIds) || assetTypeIds.length === 0) {
    const err = new Error('At least one asset type is required');
    err.status = 400;
    throw err;
  }

  const auditType = await getAuditType(orgId, audtpId);
  if (!auditType) {
    const err = new Error('Audit type not found');
    err.status = 404;
    throw err;
  }

  const mapped = await listMappedAssetTypes(orgId, audtpId);
  const mappedSet = new Set(mapped.map((r) => r.asset_type_id));
  const selectedTypes = [...new Set(assetTypeIds)].filter((id) => mappedSet.has(id));
  if (selectedTypes.length === 0) {
    const err = new Error('Selected asset types are not mapped to this audit type');
    err.status = 400;
    throw err;
  }

  const bounds = resolvePeriodBounds(period || 'current_year', dateFrom, dateTo);

  await ensureBreakdownReportColumns(db);

  const include = {
    assetDetails: sections.assetDetails !== false,
    maintenance: sections.maintenance !== false,
    breakdown: sections.breakdown !== false,
    certifications: sections.certifications !== false,
    invoices: sections.invoices !== false,
    purchaseOrders: sections.purchaseOrders !== false,
  };

  const assetParams = [orgId, selectedTypes];
  let branchSql = '';
  if (branchId && !hasSuperAccess) {
    assetParams.push(branchId);
    branchSql = ` AND a.branch_id = $${assetParams.length}`;
  }

  const { rows: assets } = await db.query(
    `
      SELECT
        a.asset_id,
        a.serial_number,
        a.description AS asset_description,
        a.current_status AS asset_status,
        a.purchased_on,
        a.purchased_cost,
        a.invoice_no,
        a.purchase_vendor_id,
        a.service_vendor_id,
        a.branch_id,
        a.dept_id,
        a.asset_type_id,
        at.text AS asset_type_name,
        b.text AS branch_name,
        d.text AS department_name,
        pv.vendor_name AS purchase_vendor_name,
        sv.vendor_name AS service_vendor_name,
        (
          SELECT mf.downtime
          FROM "tblATMaintFreq" mf
          WHERE mf.asset_type_id = a.asset_type_id
            AND mf.org_id = a.org_id
            AND COALESCE(mf.int_status, 1) = 1
            AND mf.downtime IS NOT NULL
          ORDER BY
            CASE WHEN mf.maint_type_id = 'MT004' THEN 0 ELSE 1 END,
            CASE
              WHEN LOWER(COALESCE(mf.text, '')) LIKE '%on demand%' THEN 0
              WHEN LOWER(COALESCE(mf.text, '')) LIKE '%breakdown%' THEN 0
              ELSE 1
            END,
            mf.downtime DESC NULLS LAST
          LIMIT 1
        ) AS expected_downtime_hours
      FROM "tblAssets" a
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
      LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
      WHERE a.org_id = $1
        AND a.asset_type_id = ANY($2::varchar[])
        ${branchSql}
      ORDER BY at.text, a.asset_id
    `,
    assetParams,
  );

  const assetIds = assets.map((a) => a.asset_id);
  const empty = {
    auditType,
    period: {
      type: period || 'current_year',
      from: bounds.from,
      to: bounds.to,
      label: bounds.label,
    },
    assetTypeIds: selectedTypes,
    assetCount: assets.length,
    assets: include.assetDetails ? assets : assets.map((a) => ({
      asset_id: a.asset_id,
      asset_type_id: a.asset_type_id,
      asset_type_name: a.asset_type_name,
      serial_number: a.serial_number,
    })),
    sections: {
      assetDetails: include.assetDetails ? assets : [],
      maintenance: [],
      breakdown: [],
      certifications: [],
      invoices: [],
      purchaseOrders: [],
    },
  };

  if (assetIds.length === 0) {
    return empty;
  }

  const histParams = [orgId, assetIds, bounds.from, bounds.to];

  if (include.maintenance) {
    const { rows } = await db.query(
      `
        SELECT
          ams.ams_id,
          ams.wo_id,
          ams.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          ams.maint_type_id,
          mt.text AS maintenance_type_name,
          ams.act_maint_st_date,
          ams.act_main_end_date,
          ams.status,
          ams.notes,
          ams.po_number,
          ams.invoice,
          ams.technician_name,
          v.vendor_name,
          ams.created_on
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
        LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
        WHERE ams.org_id = $1
          AND ams.asset_id = ANY($2::varchar[])
          AND ams.act_maint_st_date IS NOT NULL
          AND (ams.act_maint_st_date)::timestamp::date BETWEEN $3::date AND $4::date
          AND COALESCE(ams.notes, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
          AND COALESCE(ams.technician_name, '') <> ${`'${DEMO_TECH}'`}
        ORDER BY ams.act_maint_st_date DESC NULLS LAST, ams.ams_id
      `,
      histParams,
    );
    empty.sections.maintenance = rows;
  }

  if (include.breakdown) {
    const reopenMarkerLen = REOPEN_MARKER.length;
    const { rows } = await db.query(
      `
        SELECT
          brd.abr_id,
          brd.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          brd.status AS breakdown_status,
          brd.description AS breakdown_description,
          brd.atbrrc_id,
          brc.text AS breakdown_reason,
          brd.created_on AS breakdown_date,
          u.full_name AS reported_by_name,
          brd.decision_code,
          COALESCE(brd.dept_id, a.dept_id) AS affected_department_id,
          COALESCE(brd_dept.text, asset_dept.text) AS affected_department_name,
          (
            SELECT mf.downtime
            FROM "tblATMaintFreq" mf
            WHERE mf.asset_type_id = a.asset_type_id
              AND mf.org_id = brd.org_id
              AND COALESCE(mf.int_status, 1) = 1
              AND mf.downtime IS NOT NULL
            ORDER BY
              CASE WHEN mf.maint_type_id = 'MT004' THEN 0 ELSE 1 END,
              CASE
                WHEN LOWER(COALESCE(mf.text, '')) LIKE '%on demand%' THEN 0
                WHEN LOWER(COALESCE(mf.text, '')) LIKE '%breakdown%' THEN 0
                ELSE 1
              END,
              mf.downtime DESC NULLS LAST
            LIMIT 1
          ) AS expected_downtime_hours,
          (
            SELECT ams.actual_downtime
            FROM "tblAssetMaintSch" ams
            WHERE ams.org_id = brd.org_id
              AND ams.asset_id = brd.asset_id
              AND ams.actual_downtime IS NOT NULL
              AND (
                (ams.wo_id IS NOT NULL AND ams.wo_id ILIKE '%' || brd.abr_id || '%')
                OR (ams.notes IS NOT NULL AND ams.notes ILIKE '%' || brd.abr_id || '%')
              )
            ORDER BY ams.act_main_end_date DESC NULLS LAST, ams.ams_id DESC
            LIMIT 1
          ) AS actual_downtime_hours,
          (
            (LENGTH(COALESCE(brd.description, ''))
              - LENGTH(REPLACE(COALESCE(brd.description, ''), $5, '')))
            / NULLIF($6, 0)
          )::int AS reopen_count,
          (
            SELECT COUNT(*)::int
            FROM "tblAssetBRDet" br2
            WHERE br2.org_id = brd.org_id
              AND br2.asset_id = brd.asset_id
              AND br2.atbrrc_id IS NOT NULL
              AND brd.atbrrc_id IS NOT NULL
              AND br2.atbrrc_id = brd.atbrrc_id
              AND br2.created_on::date BETWEEN $3::date AND $4::date
              AND COALESCE(br2.description, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
          ) AS same_cause_count_in_period
        FROM "tblAssetBRDet" brd
        INNER JOIN "tblAssets" a ON a.asset_id = brd.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = brd.atbrrc_id
        LEFT JOIN "tblUsers" u ON u.user_id = brd.reported_by
        LEFT JOIN "tblDepartments" brd_dept ON brd_dept.dept_id = brd.dept_id
        LEFT JOIN "tblDepartments" asset_dept ON asset_dept.dept_id = a.dept_id
        WHERE brd.org_id = $1
          AND brd.asset_id = ANY($2::varchar[])
          AND brd.created_on::date BETWEEN $3::date AND $4::date
          AND COALESCE(brd.description, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
        ORDER BY brd.created_on DESC, brd.abr_id
      `,
      [...histParams, REOPEN_MARKER, reopenMarkerLen],
    );
    empty.sections.breakdown = rows.map((row) => {
      const reopenCount = Number(row.reopen_count) || 0;
      const sameCauseCount = Number(row.same_cause_count_in_period) || 0;
      return {
        ...row,
        reopen_count: reopenCount,
        same_cause_count_in_period: sameCauseCount,
        is_repeat_problem: reopenCount > 0 || sameCauseCount > 1,
      };
    });
  }

  if (include.certifications) {
    const { rows } = await db.query(
      `
        SELECT
          ad.a_d_id,
          ad.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          COALESCE(dto.doc_type_text, ad.doc_type_name, dto.doc_type) AS document_type,
          dto.doc_type,
          ad.doc_path,
          ad.is_archived
        FROM "tblAssetDocs" ad
        INNER JOIN "tblAssets" a ON a.asset_id = ad.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblDocTypeObjects" dto ON dto.dto_id = ad.dto_id
        WHERE ad.org_id = $1
          AND ad.asset_id = ANY($2::varchar[])
          AND COALESCE(ad.is_archived, false) = false
          AND COALESCE(ad.doc_path, '') NOT ILIKE ${`'${DEMO_DOC_PATH}'`}
          AND (
            UPPER(COALESCE(dto.doc_type, '')) IN ('IC', 'WA', 'IN', 'CC', 'CT', 'CL')
            OR LOWER(COALESCE(ad.doc_type_name, '')) ~ '(cert|warranty|insurance|inspection|calibrat)'
          )
        ORDER BY a.asset_id, ad.a_d_id
      `,
      [orgId, assetIds],
    );
    empty.sections.certifications = rows;
  }

  if (include.invoices) {
    const invoiceRows = [];

    // Asset-level invoice numbers from tblAssets (skip seed INV-AUD-* placeholders)
    for (const a of assets) {
      if (a.invoice_no && !isDemoAssetInvoice(a.invoice_no)) {
        invoiceRows.push({
          source: 'asset',
          asset_id: a.asset_id,
          serial_number: a.serial_number,
          asset_type_name: a.asset_type_name,
          invoice_no: a.invoice_no,
          purchased_on: a.purchased_on,
          purchased_cost: a.purchased_cost,
          vendor_name: a.purchase_vendor_name,
          doc_path: null,
        });
      }
    }

    // Maintenance invoices in period (tblAssetMaintSch.invoice)
    const { rows: maintInv } = await db.query(
      `
        SELECT
          ams.ams_id AS source_id,
          ams.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          ams.invoice AS invoice_no,
          ams.act_maint_st_date AS purchased_on,
          NULL::numeric AS purchased_cost,
          v.vendor_name,
          NULL::text AS doc_path
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
        WHERE ams.org_id = $1
          AND ams.asset_id = ANY($2::varchar[])
          AND ams.invoice IS NOT NULL AND BTRIM(ams.invoice) <> ''
          AND ams.act_maint_st_date IS NOT NULL
          AND (ams.act_maint_st_date)::timestamp::date BETWEEN $3::date AND $4::date
          AND COALESCE(ams.notes, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
          AND COALESCE(ams.technician_name, '') <> ${`'${DEMO_TECH}'`}
          AND ams.invoice !~* '^MINV-'
      `,
      histParams,
    );
    for (const r of maintInv) {
      if (!isDemoMaintInvoice(r.invoice_no)) {
        invoiceRows.push({ source: 'maintenance', ...r });
      }
    }

    // Invoice documents from tblAssetDocs (real uploads only)
    const { rows: invDocs } = await db.query(
      `
        SELECT
          ad.a_d_id AS source_id,
          ad.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          COALESCE(ad.doc_type_name, dto.doc_type_text, 'Invoice') AS invoice_no,
          NULL::timestamp AS purchased_on,
          NULL::numeric AS purchased_cost,
          pv.vendor_name,
          ad.doc_path
        FROM "tblAssetDocs" ad
        INNER JOIN "tblAssets" a ON a.asset_id = ad.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblDocTypeObjects" dto ON dto.dto_id = ad.dto_id
        LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
        WHERE ad.org_id = $1
          AND ad.asset_id = ANY($2::varchar[])
          AND COALESCE(ad.is_archived, false) = false
          AND COALESCE(ad.doc_path, '') NOT ILIKE ${`'${DEMO_DOC_PATH}'`}
          AND (
            UPPER(COALESCE(dto.doc_type, '')) = 'INV'
            OR LOWER(COALESCE(ad.doc_type_name, '')) LIKE '%invoice%'
          )
      `,
      [orgId, assetIds],
    );
    for (const r of invDocs) {
      invoiceRows.push({ source: 'document', ...r });
    }

    empty.sections.invoices = invoiceRows;
  }

  if (include.purchaseOrders) {
    const poRows = [];

    const { rows: maintPo } = await db.query(
      `
        SELECT
          ams.ams_id AS source_id,
          ams.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          ams.po_number,
          ams.act_maint_st_date AS po_date,
          v.vendor_name,
          NULL::text AS doc_path
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
        WHERE ams.org_id = $1
          AND ams.asset_id = ANY($2::varchar[])
          AND ams.po_number IS NOT NULL AND BTRIM(ams.po_number) <> ''
          AND ams.act_maint_st_date IS NOT NULL
          AND (ams.act_maint_st_date)::timestamp::date BETWEEN $3::date AND $4::date
          AND COALESCE(ams.notes, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
          AND COALESCE(ams.technician_name, '') <> ${`'${DEMO_TECH}'`}
          AND ams.po_number !~* '^MPO-'
      `,
      histParams,
    );
    for (const r of maintPo) {
      if (!isDemoMaintPo(r.po_number)) {
        poRows.push({ source: 'maintenance', ...r });
      }
    }

    const { rows: poDocs } = await db.query(
      `
        SELECT
          ad.a_d_id AS source_id,
          ad.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          COALESCE(ad.doc_type_name, dto.doc_type_text, 'Purchase Order') AS po_number,
          NULL::timestamp AS po_date,
          pv.vendor_name,
          ad.doc_path
        FROM "tblAssetDocs" ad
        INNER JOIN "tblAssets" a ON a.asset_id = ad.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblDocTypeObjects" dto ON dto.dto_id = ad.dto_id
        LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
        WHERE ad.org_id = $1
          AND ad.asset_id = ANY($2::varchar[])
          AND COALESCE(ad.is_archived, false) = false
          AND COALESCE(ad.doc_path, '') NOT ILIKE ${`'${DEMO_DOC_PATH}'`}
          AND (
            UPPER(COALESCE(dto.doc_type, '')) = 'PO'
            OR LOWER(COALESCE(ad.doc_type_name, '')) LIKE '%purchase%order%'
            OR LOWER(COALESCE(ad.doc_type_name, '')) = 'po'
          )
      `,
      [orgId, assetIds],
    );
    for (const r of poDocs) {
      poRows.push({ source: 'document', ...r });
    }

    empty.sections.purchaseOrders = poRows;
  }

  return empty;
}

/**
 * Preventive maintenance compliance for the audit period / asset types.
 * PM Compliance % = PMs completed on time ÷ PMs due × 100
 * Due = scheduled PM in period (act_maint_st_date), not cancelled.
 * On time = status CO and act_main_end_date::date <= act_maint_st_date::date.
 */
async function getPmCompliance(opts) {
  const db = getDb();
  const {
    orgId,
    audtpId,
    assetTypeIds = [],
    period,
    dateFrom = null,
    dateTo = null,
    branchId = null,
    hasSuperAccess = false,
  } = opts;

  if (!audtpId) {
    const err = new Error('audtp_id is required');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(assetTypeIds) || assetTypeIds.length === 0) {
    const err = new Error('At least one asset type is required');
    err.status = 400;
    throw err;
  }

  const auditType = await getAuditType(orgId, audtpId);
  if (!auditType) {
    const err = new Error('Audit type not found');
    err.status = 404;
    throw err;
  }

  const mapped = await listMappedAssetTypes(orgId, audtpId);
  const mappedSet = new Set(mapped.map((r) => r.asset_type_id));
  const selectedTypes = [...new Set(assetTypeIds)].filter((id) => mappedSet.has(id));
  if (selectedTypes.length === 0) {
    const err = new Error('Selected asset types are not mapped to this audit type');
    err.status = 400;
    throw err;
  }

  const bounds = resolvePeriodBounds(period || 'current_year', dateFrom, dateTo);

  const params = [orgId, selectedTypes, bounds.from, bounds.to];
  let branchSql = '';
  if (branchId && !hasSuperAccess) {
    params.push(branchId);
    branchSql = ` AND a.branch_id = $${params.length}`;
  }

  const pmTypeSql = `
    (
      ams.maint_type_id = 'MT006'
      OR LOWER(COALESCE(mt.text, '')) LIKE '%prevent%'
    )
  `;

  const { rows } = await db.query(
    `
      SELECT
        a.branch_id,
        COALESCE(b.text, a.branch_id, 'Unassigned') AS branch_name,
        a.dept_id,
        COALESCE(d.text, a.dept_id, 'Unassigned') AS department_name,
        COUNT(*)::int AS pms_due,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ams.status, '')) = 'CO'
            AND ams.act_main_end_date IS NOT NULL
            AND (ams.act_main_end_date)::timestamp::date
              <= (ams.act_maint_st_date)::timestamp::date
        )::int AS pms_on_time,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ams.status, '')) = 'CO'
            AND (
              ams.act_main_end_date IS NULL
              OR (ams.act_main_end_date)::timestamp::date
                > (ams.act_maint_st_date)::timestamp::date
            )
        )::int AS pms_late,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ams.status, '')) NOT IN ('CO', 'CA')
        )::int AS pms_open
      FROM "tblAssetMaintSch" ams
      INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id AND a.org_id = ams.org_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      WHERE ams.org_id = $1
        AND a.asset_type_id = ANY($2::varchar[])
        AND ams.act_maint_st_date IS NOT NULL
        AND (ams.act_maint_st_date)::timestamp::date BETWEEN $3::date AND $4::date
        AND UPPER(COALESCE(ams.status, '')) <> 'CA'
        AND ${pmTypeSql}
        AND COALESCE(ams.notes, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
        AND COALESCE(ams.technician_name, '') <> ${`'${DEMO_TECH}'`}
        ${branchSql}
      GROUP BY a.branch_id, b.text, a.dept_id, d.text
      ORDER BY 2 ASC, 4 ASC
    `,
    params,
  );

  const byInstitutionDepartment = rows.map((r) => {
    const due = Number(r.pms_due) || 0;
    const onTime = Number(r.pms_on_time) || 0;
    return {
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      dept_id: r.dept_id,
      department_name: r.department_name,
      pms_due: due,
      pms_on_time: onTime,
      pms_late: Number(r.pms_late) || 0,
      pms_open: Number(r.pms_open) || 0,
      pm_compliance_pct: due > 0 ? Math.round((onTime / due) * 1000) / 10 : null,
    };
  });

  const totals = byInstitutionDepartment.reduce(
    (acc, row) => {
      acc.pms_due += row.pms_due;
      acc.pms_on_time += row.pms_on_time;
      acc.pms_late += row.pms_late;
      acc.pms_open += row.pms_open;
      return acc;
    },
    { pms_due: 0, pms_on_time: 0, pms_late: 0, pms_open: 0 },
  );
  totals.pm_compliance_pct =
    totals.pms_due > 0
      ? Math.round((totals.pms_on_time / totals.pms_due) * 1000) / 10
      : null;

  return {
    auditType,
    period: {
      type: period || 'current_year',
      from: bounds.from,
      to: bounds.to,
      label: bounds.label,
    },
    definition: {
      formula: 'PM Compliance % = PMs completed on time ÷ PMs due × 100',
      due: 'Preventive maintenance work orders scheduled in the period (not cancelled)',
      on_time:
        'Completed (CO) with end date on or before the scheduled date',
    },
    totals,
    by_institution_department: byInstitutionDepartment,
  };
}

/**
 * Calibration maintenance detail for Audit Reports:
 * checklist for this schedule's frequency + calibration certificate documents.
 */
async function getCalibrationDetail({ orgId, amsId }) {
  const db = getDb();
  if (!amsId) {
    const err = new Error('ams_id is required');
    err.status = 400;
    throw err;
  }

  const { rows: schedules } = await db.query(
    `
      SELECT
        ams.ams_id,
        ams.wo_id,
        ams.asset_id,
        ams.org_id,
        ams.status,
        ams.notes,
        ams.maint_type_id,
        ams.at_main_freq_id,
        ams.wfamsh_id,
        ams.act_maint_st_date,
        ams.act_main_end_date,
        ams.technician_name,
        mt.text AS maintenance_type_name,
        a.serial_number,
        a.text AS asset_name,
        at.asset_type_id,
        at.text AS asset_type_name,
        v.vendor_name,
        wfh.at_main_freq_id AS header_freq_id
      FROM "tblAssetMaintSch" ams
      INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = ams.maint_type_id
      LEFT JOIN "tblVendors" v ON v.vendor_id = ams.vendor_id
      LEFT JOIN "tblWFAssetMaintSch_H" wfh
        ON wfh.wfamsh_id = ams.wfamsh_id AND wfh.org_id = ams.org_id
      WHERE ams.org_id = $1
        AND ams.ams_id = $2
      LIMIT 1
    `,
    [orgId, amsId],
  );

  const schedule = schedules[0];
  if (!schedule) {
    const err = new Error('Maintenance schedule not found');
    err.status = 404;
    throw err;
  }

  const isCalibration =
    String(schedule.maint_type_id || '').toUpperCase() === 'MT017' ||
    /calibrat/i.test(String(schedule.maintenance_type_name || ''));
  if (!isCalibration) {
    const err = new Error('Selected maintenance is not a Calibration work order');
    err.status = 400;
    throw err;
  }

  const freqId = schedule.at_main_freq_id || schedule.header_freq_id || null;

  let checklist = [];
  if (freqId) {
    const { rows } = await db.query(
      `
        SELECT
          cl.at_main_checklist_id,
          cl.text,
          cl.at_main_freq_id
        FROM "tblATMaintCheckList" cl
        WHERE cl.org_id = $1
          AND cl.asset_type_id = $2
          AND cl.at_main_freq_id = $3
        ORDER BY cl.at_main_checklist_id ASC
      `,
      [orgId, schedule.asset_type_id, freqId],
    );
    checklist = rows;
  }

  const { rows: maintDocs } = await db.query(
    `
      SELECT
        amd.amd_id AS doc_id,
        'maintenance' AS source,
        amd.asset_id,
        amd.dto_id,
        amd.doc_type_name,
        amd.doc_path,
        amd.is_archived,
        dto.doc_type,
        COALESCE(dto.doc_type_text, amd.doc_type_name, dto.doc_type) AS document_type
      FROM "tblAssetMaintDocs" amd
      LEFT JOIN "tblDocTypeObjects" dto ON dto.dto_id = amd.dto_id
      WHERE amd.org_id = $1
        AND amd.asset_id = $2
        AND COALESCE(amd.is_archived, false) = false
        AND (
          UPPER(COALESCE(dto.doc_type, '')) = 'CL'
          OR LOWER(COALESCE(dto.doc_type_text, amd.doc_type_name, '')) LIKE '%calibrat%'
        )
      ORDER BY amd.amd_id DESC
    `,
    [orgId, schedule.asset_id],
  );

  const { rows: assetDocs } = await db.query(
    `
      SELECT
        ad.a_d_id AS doc_id,
        'asset' AS source,
        ad.asset_id,
        ad.dto_id,
        ad.doc_type_name,
        ad.doc_path,
        ad.is_archived,
        dto.doc_type,
        COALESCE(dto.doc_type_text, ad.doc_type_name, dto.doc_type) AS document_type
      FROM "tblAssetDocs" ad
      LEFT JOIN "tblDocTypeObjects" dto ON dto.dto_id = ad.dto_id
      WHERE ad.org_id = $1
        AND ad.asset_id = $2
        AND COALESCE(ad.is_archived, false) = false
        AND (
          UPPER(COALESCE(dto.doc_type, '')) = 'CL'
          OR LOWER(COALESCE(ad.doc_type_name, dto.doc_type_text, '')) LIKE '%calibrat%'
        )
      ORDER BY ad.a_d_id DESC
    `,
    [orgId, schedule.asset_id],
  );

  return {
    schedule: {
      ams_id: schedule.ams_id,
      wo_id: schedule.wo_id,
      asset_id: schedule.asset_id,
      asset_name: schedule.asset_name,
      serial_number: schedule.serial_number,
      asset_type_id: schedule.asset_type_id,
      asset_type_name: schedule.asset_type_name,
      maint_type_id: schedule.maint_type_id,
      maintenance_type_name: schedule.maintenance_type_name,
      status: schedule.status,
      notes: schedule.notes,
      at_main_freq_id: freqId,
      act_maint_st_date: schedule.act_maint_st_date,
      act_main_end_date: schedule.act_main_end_date,
      technician_name: schedule.technician_name,
      vendor_name: schedule.vendor_name,
    },
    checklist: checklist.map((item) => ({
      id: item.at_main_checklist_id,
      text: item.text,
      at_main_freq_id: item.at_main_freq_id,
    })),
    documents: [...maintDocs, ...assetDocs],
  };
}

async function listAllAssetTypes(orgId) {
  const db = getDb();
  const { rows } = await db.query(
    `
      SELECT
        at.asset_type_id,
        COALESCE(at.text, at.asset_type_id) AS asset_type_name
      FROM "tblAssetTypes" at
      WHERE COALESCE(at.int_status, 1) = 1
        AND (at.org_id IS NULL OR at.org_id = $1)
      ORDER BY 2 ASC, 1 ASC
    `,
    [orgId],
  );
  return rows;
}

async function createAuditType(orgId, { description, isInternal = true }, userId) {
  const db = getDb();
  await ensureAuditTablesSchema(db);
  const desc = String(description || '').trim();
  if (!desc) {
    const err = new Error('description is required');
    err.status = 400;
    throw err;
  }
  const { generateCustomId } = require('../utils/idGenerator');
  const audtpId = await generateCustomId('audit_type');
  await db.query(
    `
      INSERT INTO "tblAuditType"
        (audtp_id, description, is_internal, created_by, created_on, org_id, int_status)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, 1)
    `,
    [audtpId, desc, Boolean(isInternal), userId || null, orgId],
  );
  return getAuditType(orgId, audtpId);
}

async function updateAuditType(orgId, audtpId, { description, isInternal, intStatus }, userId) {
  const db = getDb();
  await ensureAuditTablesSchema(db);
  const existing = await getAuditType(orgId, audtpId);
  if (!existing) {
    const err = new Error('Audit type not found');
    err.status = 404;
    throw err;
  }

  const nextDesc =
    description !== undefined ? String(description || '').trim() : existing.description;
  if (!nextDesc) {
    const err = new Error('description is required');
    err.status = 400;
    throw err;
  }
  const nextInternal =
    isInternal !== undefined ? Boolean(isInternal) : Boolean(existing.is_internal);
  const nextStatus = intStatus !== undefined ? Number(intStatus) : 1;

  await db.query(
    `
      UPDATE "tblAuditType"
      SET description = $2,
          is_internal = $3,
          int_status = $4,
          changed_by = $5,
          changed_on = CURRENT_TIMESTAMP
      WHERE audtp_id = $1
        AND (org_id IS NULL OR org_id = $6)
    `,
    [audtpId, nextDesc, nextInternal, nextStatus, userId || null, orgId],
  );

  if (nextStatus !== 1) return { audtp_id: audtpId, int_status: nextStatus };
  return getAuditType(orgId, audtpId);
}

/**
 * Replace active asset-type mappings for an audit type (org-scoped).
 */
async function saveAuditTypeMappings(orgId, audtpId, assetTypeIds, userId) {
  const db = getDb();
  await ensureAuditTablesSchema(db);

  const auditType = await getAuditType(orgId, audtpId);
  if (!auditType) {
    const err = new Error('Audit type not found');
    err.status = 404;
    throw err;
  }

  const ids = [
    ...new Set(
      (Array.isArray(assetTypeIds) ? assetTypeIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean),
    ),
  ];

  if (ids.length) {
    const { rows: valid } = await db.query(
      `
        SELECT asset_type_id
        FROM "tblAssetTypes"
        WHERE asset_type_id = ANY($1::varchar[])
          AND COALESCE(int_status, 1) = 1
          AND (org_id IS NULL OR org_id = $2)
      `,
      [ids, orgId],
    );
    const validSet = new Set(valid.map((r) => r.asset_type_id));
    const invalid = ids.filter((id) => !validSet.has(id));
    if (invalid.length) {
      const err = new Error(`Invalid asset type(s): ${invalid.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  await db.query(
    `
      UPDATE "tblAuditATMapping"
      SET int_status = 0,
          changed_by = $3,
          changed_on = CURRENT_TIMESTAMP
      WHERE audtp_id = $1
        AND COALESCE(int_status, 1) = 1
        AND (org_id IS NULL OR org_id = $2)
    `,
    [audtpId, orgId, userId || null],
  );

  const { generateCustomId } = require('../utils/idGenerator');

  for (const atId of ids) {
    const { rows: existing } = await db.query(
      `
        SELECT audatm_id
        FROM "tblAuditATMapping"
        WHERE audtp_id = $1
          AND assettype_id = $2
          AND org_id = $3
        LIMIT 1
      `,
      [audtpId, atId, orgId],
    );

    if (existing[0]) {
      await db.query(
        `
          UPDATE "tblAuditATMapping"
          SET int_status = 1,
              changed_by = $2,
              changed_on = CURRENT_TIMESTAMP
          WHERE audatm_id = $1
        `,
        [existing[0].audatm_id, userId || null],
      );
    } else {
      const mapId = await generateCustomId('audit_at_mapping');
      await db.query(
        `
          INSERT INTO "tblAuditATMapping"
            (audatm_id, assettype_id, audtp_id, created_by, created_on, org_id, int_status)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, 1)
        `,
        [mapId, atId, audtpId, userId || null, orgId],
      );
    }
  }

  return listMappedAssetTypes(orgId, audtpId);
}

module.exports = {
  listAuditTypes,
  listMappedAssetTypes,
  listAllAssetTypes,
  createAuditType,
  updateAuditType,
  saveAuditTypeMappings,
  getAuditReportView,
  getPmCompliance,
  getCalibrationDetail,
  resolvePeriodBounds,
};
