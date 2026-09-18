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
        sv.vendor_name AS service_vendor_name
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
    const { rows } = await db.query(
      `
        SELECT
          brd.abr_id,
          brd.asset_id,
          a.serial_number,
          at.text AS asset_type_name,
          brd.status AS breakdown_status,
          brd.description AS breakdown_description,
          brc.text AS breakdown_reason,
          brd.created_on AS breakdown_date,
          u.full_name AS reported_by_name,
          brd.decision_code
        FROM "tblAssetBRDet" brd
        INNER JOIN "tblAssets" a ON a.asset_id = brd.asset_id
        INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
        LEFT JOIN "tblATBRReasonCodes" brc ON brc.atbrrc_id = brd.atbrrc_id
        LEFT JOIN "tblUsers" u ON u.user_id = brd.reported_by
        WHERE brd.org_id = $1
          AND brd.asset_id = ANY($2::varchar[])
          AND brd.created_on::date BETWEEN $3::date AND $4::date
          AND COALESCE(brd.description, '') NOT ILIKE ${`'%${DEMO_NOTE}%'`}
        ORDER BY brd.created_on DESC, brd.abr_id
      `,
      histParams,
    );
    empty.sections.breakdown = rows;
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
            UPPER(COALESCE(dto.doc_type, '')) IN ('IC', 'WA', 'IN', 'CC', 'CT')
            OR LOWER(COALESCE(ad.doc_type_name, '')) ~ '(cert|warranty|insurance|inspection)'
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

module.exports = {
  listAuditTypes,
  listMappedAssetTypes,
  getAuditReportView,
  resolvePeriodBounds,
};
