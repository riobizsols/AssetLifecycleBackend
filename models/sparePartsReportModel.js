const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

const parseList = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

async function getFilterOptions(orgId, branchId = null, hasSuperAccess = false) {
  const db = getDb();
  const params = [orgId];
  let branchSql = '';
  if (branchId && !hasSuperAccess) {
    params.push(branchId);
    branchSql = ` AND (l.branch_id IS NULL OR l.branch_id = $${params.length})`;
  }

  const [categories, brands] = await Promise.all([
    db.query(
      `
      SELECT DISTINCT c.spc_id AS id, COALESCE(c.text, c.spc_id) AS label
      FROM "tblSPLotDet" l
      INNER JOIN "tblSPCategory" c ON c.spc_id = l.spc_id AND c.org_id = l.org_id
      WHERE l.org_id = $1
        ${branchSql}
      ORDER BY label ASC
      `,
      params,
    ),
    db.query(
      `
      SELECT DISTINCT b.spb_id AS id, COALESCE(b.text, b.spb_id) AS label
      FROM "tblSPLotDet" l
      INNER JOIN "tblSPBrand" b ON b.spb_id = l.brand_id AND b.org_id = l.org_id
      WHERE l.org_id = $1
        AND l.brand_id IS NOT NULL
        ${branchSql}
      ORDER BY label ASC
      `,
      params,
    ),
  ]);

  return {
    categories: categories.rows,
    brands: brands.rows,
    statuses: [
      { id: 'Available', label: 'Available' },
      { id: 'Partially Used', label: 'Partially Used' },
      { id: 'Fully Used', label: 'Fully Used' },
    ],
  };
}

async function getSparePartsReport(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const categories = parseList(opts.category || opts.categories);
  const brands = parseList(opts.brand || opts.brands);
  const statuses = parseList(opts.currentStatus || opts.status);
  const purchaseFrom = opts.purchaseDateFrom || opts.purchase_from || null;
  const purchaseTo = opts.purchaseDateTo || opts.purchase_to || null;

  const params = [orgId];
  let where = `WHERE l.org_id = $1`;

  if (opts.branchId && !opts.hasSuperAccess) {
    params.push(opts.branchId);
    where += ` AND (l.branch_id IS NULL OR l.branch_id = $${params.length})`;
  }
  if (categories.length) {
    params.push(categories);
    where += ` AND l.spc_id = ANY($${params.length}::text[])`;
  }
  if (brands.length) {
    params.push(brands);
    where += ` AND l.brand_id = ANY($${params.length}::text[])`;
  }
  if (purchaseFrom) {
    params.push(purchaseFrom);
    where += ` AND l.lot_purchase_date::date >= $${params.length}::date`;
  }
  if (purchaseTo) {
    params.push(purchaseTo);
    where += ` AND l.lot_purchase_date::date <= $${params.length}::date`;
  }

  const { rows } = await db.query(
    `
    SELECT
      l.spld_id,
      COALESCE(NULLIF(BTRIM(l.part_number), ''), l.spc_id) AS "Part Code",
      COALESCE(c.text, l.spc_id) AS "Description",
      COALESCE(c.text, l.spc_id) AS "Category",
      COALESCE(b.text, l.brand_id, '—') AS "Brand",
      COALESCE(NULLIF(BTRIM(c.uom), ''), u.uom, '—') AS "UoM",
      COUNT(ind.spid_id) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS "On Hand",
      COUNT(ind.spid_id)::int AS "Quantity",
      l.unit_price AS "Unit Price",
      l.lot_purchase_date::date AS "Purchase Date",
      COALESCE(l.invoice_no, '—') AS "Invoice Number",
      COALESCE(v.vendor_name, v.company_name, l.vendor_id, '—') AS "Vendor",
      CASE
        WHEN COUNT(ind.spid_id) = 0 THEN 'Available'
        WHEN COUNT(ind.spid_id) FILTER (WHERE COALESCE(ind.is_used, 0) = 0) = 0 THEN 'Fully Used'
        WHEN COUNT(ind.spid_id) FILTER (WHERE COALESCE(ind.is_used, 0) = 1) = 0 THEN 'Available'
        ELSE 'Partially Used'
      END AS "Current Status",
      l.spc_id,
      l.brand_id,
      l.vendor_id
    FROM "tblSPLotDet" l
    LEFT JOIN "tblSPCategory" c ON c.spc_id = l.spc_id AND c.org_id = l.org_id
    LEFT JOIN "tblUom" u ON u.uom_id = NULLIF(BTRIM(c.uom), '')
    LEFT JOIN "tblSPBrand" b ON b.spb_id = l.brand_id AND b.org_id = l.org_id
    LEFT JOIN "tblVendors" v ON v.vendor_id = l.vendor_id AND v.org_id = l.org_id
    LEFT JOIN "tblSPIndDet" ind ON ind.spld_id = l.spld_id AND ind.org_id = l.org_id
    ${where}
    GROUP BY
      l.spld_id, l.part_number, l.spc_id, c.text, c.uom, u.uom, b.text, l.brand_id,
      l.unit_price, l.lot_purchase_date, l.invoice_no, v.vendor_name, v.company_name, l.vendor_id
    ORDER BY l.lot_purchase_date DESC NULLS LAST, l.spld_id DESC
    LIMIT 2000
    `,
    params,
  );

  let filtered = rows;
  if (statuses.length) {
    filtered = rows.filter((r) => statuses.includes(r['Current Status']));
  }

  return {
    rows: filtered,
    summary: {
      total: filtered.length,
      onHand: filtered.reduce((s, r) => s + Number(r['On Hand'] || 0), 0),
    },
  };
}

module.exports = {
  getFilterOptions,
  getSparePartsReport,
};
