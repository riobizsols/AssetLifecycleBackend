const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

const VALID_COVERAGE = new Set(['Warranty', 'AMC', 'CMC']);
const VALID_STATUS = new Set(['Active', 'Expiring', 'Expired']);

function asList(value, allowed) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map((v) => String(v).trim()).filter((v) => allowed.has(v)))];
}

async function hasVendorRenewalTable(db) {
  const { rows } = await db.query(`SELECT to_regclass('public."tblVendorRenewal"') AS t`);
  return Boolean(rows[0]?.t);
}

async function ensureAssetCoverageColumns(db) {
  await db.query(`
    ALTER TABLE "tblAssets"
      ADD COLUMN IF NOT EXISTS amc_start_date DATE,
      ADD COLUMN IF NOT EXISTS amc_end_date DATE,
      ADD COLUMN IF NOT EXISTS cmc_start_date DATE,
      ADD COLUMN IF NOT EXISTS cmc_end_date DATE
  `);
}

function toDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatRow(row) {
  return {
    coverage_type: row.coverage_type,
    status: row.status,
    asset_id: row.asset_id || null,
    asset_name: row.asset_name || null,
    serial_number: row.serial_number || null,
    asset_type: row.asset_type || null,
    branch: row.branch || null,
    department: row.department || null,
    vendor_id: row.vendor_id || null,
    vendor_name: row.vendor_name || null,
    coverage_start: toDateOnly(row.coverage_start),
    coverage_end: toDateOnly(row.coverage_end),
    days_left: row.days_left == null ? null : Number(row.days_left),
    last_renewal_date: toDateOnly(row.last_renewal_date),
    previous_end_date: toDateOnly(row.previous_end_date),
  };
}

/**
 * Warranty: tblAssets.warranty_period.
 * AMC: asset amc_* dates when set; otherwise vendor contract dates.
 * CMC: asset cmc_* dates.
 */
async function getCoverageExpiryReport(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  if (!orgId) {
    const err = new Error('org_id is required');
    err.status = 401;
    throw err;
  }

  await ensureAssetCoverageColumns(db);

  const expiringDays = Math.max(0, parseInt(opts.expiringDays, 10) || 30);
  const coverageTypes = asList(opts.coverageTypes, VALID_COVERAGE);
  const statuses = asList(opts.statuses, VALID_STATUS);
  const includeWarranty = coverageTypes.length === 0 || coverageTypes.includes('Warranty');
  const includeAmc = coverageTypes.length === 0 || coverageTypes.includes('AMC');
  const includeCmc = coverageTypes.length === 0 || coverageTypes.includes('CMC');

  const renewalExists = await hasVendorRenewalTable(db);
  const renewalSelect = renewalExists
    ? 'vr.renewal_date AS last_renewal_date, vr.previous_contract_end_date AS previous_end_date'
    : 'NULL::timestamp AS last_renewal_date, NULL::date AS previous_end_date';
  const renewalJoin = renewalExists
    ? `
      LEFT JOIN LATERAL (
        SELECT renewal_date, previous_contract_end_date
        FROM "tblVendorRenewal" vr
        WHERE vr.vendor_id = v.vendor_id
          AND (vr.org_id = v.org_id OR vr.org_id IS NULL)
        ORDER BY vr.renewal_date DESC NULLS LAST
        LIMIT 1
      ) vr ON true
    `
    : '';

  const params = [orgId, expiringDays];
  let idx = 3;
  let assetFilterSql = '';
  if (opts.branchId && !opts.hasSuperAccess) {
    assetFilterSql += ` AND a.branch_id = $${idx}`;
    params.push(opts.branchId);
    idx += 1;
  }
  if (opts.assetId) {
    assetFilterSql += ` AND a.asset_id = $${idx}`;
    params.push(String(opts.assetId).trim());
    idx += 1;
  }

  const unions = [];

  if (includeWarranty) {
    unions.push(`
      SELECT
        'Warranty'::text AS coverage_type,
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        at.text AS asset_type,
        b.text AS branch,
        d.text AS department,
        COALESCE(sv.vendor_id, pv.vendor_id) AS vendor_id,
        COALESCE(sv.vendor_name, pv.vendor_name) AS vendor_name,
        a.purchased_on::date AS coverage_start,
        a.warranty_period::date AS coverage_end,
        NULL::timestamp AS last_renewal_date,
        NULL::date AS previous_end_date
      FROM "tblAssets" a
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
      LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
      WHERE a.org_id = $1
        AND a.warranty_period IS NOT NULL
        ${assetFilterSql}
    `);
  }

  if (includeAmc) {
    // Preferred: asset-level AMC dates
    unions.push(`
      SELECT
        'AMC'::text AS coverage_type,
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        at.text AS asset_type,
        b.text AS branch,
        d.text AS department,
        COALESCE(sv.vendor_id, pv.vendor_id) AS vendor_id,
        COALESCE(sv.vendor_name, pv.vendor_name) AS vendor_name,
        a.amc_start_date::date AS coverage_start,
        a.amc_end_date::date AS coverage_end,
        NULL::timestamp AS last_renewal_date,
        NULL::date AS previous_end_date
      FROM "tblAssets" a
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
      LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
      WHERE a.org_id = $1
        AND a.amc_end_date IS NOT NULL
        ${assetFilterSql}
    `);

    // Fallback: vendor contract dates when asset has no AMC dates
    const assetJoinType = opts.assetId ? 'INNER JOIN' : 'LEFT JOIN';
    unions.push(`
      SELECT
        'AMC'::text AS coverage_type,
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        at.text AS asset_type,
        b.text AS branch,
        d.text AS department,
        v.vendor_id,
        v.vendor_name,
        v.contract_start_date::date AS coverage_start,
        v.contract_end_date::date AS coverage_end,
        ${renewalSelect}
      FROM "tblVendors" v
      ${renewalJoin}
      ${assetJoinType} "tblAssets" a
        ON a.org_id = v.org_id
       AND (a.service_vendor_id = v.vendor_id OR a.purchase_vendor_id = v.vendor_id)
       AND a.amc_end_date IS NULL
       ${assetFilterSql}
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      WHERE v.org_id = $1
        AND v.contract_end_date IS NOT NULL
    `);
  }

  if (includeCmc) {
    unions.push(`
      SELECT
        'CMC'::text AS coverage_type,
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        at.text AS asset_type,
        b.text AS branch,
        d.text AS department,
        COALESCE(sv.vendor_id, pv.vendor_id) AS vendor_id,
        COALESCE(sv.vendor_name, pv.vendor_name) AS vendor_name,
        a.cmc_start_date::date AS coverage_start,
        a.cmc_end_date::date AS coverage_end,
        NULL::timestamp AS last_renewal_date,
        NULL::date AS previous_end_date
      FROM "tblAssets" a
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblBranches" b ON b.branch_id = a.branch_id
      LEFT JOIN "tblDepartments" d ON d.dept_id = a.dept_id
      LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
      LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
      WHERE a.org_id = $1
        AND a.cmc_end_date IS NOT NULL
        ${assetFilterSql}
    `);
  }

  if (!unions.length) {
    return { rows: [], summary: { total: 0, active: 0, expiring: 0, expired: 0 }, expiringDays };
  }

  let statusSql = '';
  if (statuses.length) {
    statusSql = ` AND classified.status = ANY($${idx}::text[])`;
    params.push(statuses);
  }

  const query = `
    WITH raw AS (
      ${unions.join('\n      UNION ALL\n')}
    ),
    classified AS (
      SELECT
        raw.*,
        CASE
          WHEN raw.coverage_end < CURRENT_DATE THEN 'Expired'
          WHEN raw.coverage_end <= CURRENT_DATE + ($2::int * INTERVAL '1 day') THEN 'Expiring'
          ELSE 'Active'
        END AS status,
        (raw.coverage_end - CURRENT_DATE) AS days_left
      FROM raw
      WHERE raw.coverage_end IS NOT NULL
    )
    SELECT *
    FROM classified
    WHERE 1=1
      ${statusSql}
    ORDER BY
      CASE classified.status
        WHEN 'Expired' THEN 1
        WHEN 'Expiring' THEN 2
        ELSE 3
      END,
      classified.coverage_end ASC NULLS LAST,
      classified.coverage_type,
      classified.asset_id
    LIMIT 2000
  `;

  const { rows } = await db.query(query, params);
  const formatted = rows.map(formatRow);
  const summary = formatted.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === 'Active') acc.active += 1;
      else if (row.status === 'Expiring') acc.expiring += 1;
      else if (row.status === 'Expired') acc.expired += 1;
      return acc;
    },
    { total: 0, active: 0, expiring: 0, expired: 0 },
  );

  return { rows: formatted, summary, expiringDays };
}

/**
 * Vendor contract renewal status for vendors linked to an asset
 * (purchase vendor and/or service vendor).
 */
async function getAssetVendorRenewals(opts = {}) {
  const db = getDb();
  const orgId = opts.orgId;
  const assetId = opts.assetId ? String(opts.assetId).trim() : null;
  if (!orgId) {
    const err = new Error('org_id is required');
    err.status = 401;
    throw err;
  }
  if (!assetId) {
    const err = new Error('asset_id is required');
    err.status = 400;
    throw err;
  }

  const expiringDays = Math.max(0, parseInt(opts.expiringDays, 10) || 30);
  const renewalExists = await hasVendorRenewalTable(db);

  const { rows: assetRows } = await db.query(
    `
      SELECT
        a.asset_id,
        a.text AS asset_name,
        a.serial_number,
        a.purchase_vendor_id,
        a.service_vendor_id,
        pv.vendor_name AS purchase_vendor_name,
        sv.vendor_name AS service_vendor_name
      FROM "tblAssets" a
      LEFT JOIN "tblVendors" pv ON pv.vendor_id = a.purchase_vendor_id
      LEFT JOIN "tblVendors" sv ON sv.vendor_id = a.service_vendor_id
      WHERE a.org_id = $1 AND a.asset_id = $2
      LIMIT 1
    `,
    [orgId, assetId],
  );

  const asset = assetRows[0];
  if (!asset) {
    const err = new Error('Asset not found');
    err.status = 404;
    throw err;
  }

  const vendorIds = [...new Set(
    [asset.purchase_vendor_id, asset.service_vendor_id].filter(Boolean),
  )];

  if (!vendorIds.length) {
    return {
      asset: {
        asset_id: asset.asset_id,
        asset_name: asset.asset_name,
        serial_number: asset.serial_number,
      },
      rows: [],
      expiringDays,
      note: 'No purchase or service vendor linked to this asset.',
    };
  }

  const { rows: vendors } = await db.query(
    `
      SELECT
        v.vendor_id,
        v.vendor_name,
        v.company_name,
        v.contact_person_name,
        v.contact_person_number,
        v.contact_person_email,
        v.contract_start_date::date AS contract_start_date,
        v.contract_end_date::date AS contract_end_date,
        v.int_status
      FROM "tblVendors" v
      WHERE v.org_id = $1
        AND v.vendor_id = ANY($2::varchar[])
      ORDER BY v.vendor_name
    `,
    [orgId, vendorIds],
  );

  let renewalsByVendor = {};
  if (renewalExists) {
    const { rows: renewals } = await db.query(
      `
        SELECT
          vr.vr_id,
          vr.vendor_id,
          vr.vendor_name,
          vr.contract_start_date::date AS contract_start_date,
          vr.contract_end_date::date AS contract_end_date,
          vr.previous_contract_end_date::date AS previous_contract_end_date,
          vr.renewal_date,
          vr.renewal_approved_by,
          vr.renewal_notes,
          vr.status,
          vr.wfamsh_id
        FROM "tblVendorRenewal" vr
        WHERE vr.org_id = $1
          AND vr.vendor_id = ANY($2::varchar[])
        ORDER BY vr.renewal_date DESC NULLS LAST
      `,
      [orgId, vendorIds],
    );
    renewalsByVendor = renewals.reduce((acc, row) => {
      if (!acc[row.vendor_id]) acc[row.vendor_id] = [];
      acc[row.vendor_id].push({
        ...row,
        renewal_date: toDateOnly(row.renewal_date),
        contract_start_date: toDateOnly(row.contract_start_date),
        contract_end_date: toDateOnly(row.contract_end_date),
        previous_contract_end_date: toDateOnly(row.previous_contract_end_date),
      });
      return acc;
    }, {});
  }

  const rolesFor = (vendorId) => {
    const roles = [];
    if (asset.purchase_vendor_id === vendorId) roles.push('Purchase vendor');
    if (asset.service_vendor_id === vendorId) roles.push('Service vendor');
    return roles;
  };

  const rows = vendors.map((v) => {
    const end = toDateOnly(v.contract_end_date);
    const start = toDateOnly(v.contract_start_date);
    let status = 'No dates';
    let daysLeft = null;
    if (end) {
      const endDate = new Date(`${end}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysLeft = Math.round((endDate - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) status = 'Expired';
      else if (daysLeft <= expiringDays) status = 'Expiring';
      else status = 'Active';
    }

    const history = renewalsByVendor[v.vendor_id] || [];
    const last = history[0] || null;

    return {
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      company_name: v.company_name,
      contact_person_name: v.contact_person_name,
      contact_person_number: v.contact_person_number,
      contact_person_email: v.contact_person_email,
      vendor_role: rolesFor(v.vendor_id).join(', '),
      contract_start_date: start,
      contract_end_date: end,
      days_left: daysLeft,
      status,
      vendor_active: v.int_status === 1 || v.int_status === true,
      last_renewal_date: last?.renewal_date || null,
      last_renewal_end: last?.contract_end_date || null,
      previous_end_date: last?.previous_contract_end_date || null,
      renewal_count: history.length,
      renewals: history,
    };
  });

  return {
    asset: {
      asset_id: asset.asset_id,
      asset_name: asset.asset_name,
      serial_number: asset.serial_number,
    },
    rows,
    expiringDays,
  };
}

module.exports = {
  getCoverageExpiryReport,
  getAssetVendorRenewals,
  VALID_COVERAGE,
  VALID_STATUS,
};
