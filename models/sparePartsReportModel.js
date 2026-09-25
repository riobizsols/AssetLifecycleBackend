const { getDbFromContext } = require("../utils/dbContext");

const getDb = () => getDbFromContext();

const STATUS_AVAILABLE = "Available";
const STATUS_REQUESTED = "Requested";
const STATUS_RESERVED = "Reserved";
const STATUS_USED = "Used";

const FIELD_MAPPING = {
  partNumber: "part_number",
  serialNumber: "serial_number",
  category: "category",
  brand: "brand",
  model: "model",
  lotId: "lot_id",
  vendor: "vendor",
  invoiceNumber: "invoice_no",
  assetId: "asset_id",
  issuedDateRange: "issued_on",
  unitPrice: "unit_price",
  belowSafety: "below_safety",
  uom: "uom",
  currentStatus: "current_status",
  purchaseDateRange: "purchase_date",
};

const normalizeList = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const list = Array.isArray(value) ? value : [value];
  const normalized = list
    .map((item) => {
      if (item && typeof item === "object") {
        return item.value ?? item.label ?? null;
      }
      return item;
    })
    .filter((item) => item !== null && item !== undefined && String(item).trim() !== "")
    .map((item) => String(item).trim());
  return normalized.length ? normalized : null;
};

const isFilledDateRange = (range) =>
  Array.isArray(range) &&
  range.length === 2 &&
  range[0] &&
  String(range[0]).trim() !== "" &&
  range[1] &&
  String(range[1]).trim() !== "";

const tableExists = async (dbPool, tableName) => {
  const result = await dbPool.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [tableName]
  );
  return result.rows.length > 0;
};

const ensureLotExtraColumns = async (dbPool) => {
  try {
    await dbPool.query(`
      ALTER TABLE "tblSPLotDet"
        ADD COLUMN IF NOT EXISTS vendor_id character varying(20),
        ADD COLUMN IF NOT EXISTS brand_id character varying(20),
        ADD COLUMN IF NOT EXISTS model_id character varying(20),
        ADD COLUMN IF NOT EXISTS part_number character varying(100)
    `);
    await dbPool.query(`
      ALTER TABLE "tblSPCategory"
        ADD COLUMN IF NOT EXISTS spb_id character varying(20),
        ADD COLUMN IF NOT EXISTS spm_id character varying(20)
    `);
  } catch (error) {
    console.warn("[sparePartsReport] Could not ensure extra lot/category columns:", error.message);
  }
};

const applyAdvancedConditions = (advancedConditions, whereConditions, queryParams) => {
  if (!Array.isArray(advancedConditions) || advancedConditions.length === 0) {
    return;
  }

  advancedConditions.forEach((condition) => {
    if (!condition || !condition.field || condition.val === undefined || condition.val === "") {
      return;
    }
    const { field, op, val } = condition;
    const dbField = FIELD_MAPPING[field];
    if (!dbField) return;

    const pushClause = (clause, values) => {
      whereConditions.push(clause);
      queryParams.push(...values);
    };

    switch (op) {
      case "contains":
        pushClause(`${dbField} ILIKE $${queryParams.length + 1}`, [`%${val}%`]);
        break;
      case "starts with":
        pushClause(`${dbField} ILIKE $${queryParams.length + 1}`, [`${val}%`]);
        break;
      case "ends with":
        pushClause(`${dbField} ILIKE $${queryParams.length + 1}`, [`%${val}`]);
        break;
      case ">":
        pushClause(`${dbField} > $${queryParams.length + 1}`, [val]);
        break;
      case "<":
        pushClause(`${dbField} < $${queryParams.length + 1}`, [val]);
        break;
      case ">=":
        pushClause(`${dbField} >= $${queryParams.length + 1}`, [val]);
        break;
      case "<=":
        pushClause(`${dbField} <= $${queryParams.length + 1}`, [val]);
        break;
      case "!=":
        pushClause(`${dbField} IS DISTINCT FROM $${queryParams.length + 1}`, [val]);
        break;
      case "has any": {
        const values = normalizeList(val);
        if (!values) return;
        pushClause(`${dbField} = ANY($${queryParams.length + 1})`, [values]);
        break;
      }
      case "in range": {
        const startDate = Array.isArray(val) ? val[0] : val?.from;
        const endDate = Array.isArray(val) ? val[1] : val?.to;
        if (startDate && endDate) {
          pushClause(
            `${dbField} >= $${queryParams.length + 1} AND ${dbField} <= $${queryParams.length + 2}`,
            [startDate, endDate]
          );
        } else if (startDate) {
          pushClause(`${dbField} >= $${queryParams.length + 1}`, [startDate]);
        } else if (endDate) {
          pushClause(`${dbField} <= $${queryParams.length + 1}`, [endDate]);
        }
        break;
      }
      case "before":
        pushClause(`${dbField} < $${queryParams.length + 1}`, [Array.isArray(val) ? val[0] : val]);
        break;
      case "after":
        pushClause(`${dbField} > $${queryParams.length + 1}`, [Array.isArray(val) ? val[0] : val]);
        break;
      case "=":
      default: {
        if (field === "belowSafety") {
          const yes = String(val).toLowerCase() === "yes" || val === true || val === "true";
          whereConditions.push(yes ? "below_safety = true" : "below_safety = false");
          break;
        }
        const values = normalizeList(val);
        if (values && values.length > 1) {
          pushClause(`${dbField} = ANY($${queryParams.length + 1})`, [values]);
        } else {
          pushClause(`${dbField} = $${queryParams.length + 1}`, [values ? values[0] : val]);
        }
      }
    }
  });
};

const buildFilters = (filters = {}) => {
  const whereConditions = [];
  const queryParams = [];

  if (filters.org_id) {
    whereConditions.push(`org_id = $${queryParams.length + 1}`);
    queryParams.push(filters.org_id);
  }

  if (filters.branch_id && !filters.hasSuperAccess) {
    whereConditions.push(`(branch_id IS NULL OR branch_id = $${queryParams.length + 1})`);
    queryParams.push(filters.branch_id);
  }

  const categories = normalizeList(filters.category);
  if (categories) {
    whereConditions.push(`category = ANY($${queryParams.length + 1})`);
    queryParams.push(categories);
  }

  const brands = normalizeList(filters.brand);
  if (brands) {
    whereConditions.push(`brand = ANY($${queryParams.length + 1})`);
    queryParams.push(brands);
  }

  const statuses = normalizeList(filters.currentStatus || filters.status);
  if (statuses) {
    whereConditions.push(`current_status = ANY($${queryParams.length + 1})`);
    queryParams.push(statuses);
  }

  if (isFilledDateRange(filters.purchaseDateRange)) {
    whereConditions.push(
      `purchase_date >= $${queryParams.length + 1} AND purchase_date <= $${queryParams.length + 2}`
    );
    queryParams.push(filters.purchaseDateRange[0], filters.purchaseDateRange[1]);
  }

  applyAdvancedConditions(filters.advancedConditions, whereConditions, queryParams);

  return { whereConditions, queryParams };
};

const cteSql = (flags) => {
  const {
    hasIspBrand,
    hasIspModel,
    hasStore,
    hasSpBrand,
    hasSpModel,
    hasVendors,
    hasIssues,
    hasAssets,
  } = flags;

  const ispBrandJoin = hasIspBrand
    ? `LEFT JOIN "tblISPBrand" ib
         ON ib."spbId" = l.brand_id
        AND (ib.org_id = l.org_id OR ib.org_id IS NULL)`
    : "";
  const ispModelJoin = hasIspModel
    ? `LEFT JOIN "tblISPModel" im
         ON im."spbmId" = l.model_id
        AND (im.org_id = l.org_id OR im.org_id IS NULL)`
    : "";
  const storeJoin = hasStore
    ? `LEFT JOIN "tblSpareStore" ss
         ON ss.ss_id = li.ss_id
        AND (ss.org_id = l.org_id OR ss.org_id IS NULL)`
    : "";
  const spBrandJoin = hasSpBrand
    ? `LEFT JOIN "tblSPBrand" sb ON sb.spb_id = COALESCE(l.brand_id, c.spb_id)`
    : "";
  const spModelJoin = hasSpModel
    ? `LEFT JOIN "tblSPBMod" sm ON sm.spbm_id = COALESCE(l.model_id, c.spm_id)`
    : "";
  const vendorJoin = hasVendors
    ? `LEFT JOIN "tblVendors" v
         ON v.vendor_id = l.vendor_id
        AND (v.org_id = l.org_id OR v.org_id IS NULL)`
    : "";

  const brandParts = [];
  if (hasSpBrand) brandParts.push(`NULLIF(BTRIM(sb.text), '')`);
  if (hasIspBrand) brandParts.push(`NULLIF(BTRIM(ib."brandName"), '')`);
  const brandExpr = brandParts.length
    ? `COALESCE(${brandParts.join(", ")}, 'No Brand')`
    : `'No Brand'`;

  const modelParts = [];
  if (hasSpModel) modelParts.push(`NULLIF(BTRIM(sm.text), '')`);
  if (hasIspModel) modelParts.push(`NULLIF(BTRIM(im."modelName"), '')`);
  const modelExpr = modelParts.length
    ? `COALESCE(${modelParts.join(", ")}, 'No Model')`
    : `'No Model'`;

  const storeExpr = hasStore
    ? `COALESCE(NULLIF(BTRIM(ss.store_name), ''), 'No Store')`
    : `'No Store'`;
  const vendorExpr = hasVendors
    ? `COALESCE(NULLIF(BTRIM(v.vendor_name), ''), NULLIF(BTRIM(v.company_name), ''), 'No Vendor')`
    : `'No Vendor'`;

  const issueCte = hasIssues
    ? `
    latest_issue AS (
      SELECT DISTINCT ON (si.spid_id)
        si.spid_id,
        si.si_id,
        si.status,
        si.ss_id,
        si.created_on AS issued_on,
        ${hasAssets ? "ams.asset_id" : "NULL::text AS asset_id"},
        ${hasAssets
          ? `COALESCE(NULLIF(BTRIM(a.description), ''), NULLIF(BTRIM(a.serial_number), ''), a.asset_id) AS asset_name`
          : "NULL::text AS asset_name"}
      FROM "tblSpareIssue" si
      ${hasAssets ? `LEFT JOIN "tblAssetMaintSch" ams ON ams.ams_id = si.assetmaintsch_id
      LEFT JOIN "tblAssets" a ON a.asset_id = ams.asset_id` : ""}
      WHERE si.spid_id IS NOT NULL
      ORDER BY si.spid_id, si.created_on DESC NULLS LAST, si.si_id DESC
    )`
    : `
    latest_issue AS (
      SELECT
        NULL::text AS spid_id,
        NULL::text AS si_id,
        NULL::text AS status,
        NULL::text AS ss_id,
        NULL::timestamp AS issued_on,
        NULL::text AS asset_id,
        NULL::text AS asset_name
      WHERE false
    )`;

  return `
    WITH ${issueCte},
    category_stock AS (
      SELECT
        ind.spc_id,
        ind.org_id,
        COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS available_qty,
        COUNT(*)::int AS total_qty
      FROM "tblSPIndDet" ind
      GROUP BY ind.spc_id, ind.org_id
    ),
    spare_parts AS (
      SELECT
        COALESCE(ind.spid_id, l.spld_id) AS row_id,
        ind.serial_number,
        COALESCE(NULLIF(BTRIM(l.part_number), ''), '') AS part_number,
        COALESCE(NULLIF(BTRIM(c.text), ''), 'Uncategorized') AS category,
        ${brandExpr} AS brand,
        ${modelExpr} AS model,
        COALESCE(NULLIF(BTRIM(c.uom), ''), '-') AS uom,
        l.spld_id AS lot_id,
        l.invoice_no,
        l.lot_purchase_date::date AS purchase_date,
        l.unit_price,
        ${vendorExpr} AS vendor,
        ${storeExpr} AS store,
        CASE
          WHEN COALESCE(ind.is_used, 0) = 1 OR li.status = 'IE' THEN '${STATUS_USED}'
          WHEN li.status = 'IS' THEN '${STATUS_RESERVED}'
          WHEN li.status = 'RQ' THEN '${STATUS_REQUESTED}'
          ELSE '${STATUS_AVAILABLE}'
        END AS current_status,
        li.asset_id,
        li.asset_name,
        li.issued_on,
        COALESCE(cs.available_qty, 0) AS available_qty,
        COALESCE(c.minimum_stock, 0) AS minimum_stock,
        COALESCE(c.re_order_level, 0) AS reorder_level,
        (COALESCE(cs.available_qty, 0) < COALESCE(c.minimum_stock, 0)) AS below_safety,
        l.org_id,
        COALESCE(ind.branch_id, l.branch_id) AS branch_id,
        COALESCE(ind.created_on, l.created_on) AS created_on
      FROM "tblSPLotDet" l
      LEFT JOIN "tblSPIndDet" ind
        ON ind.spld_id = l.spld_id
       AND ind.org_id = l.org_id
      LEFT JOIN "tblSPCategory" c
        ON c.spc_id = COALESCE(ind.spc_id, l.spc_id)
       AND c.org_id = l.org_id
      ${spBrandJoin}
      ${spModelJoin}
      ${ispBrandJoin}
      ${ispModelJoin}
      ${vendorJoin}
      LEFT JOIN latest_issue li
        ON li.spid_id = ind.spid_id
      ${storeJoin}
      LEFT JOIN category_stock cs
        ON cs.spc_id = COALESCE(ind.spc_id, l.spc_id)
       AND cs.org_id = l.org_id
    )
  `;
};

const displaySelect = `
  serial_number AS "Serial Number",
  part_number AS "Part Number",
  category AS "Category",
  brand AS "Brand",
  model AS "Model",
  uom AS "UoM",
  lot_id AS "Lot ID",
  invoice_no AS "Invoice Number",
  TO_CHAR(purchase_date, 'YYYY-MM-DD') AS "Purchase Date",
  ROUND(NULLIF(BTRIM(unit_price::text), '')::numeric, 2) AS "Unit Price",
  vendor AS "Vendor",
  store AS "Store",
  current_status AS "Status",
  available_qty AS "Available Qty",
  minimum_stock AS "Min Stock",
  reorder_level AS "Reorder Level",
  asset_id AS "Asset ID",
  asset_name AS "Asset Name",
  TO_CHAR(issued_on, 'YYYY-MM-DD HH24:MI') AS "Issued On"
`;

const getJoinFlags = async (dbPool) => {
  const [
    hasIspBrand,
    hasIspModel,
    hasStore,
    hasSpBrand,
    hasSpModel,
    hasVendors,
    hasIssues,
    hasAssets,
  ] = await Promise.all([
    tableExists(dbPool, "tblISPBrand"),
    tableExists(dbPool, "tblISPModel"),
    tableExists(dbPool, "tblSpareStore"),
    tableExists(dbPool, "tblSPBrand"),
    tableExists(dbPool, "tblSPBMod"),
    tableExists(dbPool, "tblVendors"),
    tableExists(dbPool, "tblSpareIssue"),
    tableExists(dbPool, "tblAssets"),
  ]);
  return {
    hasIspBrand,
    hasIspModel,
    hasStore,
    hasSpBrand,
    hasSpModel,
    hasVendors,
    hasIssues,
    hasAssets,
  };
};

const getSparePartsReportData = async (filters = {}) => {
  const dbPool = getDb();
  await ensureLotExtraColumns(dbPool);
  const flags = await getJoinFlags(dbPool);
  const { whereConditions, queryParams } = buildFilters(filters);
  const limit = Number.parseInt(filters.limit, 10) || 1000;
  const offset = Number.parseInt(filters.offset, 10) || 0;

  queryParams.push(limit, offset);
  const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    ${cteSql(flags)}
    SELECT ${displaySelect}
    FROM spare_parts
    ${whereClause}
    ORDER BY created_on DESC NULLS LAST, lot_id DESC, serial_number ASC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const result = await dbPool.query(query, queryParams);
  return result.rows;
};

const getSparePartsReportCount = async (filters = {}) => {
  const dbPool = getDb();
  await ensureLotExtraColumns(dbPool);
  const flags = await getJoinFlags(dbPool);
  const { whereConditions, queryParams } = buildFilters(filters);
  const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";

  const query = `
    ${cteSql(flags)}
    SELECT COUNT(*)::int AS total
    FROM spare_parts
    ${whereClause}
  `;

  const result = await dbPool.query(query, queryParams);
  return result.rows[0]?.total || 0;
};

const scopedWhere = (extra, hasOrg) =>
  hasOrg ? `WHERE org_id = $1 AND ${extra}` : `WHERE ${extra}`;

const getSparePartCategories = async (dbPool, orgId) => {
  const params = [];
  let orgClause = "";
  if (orgId) {
    params.push(orgId);
    orgClause = "AND org_id = $1";
  }

  const result = await dbPool.query(
    `
      SELECT COALESCE(JSON_AGG(val ORDER BY val), '[]'::json) AS categories
      FROM (
        SELECT DISTINCT BTRIM(text) AS val
        FROM "tblSPCategory"
        WHERE text IS NOT NULL
          AND BTRIM(text) <> ''
          AND COALESCE(int_status, 1) = 1
          ${orgClause}
      ) category_opts
    `,
    params
  );

  return result.rows[0]?.categories || [];
};

const getSparePartsReportFilterOptions = async (filters = {}) => {
  const dbPool = getDb();
  await ensureLotExtraColumns(dbPool);
  const categories = await getSparePartCategories(dbPool, filters.org_id || null);
  const flags = await getJoinFlags(dbPool);
  const params = [];
  const hasOrg = Boolean(filters.org_id);
  if (hasOrg) params.push(filters.org_id);

  const query = `
    ${cteSql(flags)}
    SELECT
      (SELECT COALESCE(JSON_AGG(val ORDER BY val), '[]'::json)
         FROM (
           SELECT DISTINCT BTRIM(text) AS val
           FROM "tblSPCategory"
           WHERE text IS NOT NULL
             AND BTRIM(text) <> ''
             AND COALESCE(int_status, 1) = 1
             ${hasOrg ? "AND org_id = $1" : ""}
         ) category_opts
      ) AS categories,
      (SELECT JSON_AGG(val ORDER BY val)
         FROM (SELECT DISTINCT brand AS val FROM spare_parts ${scopedWhere("brand IS NOT NULL", hasOrg)}) s
      ) AS brands,
      (SELECT JSON_AGG(val ORDER BY val)
         FROM (SELECT DISTINCT model AS val FROM spare_parts ${scopedWhere("model IS NOT NULL AND model <> 'No Model'", hasOrg)}) s
      ) AS models,
      (SELECT JSON_AGG(val ORDER BY val)
         FROM (SELECT DISTINCT vendor AS val FROM spare_parts ${scopedWhere("vendor IS NOT NULL", hasOrg)}) s
      ) AS vendors,
      (SELECT JSON_AGG(val ORDER BY val)
         FROM (SELECT DISTINCT current_status AS val FROM spare_parts ${scopedWhere("current_status IS NOT NULL", hasOrg)}) s
      ) AS statuses,
      (SELECT JSON_AGG(val ORDER BY val)
         FROM (SELECT DISTINCT uom AS val FROM spare_parts ${scopedWhere("uom IS NOT NULL AND uom <> '-'", hasOrg)}) s
      ) AS uoms,
      (SELECT COALESCE(JSON_AGG(opt ORDER BY opt->>'label'), '[]'::json)
         FROM (
           SELECT DISTINCT jsonb_build_object('value', part_number, 'label', part_number) AS opt
           FROM spare_parts
           ${scopedWhere("part_number IS NOT NULL AND BTRIM(part_number) <> ''", hasOrg)}
         ) part_opts
      ) AS part_numbers,
      (SELECT COALESCE(JSON_AGG(opt ORDER BY opt->>'label'), '[]'::json)
         FROM (
           SELECT DISTINCT jsonb_build_object('value', lot_id, 'label', lot_id) AS opt
           FROM spare_parts
           ${scopedWhere("lot_id IS NOT NULL", hasOrg)}
         ) lot_opts
      ) AS lot_options,
      (SELECT COALESCE(JSON_AGG(opt ORDER BY opt->>'label'), '[]'::json)
         FROM (
           SELECT DISTINCT jsonb_build_object(
             'value', asset_id,
             'label', asset_id || COALESCE(' - ' || NULLIF(BTRIM(asset_name), ''), '')
           ) AS opt
           FROM spare_parts
           ${scopedWhere("asset_id IS NOT NULL", hasOrg)}
         ) asset_opts
      ) AS asset_options
  `;

  let row = {};
  try {
    const result = await dbPool.query(query, params);
    row = result.rows[0] || {};
  } catch (error) {
    console.warn("[sparePartsReport] Filter option query failed; categories still returned:", error.message);
  }

  return {
    categories: categories.length ? categories : row.categories || [],
    brands: row.brands || [],
    models: row.models || [],
    vendors: row.vendors || [],
    statuses: row.statuses || [STATUS_AVAILABLE, STATUS_REQUESTED, STATUS_RESERVED, STATUS_USED],
    uoms: row.uoms || [],
    part_numbers: row.part_numbers || [],
    lot_options: row.lot_options || [],
    asset_options: row.asset_options || [],
  };
};

module.exports = {
  getSparePartsReportData,
  getSparePartsReportCount,
  getSparePartsReportFilterOptions,
};
