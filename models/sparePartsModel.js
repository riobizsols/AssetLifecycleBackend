const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomIdForClient } = require('../utils/idGenerator');
const fcmService = require('../services/fcmService');
const { isInhouseMaintainedBy } = require('../utils/inhouseVendorUtils');

const getDb = () => getDbFromContext();

const maintenanceProviderExpression = (
  maintenanceAlias = 'ams',
  frequencyAlias = 'mf',
  assetAlias = 'a',
) => `
  COALESCE(
    NULLIF(BTRIM(${maintenanceAlias}.maintained_by), ''),
    NULLIF(BTRIM(${frequencyAlias}.maintained_by), ''),
    CASE
      WHEN NULLIF(BTRIM(${assetAlias}.service_vendor_id), '') IS NOT NULL
        THEN 'Vendor'
      ELSE NULL
    END
  )
`;

const inhouseMaintenancePredicate = (
  maintenanceAlias = 'ams',
  frequencyAlias = 'mf',
  assetAlias = 'a',
) => {
  const provider = maintenanceProviderExpression(
    maintenanceAlias,
    frequencyAlias,
    assetAlias,
  );
  return `
    NULLIF(BTRIM(${provider}), '') IS NOT NULL
    AND LOWER(REGEXP_REPLACE(BTRIM(${provider}), '[[:space:]-]', '', 'g'))
      NOT LIKE '%vendor%'
  `;
};

const SPARE_ISSUE_STATUS = {
  REQUESTED: 'RQ',
  RESERVED: 'IS',
  ISSUED: 'IE',
};

const parseIssueRemarks = (remarks) => {
  if (!remarks) return {};
  try {
    const parsed = JSON.parse(remarks);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (_) {
    return {};
  }
};

const buildIssueRemarks = ({ spc_id, note = null }) =>
  JSON.stringify({ spc_id, ...(note ? { note } : {}) });

const resolveIssueSpcId = (row) => {
  if (!row) return null;
  const fromRemarks = parseIssueRemarks(row.remarks).spc_id;
  if (fromRemarks) return fromRemarks;
  return row.spc_id || null;
};

const ensureDefaultSpareStore = async (client, { org_id, branch_id, created_by }) => {
  const existing = await client.query(
    `
      SELECT ss_id FROM "tblSpareStore"
      WHERE org_id = $1
      ORDER BY created_on ASC NULLS LAST, ss_id ASC
      LIMIT 1
    `,
    [org_id]
  );
  if (existing.rows.length) return existing.rows[0].ss_id;

  const ss_id = await generateCustomIdForClient(client, 'sp_store', 3);
  await client.query(
    `
      INSERT INTO "tblSpareStore" (
        ss_id, store_code, store_name, contact, store_location,
        org_id, branch_id, created_by, created_on, changed_by, changed_on
      ) VALUES (
        $1, 'DEFAULT', 'Default Spare Store', NULL, NULL,
        $2, $3, $4, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP
      )
    `,
    [ss_id, org_id, branch_id || null, created_by || null]
  );
  return ss_id;
};

const getAvailableQuantity = async (spc_id, org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT COUNT(*)::int AS available_qty
      FROM "tblSPIndDet"
      WHERE org_id = $1
        AND spc_id = $2
        AND COALESCE(is_used, 0) = 0
    `,
    [org_id, spc_id]
  );
  return result.rows[0]?.available_qty || 0;
};

const getCategoryMappingsByAssetType = async (
  org_id,
  asset_type_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [org_id, asset_type_id];
  let query = `
    SELECT DISTINCT
      m.spc_id,
      c.text AS category_name,
      c.uom,
      m.asset_type_id
    FROM "tblSPCatATMap" m
    INNER JOIN "tblSPCategory" c ON c.spc_id = m.spc_id AND c.org_id = m.org_id
    WHERE m.org_id = $1
      AND m.asset_type_id = $2
      AND m.int_status = 1
      AND c.int_status = 1
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (m.branch_id IS NULL OR m.branch_id = $${params.length})`;
  }
  query += ` ORDER BY c.text ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const getSparePartMaintenanceList = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [org_id];
  const provider = maintenanceProviderExpression();
  const inhouseOnly = inhouseMaintenancePredicate();
  let query = `
    SELECT
      ams.ams_id,
      ams.asset_id,
      ams.maint_type_id,
      ams.vendor_id,
      ${provider} AS maintenance_provider,
      ams.status AS maintenance_status,
      a.asset_type_id,
      a.serial_number,
      a.description AS asset_description,
      at.text AS asset_type_name,
      mt.text AS maintenance_type_name,
      v.vendor_name,
      (
        SELECT si.status
        FROM "tblSpareIssue" si
        WHERE si.assetmaintsch_id = ams.ams_id
          AND si.org_id = ams.org_id
        ORDER BY
          CASE si.status WHEN 'IS' THEN 1 WHEN 'IE' THEN 2 WHEN 'RQ' THEN 3 ELSE 4 END,
          si.created_on DESC NULLS LAST
        LIMIT 1
      ) AS spare_status
    FROM "tblAssetMaintSch" ams
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblATMaintFreq" mf
      ON mf.at_main_freq_id = ams.at_main_freq_id
     AND mf.org_id = ams.org_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    WHERE ams.org_id = $1
      AND a.org_id = $1
      AND ${inhouseOnly}
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND a.branch_id = $${params.length}`;
  }
  query += ` ORDER BY ams.created_on DESC, ams.ams_id DESC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const getSparePartMaintenanceDetail = async (
  ams_id,
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [ams_id, org_id];
  const provider = maintenanceProviderExpression();
  const inhouseOnly = inhouseMaintenancePredicate();
  let query = `
    SELECT
      ams.*,
      ${provider} AS maintenance_provider,
      a.asset_type_id,
      a.serial_number,
      a.description AS asset_description,
      at.text AS asset_type_name,
      mt.text AS maintenance_type_name,
      v.vendor_name,
      (
        SELECT si.status
        FROM "tblSpareIssue" si
        WHERE si.assetmaintsch_id = ams.ams_id
          AND si.org_id = ams.org_id
        ORDER BY
          CASE si.status WHEN 'IS' THEN 1 WHEN 'IE' THEN 2 WHEN 'RQ' THEN 3 ELSE 4 END,
          si.created_on DESC NULLS LAST
        LIMIT 1
      ) AS spare_status
    FROM "tblAssetMaintSch" ams
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblATMaintFreq" mf
      ON mf.at_main_freq_id = ams.at_main_freq_id
     AND mf.org_id = ams.org_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    WHERE ams.ams_id = $1
      AND ams.org_id = $2
      AND a.org_id = $2
      AND ${inhouseOnly}
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND a.branch_id = $${params.length}`;
  }
  const result = await dbPool.query(query, params);
  return result.rows[0] || null;
};

const assertInhouseMaintenance = async (client, amsId, orgId) => {
  const result = await client.query(
    `
      SELECT ${maintenanceProviderExpression()} AS maintenance_provider
      FROM "tblAssetMaintSch" ams
      INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
      LEFT JOIN "tblATMaintFreq" mf
        ON mf.at_main_freq_id = ams.at_main_freq_id
       AND mf.org_id = ams.org_id
      WHERE ams.ams_id = $1
        AND ams.org_id = $2
      LIMIT 1
    `,
    [amsId, orgId],
  );

  if (!result.rows.length) {
    const err = new Error('Maintenance schedule not found');
    err.statusCode = 404;
    throw err;
  }

  if (!isInhouseMaintainedBy(result.rows[0].maintenance_provider)) {
    const err = new Error(
      'Spare part requests are available only for in-house maintenance',
    );
    err.statusCode = 400;
    throw err;
  }

  return result.rows[0];
};

const createSpareIssueRequests = async ({
  org_id,
  branch_id,
  assetmaintsch_id,
  items,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    if (!assetmaintsch_id) {
      const err = new Error('Maintenance schedule is required');
      err.statusCode = 400;
      throw err;
    }
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Select at least one spare part category');
      err.statusCode = 400;
      throw err;
    }

    const maint = await client.query(
      `
        SELECT
          ams.ams_id,
          ams.org_id,
          ams.vendor_id,
          a.asset_type_id,
          a.branch_id,
          ${maintenanceProviderExpression()} AS maintenance_provider
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        LEFT JOIN "tblATMaintFreq" mf
          ON mf.at_main_freq_id = ams.at_main_freq_id
         AND mf.org_id = ams.org_id
        WHERE ams.ams_id = $1
          AND ams.org_id = $2
      `,
      [assetmaintsch_id, org_id]
    );
    if (!maint.rows.length) {
      const err = new Error('Maintenance schedule not found');
      err.statusCode = 404;
      throw err;
    }
    if (!isInhouseMaintainedBy(maint.rows[0].maintenance_provider)) {
      const err = new Error(
        'Spare part requests are available only for in-house maintenance'
      );
      err.statusCode = 400;
      throw err;
    }

    const { asset_type_id } = maint.rows[0];
    const ss_id = await ensureDefaultSpareStore(client, {
      org_id,
      branch_id: branch_id || maint.rows[0].branch_id,
      created_by,
    });

    const created = [];

    for (const item of items) {
      const spc_id = item?.spc_id;
      const qty = Number(item?.quantity);
      if (!spc_id) {
        const err = new Error('Category is required for each item');
        err.statusCode = 400;
        throw err;
      }
      if (!Number.isFinite(qty) || qty <= 0 || Math.floor(qty) !== qty) {
        const err = new Error('Quantity must be a positive whole number');
        err.statusCode = 400;
        throw err;
      }

      const stock = await client.query(
        `
          SELECT COUNT(*)::int AS available_qty
          FROM "tblSPIndDet"
          WHERE org_id = $1
            AND spc_id = $2
            AND COALESCE(is_used, 0) = 0
        `,
        [org_id, spc_id]
      );
      const available = stock.rows[0]?.available_qty || 0;
      if (available < qty) {
        const err = new Error(`Insufficient stock. Available: ${available}, Requested: ${qty}`);
        err.statusCode = 400;
        throw err;
      }

      const mapping = await client.query(
        `
          SELECT 1
          FROM "tblSPCatATMap" m
          INNER JOIN "tblSPCategory" c ON c.spc_id = m.spc_id AND c.org_id = m.org_id
          WHERE m.org_id = $1
            AND m.asset_type_id = $2
            AND m.spc_id = $3
            AND m.int_status = 1
            AND c.int_status = 1
          LIMIT 1
        `,
        [org_id, asset_type_id, spc_id]
      );
      if (!mapping.rows.length) {
        const err = new Error(`Category ${spc_id} is not mapped to this asset type`);
        err.statusCode = 400;
        throw err;
      }

      const si_id = await generateCustomIdForClient(client, 'sp_issue', 3);
      const insert = await client.query(
        `
          INSERT INTO "tblSpareIssue" (
            si_id, org_id, branch_id, ss_id, spid_id, quantity_issued,
            issued_to, issued_by, remarks, status, assetmaintsch_id,
            created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, $2, $3, $4, NULL, $5,
            NULL, NULL, $6, $7, $8,
            $9, CURRENT_TIMESTAMP, $9, CURRENT_TIMESTAMP
          )
          RETURNING *
        `,
        [
          si_id,
          org_id,
          branch_id || maint.rows[0].branch_id || null,
          ss_id,
          qty,
          buildIssueRemarks({ spc_id }),
          SPARE_ISSUE_STATUS.REQUESTED,
          assetmaintsch_id,
          created_by || null,
        ]
      );
      created.push(insert.rows[0]);
    }

    await client.query('COMMIT');

    for (const issueRow of created) {
      await notifySparePartIssued({ issueRow, org_id, kind: 'approval' });
    }

    return created;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getSpareIssueApprovals = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [org_id];
  const provider = maintenanceProviderExpression();
  const inhouseOnly = inhouseMaintenancePredicate();
  let query = `
    SELECT
      si.si_id,
      si.status,
      si.quantity_issued,
      si.remarks,
      si.created_on,
      si.changed_on,
      si.assetmaintsch_id,
      si.spid_id,
      ams.maint_type_id,
      ${provider} AS maintenance_provider,
      a.asset_type_id,
      a.serial_number,
      at.text AS asset_type_name,
      mt.text AS maintenance_type_name,
      v.vendor_name,
      ind.spc_id AS issued_spc_id
    FROM "tblSpareIssue" si
    INNER JOIN "tblAssetMaintSch" ams ON si.assetmaintsch_id = ams.ams_id
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblATMaintFreq" mf
      ON mf.at_main_freq_id = ams.at_main_freq_id
     AND mf.org_id = ams.org_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    LEFT JOIN "tblSPIndDet" ind ON si.spid_id = ind.spid_id
    WHERE si.org_id = $1
      AND si.status IN ('RQ', 'IS', 'IE')
      AND ${inhouseOnly}
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (si.branch_id IS NULL OR si.branch_id = $${params.length})`;
  }
  query += ` ORDER BY si.created_on DESC, si.si_id DESC`;
  const result = await dbPool.query(query, params);

  const spcIds = [
    ...new Set(
      result.rows
        .map((row) => row.issued_spc_id || resolveIssueSpcId(row))
        .filter(Boolean)
    ),
  ];
  let categoryMap = {};
  if (spcIds.length) {
    const cats = await dbPool.query(
      `
        SELECT spc_id, text AS category_name
        FROM "tblSPCategory"
        WHERE org_id = $1
          AND spc_id = ANY($2::text[])
      `,
      [org_id, spcIds]
    );
    categoryMap = Object.fromEntries(cats.rows.map((c) => [c.spc_id, c.category_name]));
  }

  return result.rows.map((row) => {
    const spc_id = row.issued_spc_id || resolveIssueSpcId(row);
    return {
      ...row,
      spc_id,
      category_name: categoryMap[spc_id] || null,
    is_approved: row.status === SPARE_ISSUE_STATUS.RESERVED || row.status === SPARE_ISSUE_STATUS.ISSUED,
    };
  });
};

const getSpareIssueApprovalDetail = async (
  si_id,
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [si_id, org_id];
  const provider = maintenanceProviderExpression();
  const inhouseOnly = inhouseMaintenancePredicate();
  let query = `
    SELECT
      si.*,
      ams.maint_type_id,
      ams.vendor_id,
      ${provider} AS maintenance_provider,
      a.asset_type_id,
      a.serial_number,
      at.text AS asset_type_name,
      mt.text AS maintenance_type_name,
      v.vendor_name,
      ind.spc_id AS issued_spc_id
    FROM "tblSpareIssue" si
    INNER JOIN "tblAssetMaintSch" ams ON si.assetmaintsch_id = ams.ams_id
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblATMaintFreq" mf
      ON mf.at_main_freq_id = ams.at_main_freq_id
     AND mf.org_id = ams.org_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    LEFT JOIN "tblSPIndDet" ind ON si.spid_id = ind.spid_id
    WHERE si.si_id = $1
      AND si.org_id = $2
      AND ${inhouseOnly}
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (si.branch_id IS NULL OR si.branch_id = $${params.length})`;
  }
  const result = await dbPool.query(query, params);
  const row = result.rows[0];
  if (!row) return null;

  const spc_id = row.issued_spc_id || resolveIssueSpcId(row);
  let category_name = null;
  if (spc_id) {
    const cat = await dbPool.query(
      `SELECT text AS category_name FROM "tblSPCategory" WHERE spc_id = $1 AND org_id = $2 LIMIT 1`,
      [spc_id, org_id]
    );
    category_name = cat.rows[0]?.category_name || null;
  }
  const available_qty = spc_id ? await getAvailableQuantity(spc_id, org_id) : 0;

  return {
    ...row,
    spc_id,
    category_name,
    available_qty,
    is_approved: row.status === SPARE_ISSUE_STATUS.RESERVED || row.status === SPARE_ISSUE_STATUS.ISSUED,
  };
};

const ensureSpareIssuedPreference = async (dbPool, userId) => {
  if (!userId) return;
  const prefCheck = await dbPool.query(
    `
      SELECT preference_id
      FROM "tblNotificationPreferences"
      WHERE user_id = $1 AND notification_type = $2
      LIMIT 1
    `,
    [userId, 'spare_part_issued'],
  );
  if (prefCheck.rows.length) return;

  const preferenceId = `PREF${Math.random().toString(36).slice(2, 15).toUpperCase()}`;
  try {
    await dbPool.query(
      `
        INSERT INTO "tblNotificationPreferences" (
          preference_id, user_id, notification_type,
          is_enabled, email_enabled, push_enabled
        ) VALUES ($1, $2, 'spare_part_issued', true, true, true)
      `,
      [preferenceId, userId],
    );
  } catch (prefErr) {
    console.warn('Could not create spare_part_issued preference:', prefErr.message);
  }
};

const getSpareApprovalUserIds = async (dbPool, orgId = null) => {
  const params = [];
  let orgFilter = '';
  if (orgId) {
    params.push(orgId);
    orgFilter = ` AND (u.org_id = $${params.length} OR u.org_id IS NULL)`;
  }
  const result = await dbPool.query(
    `
      SELECT DISTINCT u.user_id
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
      INNER JOIN "tblJobRoleNav" n
        ON n.job_role_id = ujr.job_role_id
       AND n.app_id = 'SPAREPARTAPPROVAL'
       AND COALESCE(n.int_status, 1) = 1
      WHERE u.int_status = 1
        ${orgFilter}
    `,
    params,
  );
  return result.rows.map((r) => r.user_id).filter(Boolean);
};

const isSpareApproverByEmpIntId = async (dbPool, empIntId) => {
  if (!empIntId) return false;
  const result = await dbPool.query(
    `
      SELECT 1
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
      INNER JOIN "tblJobRoleNav" n
        ON n.job_role_id = ujr.job_role_id
       AND n.app_id = 'SPAREPARTAPPROVAL'
       AND COALESCE(n.int_status, 1) = 1
      WHERE u.int_status = 1
        AND u.emp_int_id = $1
      LIMIT 1
    `,
    [empIntId],
  );
  return result.rows.length > 0;
};

const getSystemAdminUserIds = async (dbPool, orgId = null) => {
  const params = [];
  let orgFilter = '';
  if (orgId) {
    params.push(orgId);
    orgFilter = ` AND (u.org_id = $${params.length} OR u.org_id IS NULL)`;
  }
  const result = await dbPool.query(
    `
      SELECT DISTINCT u.user_id
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
      INNER JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
      WHERE u.int_status = 1
        AND (
          ujr.job_role_id = 'JR001'
          OR LOWER(TRIM(jr.text)) = 'system administrator'
        )
        ${orgFilter}
    `,
    params,
  );
  return result.rows.map((r) => r.user_id).filter(Boolean);
};

const isSystemAdminByEmpIntId = async (dbPool, empIntId) => {
  if (!empIntId) return false;
  const result = await dbPool.query(
    `
      SELECT 1
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
      INNER JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
      WHERE u.int_status = 1
        AND u.emp_int_id = $1
        AND (
          ujr.job_role_id = 'JR001'
          OR LOWER(TRIM(jr.text)) = 'system administrator'
        )
      LIMIT 1
    `,
    [empIntId],
  );
  return result.rows.length > 0;
};

const notifySparePartIssued = async ({ issueRow, org_id, kind = 'reserved' }) => {
  try {
    const spc_id = resolveIssueSpcId(issueRow) || issueRow.spc_id;
    if (!spc_id) return { success: false };

    const dbPool = getDb();
    const meta = await dbPool.query(
      `
        SELECT
          at.text AS asset_type_name,
          c.text AS category_name,
          a.asset_type_id,
          si.assetmaintsch_id,
          si.quantity_issued
        FROM "tblSpareIssue" si
        INNER JOIN "tblAssetMaintSch" ams
          ON si.assetmaintsch_id = ams.ams_id AND ams.org_id = si.org_id
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        INNER JOIN "tblSPCategory" c
          ON c.spc_id = $2 AND c.org_id = si.org_id AND c.int_status = 1
        LEFT JOIN "tblSPCatATMap" m
          ON m.org_id = si.org_id
         AND m.spc_id = c.spc_id
         AND m.asset_type_id = a.asset_type_id
         AND m.int_status = 1
        WHERE si.si_id = $1
          AND si.org_id = $3
        LIMIT 1
      `,
      [issueRow.si_id, spc_id, org_id],
    );

    let assetTypeName = meta.rows[0]?.asset_type_name;
    let categoryName = meta.rows[0]?.category_name;
    let maintenanceId =
      meta.rows[0]?.assetmaintsch_id || issueRow.assetmaintsch_id || '';
    const quantityIssued =
      meta.rows[0]?.quantity_issued ?? issueRow.quantity_issued ?? '';

    if (!assetTypeName || !categoryName) {
      const fallback = await dbPool.query(
        `
          SELECT
            at.text AS asset_type_name,
            c.text AS category_name,
            si.assetmaintsch_id
          FROM "tblSpareIssue" si
          INNER JOIN "tblAssetMaintSch" ams ON si.assetmaintsch_id = ams.ams_id
          INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
          INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
          LEFT JOIN "tblSPCategory" c ON c.spc_id = $2 AND c.org_id = si.org_id
          WHERE si.si_id = $1 AND si.org_id = $3
          LIMIT 1
        `,
        [issueRow.si_id, spc_id, org_id],
      );
      assetTypeName = assetTypeName || fallback.rows[0]?.asset_type_name || 'Asset';
      categoryName = categoryName || fallback.rows[0]?.category_name || spc_id;
      maintenanceId =
        maintenanceId || fallback.rows[0]?.assetmaintsch_id || '';
    }

    const isConfirmed = kind === 'issued';
    const isApproval = kind === 'requested' || kind === 'approval';
    const title = isConfirmed
      ? 'Spare Part Issued'
      : isApproval
        ? 'Spare Part Approval'
        : 'Spare Part Requested';
    const verb = isConfirmed ? 'issued' : isApproval ? 'pending approval' : 'requested';
    const body = `Maintenance ${maintenanceId || '-'}: ${assetTypeName} / ${categoryName} — spare part ${verb}${
      quantityIssued !== '' && quantityIssued != null
        ? ` (qty ${quantityIssued})`
        : ''
    }`;
    const payload = {
      type: isConfirmed
        ? 'spare_part_confirmed'
        : isApproval
          ? 'spare_part_approval'
          : 'spare_part_requested',
      si_id: issueRow.si_id,
      assetmaintsch_id: maintenanceId || '',
      maintenance_id: maintenanceId || '',
      asset_type_name: assetTypeName,
      category_name: categoryName,
      quantity_issued: String(quantityIssued ?? ''),
      status: isConfirmed ? 'Issued' : isApproval ? 'Approval' : 'Requested',
      spc_id,
      route: isConfirmed
        ? `/spare-part-issue`
        : `/spare-part-approval-detail/${issueRow.si_id || ''}`,
    };

    const adminUserIds = await getSystemAdminUserIds(dbPool, org_id);
    const targetUserIds = new Set(adminUserIds);
    if (issueRow.created_by) targetUserIds.add(issueRow.created_by);
    if (isApproval) {
      const approverIds = await getSpareApprovalUserIds(dbPool, org_id);
      for (const userId of approverIds) targetUserIds.add(userId);
    }

    for (const userId of targetUserIds) {
      await ensureSpareIssuedPreference(dbPool, userId);
      try {
        await fcmService.sendNotificationToUser({
          userId,
          title,
          body,
          data: payload,
          notificationType: 'spare_part_issued',
        });
      } catch (sendErr) {
        console.warn(
          `notifySparePartIssued: push failed for ${userId}:`,
          sendErr.message,
        );
      }
    }

    return { success: true, notifiedUsers: [...targetUserIds] };
  } catch (error) {
    console.error('notifySparePartIssued error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * In-app notifications for requested (RQ), reserved (IS), and issued (IE) spare parts.
 * Requesters see their own; System Administrators see all org rows.
 */
const getSpareIssuedNotificationsByUser = async ({
  empIntId,
  orgId,
  branchId,
  hasSuperAccess = false,
}) => {
  const dbPool = getDb();
  const isAdmin =
    hasSuperAccess || (await isSystemAdminByEmpIntId(dbPool, empIntId));
  const isApprover = isAdmin || (await isSpareApproverByEmpIntId(dbPool, empIntId));

  const params = [orgId];
  let branchFilter = '';
  if (!hasSuperAccess && branchId) {
    params.push(branchId);
    branchFilter = ` AND (a.branch_id = $${params.length} OR a.branch_id IS NULL OR si.branch_id = $${params.length})`;
  }

  let requesterJoin = '';
  if (!isApprover) {
    params.push(empIntId);
    requesterJoin = `
      INNER JOIN "tblUsers" u
        ON u.user_id = si.created_by
       AND u.emp_int_id = $${params.length}
       AND u.int_status = 1
    `;
  }

  const result = await dbPool.query(
    `
      SELECT
        si.si_id,
        si.status,
        si.quantity_issued,
        si.remarks,
        si.created_on,
        si.changed_on,
        si.assetmaintsch_id,
        ams.act_maint_st_date AS due_date,
        COALESCE(issuer.full_name, changer.full_name, creator.full_name) AS action_by_name,
        at.asset_type_id,
        at.text AS asset_type_name,
        c.spc_id,
        c.text AS category_name
      FROM "tblSpareIssue" si
      ${requesterJoin}
      INNER JOIN "tblAssetMaintSch" ams
        ON ams.ams_id = si.assetmaintsch_id
       AND ams.org_id = si.org_id
      INNER JOIN "tblAssets" a ON a.asset_id = ams.asset_id
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      LEFT JOIN "tblUsers" issuer ON issuer.user_id = si.issued_by
      LEFT JOIN "tblUsers" changer ON changer.user_id = si.changed_by
      LEFT JOIN "tblUsers" creator ON creator.user_id = si.created_by
      LEFT JOIN "tblSPCategory" c
        ON c.org_id = si.org_id
       AND c.int_status = 1
       AND c.spc_id = COALESCE(
             CASE
               WHEN si.remarks ~ '^\\s*\\{' THEN (si.remarks::jsonb ->> 'spc_id')
               ELSE NULL
             END,
             NULL
           )
      WHERE si.org_id = $1
        AND si.status IN ($${params.length + 1}, $${params.length + 2}, $${params.length + 3})
        ${branchFilter}
      ORDER BY COALESCE(si.changed_on, si.created_on) DESC
      LIMIT 100
    `,
    [
      ...params,
      SPARE_ISSUE_STATUS.REQUESTED,
      SPARE_ISSUE_STATUS.RESERVED,
      SPARE_ISSUE_STATUS.ISSUED,
    ],
  );

  const rows = [];
  for (const row of result.rows) {
    let spc_id = row.spc_id || resolveIssueSpcId(row);
    let category_name = row.category_name;
    if (!category_name && spc_id) {
      const cat = await dbPool.query(
        `
          SELECT text AS category_name
          FROM "tblSPCategory"
          WHERE spc_id = $1 AND org_id = $2 AND int_status = 1
          LIMIT 1
        `,
        [spc_id, orgId],
      );
      category_name = cat.rows[0]?.category_name || spc_id;
    }
    if (!spc_id && !category_name) continue;
    rows.push({
      ...row,
      spc_id,
      category_name: category_name || spc_id,
      status_label:
        row.status === SPARE_ISSUE_STATUS.ISSUED
          ? 'Issued'
          : row.status === SPARE_ISSUE_STATUS.REQUESTED
            ? 'Approval'
            : 'Requested',
    });
  }
  return rows;
};

const approveSpareIssue = async ({
  si_id,
  org_id,
  branch_id,
  approved_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    let lockQuery = `
      SELECT *
      FROM "tblSpareIssue"
      WHERE si_id = $1
        AND org_id = $2
      FOR UPDATE
    `;
    const lockParams = [si_id, org_id];
    const locked = await client.query(lockQuery, lockParams);
    if (!locked.rows.length) {
      const err = new Error('Spare part request not found');
      err.statusCode = 404;
      throw err;
    }

    const issue = locked.rows[0];
    await assertInhouseMaintenance(client, issue.assetmaintsch_id, org_id);
    if (
      issue.status === SPARE_ISSUE_STATUS.RESERVED ||
      issue.status === SPARE_ISSUE_STATUS.ISSUED
    ) {
      const err = new Error('This spare part request has already been approved');
      err.statusCode = 409;
      err.code = 'ALREADY_APPROVED';
      throw err;
    }
    if (issue.status !== SPARE_ISSUE_STATUS.REQUESTED) {
      const err = new Error('This spare part request is not pending approval');
      err.statusCode = 400;
      throw err;
    }

    const spc_id = resolveIssueSpcId(issue);
    if (!spc_id) {
      const err = new Error('Category not found on spare part request');
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(issue.quantity_issued);
    const available = await client.query(
      `
        SELECT spid_id
        FROM "tblSPIndDet"
        WHERE org_id = $1
          AND spc_id = $2
          AND COALESCE(is_used, 0) = 0
        ORDER BY created_on ASC, spid_id ASC
        LIMIT $3
        FOR UPDATE
      `,
      [org_id, spc_id, qty]
    );

    if (available.rows.length < qty) {
      const err = new Error(
        `Insufficient stock. Available: ${available.rows.length}, Requested: ${qty}`
      );
      err.statusCode = 400;
      throw err;
    }

    const spidIds = available.rows.map((r) => r.spid_id);
    await client.query(
      `
        UPDATE "tblSPIndDet"
        SET is_used = 1,
            changed_by = $2,
            changed_on = CURRENT_TIMESTAMP
        WHERE spid_id = ANY($1::text[])
          AND org_id = $3
      `,
      [spidIds, approved_by || null, org_id]
    );

    const updateResult = await client.query(
      `
        UPDATE "tblSpareIssue"
        SET status = $1,
            spid_id = $2,
            issued_by = $3,
            changed_by = $3,
            changed_on = CURRENT_TIMESTAMP
        WHERE si_id = $4
          AND org_id = $5
          AND status = $6
        RETURNING *
      `,
      [
        SPARE_ISSUE_STATUS.RESERVED,
        spidIds[0],
        approved_by || null,
        si_id,
        org_id,
        SPARE_ISSUE_STATUS.REQUESTED,
      ]
    );

    if (!updateResult.rows.length) {
      const err = new Error('Spare part request was already processed');
      err.statusCode = 409;
      err.code = 'ALREADY_APPROVED';
      throw err;
    }

    const sph_id = await generateCustomIdForClient(client, 'spare_history', 3);
    await client.query(
      `
        INSERT INTO "tblSpareHistory" (
          sph_id, si_id, status, remarks, org_id, branch_id, created_by, created_on
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
        )
      `,
      [
        sph_id,
        si_id,
        SPARE_ISSUE_STATUS.RESERVED,
        `Reserved ${qty} unit(s) for category ${spc_id}`,
        org_id,
        branch_id || issue.branch_id || null,
        approved_by || null,
      ]
    );

    await client.query('COMMIT');

    const approvedRow = updateResult.rows[0];
    await notifySparePartIssued({ issueRow: approvedRow, org_id });

    return approvedRow;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const confirmSparePartIssue = async ({
  ams_id,
  org_id,
  branch_id,
  issued_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    await assertInhouseMaintenance(client, ams_id, org_id);

    const locked = await client.query(
      `
        SELECT *
        FROM "tblSpareIssue"
        WHERE assetmaintsch_id = $1
          AND org_id = $2
          AND status = $3
        FOR UPDATE
      `,
      [ams_id, org_id, SPARE_ISSUE_STATUS.RESERVED],
    );

    if (!locked.rows.length) {
      const err = new Error('No reserved spare parts found to issue');
      err.statusCode = 404;
      throw err;
    }

    const confirmed = [];
    for (const issue of locked.rows) {
      const updated = await client.query(
        `
          UPDATE "tblSpareIssue"
          SET status = $1,
              issued_by = $2,
              changed_by = $2,
              changed_on = CURRENT_TIMESTAMP
          WHERE si_id = $3
            AND org_id = $4
            AND status = $5
          RETURNING *
        `,
        [
          SPARE_ISSUE_STATUS.ISSUED,
          issued_by || null,
          issue.si_id,
          org_id,
          SPARE_ISSUE_STATUS.RESERVED,
        ],
      );
      if (!updated.rows.length) continue;

      const sph_id = await generateCustomIdForClient(client, 'spare_history', 3);
      await client.query(
        `
          INSERT INTO "tblSpareHistory" (
            sph_id, si_id, status, remarks, org_id, branch_id, created_by, created_on
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
          )
        `,
        [
          sph_id,
          issue.si_id,
          SPARE_ISSUE_STATUS.ISSUED,
          `Issued reserved spare part ${issue.si_id}`,
          org_id,
          branch_id || issue.branch_id || null,
          issued_by || null,
        ],
      );
      confirmed.push(updated.rows[0]);
    }

    if (!confirmed.length) {
      const err = new Error('Spare parts were already issued');
      err.statusCode = 409;
      throw err;
    }

    await client.query('COMMIT');

    for (const row of confirmed) {
      await notifySparePartIssued({ issueRow: row, org_id, kind: 'issued' });
    }

    return confirmed;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Convert spare category ID to serial prefix (same idea as asset types).
 * SPC001 -> 01, SPC012 -> 12, SPC101 -> 01 (last 2 digits).
 * Format: [CategoryCode 2][ReversedYear 2][Month 2][Running 5]
 */
const convertSpcToSerialFormat = (spcId) => {
  const id = String(spcId || '');
  if (id.toUpperCase().startsWith('SPC')) {
    const numericPart = id.replace(/^SPC/i, '');
    const n = parseInt(numericPart, 10);
    if (Number.isFinite(n)) {
      return String(n % 100).padStart(2, '0');
    }
  }
  const digits = id.replace(/\D/g, '');
  if (digits) {
    return String(parseInt(digits, 10) % 100).padStart(2, '0');
  }
  return '00';
};

const buildSpareSerialNumber = (spcId, sequence) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const reversedYear = year.split('').reverse().join('');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = convertSpcToSerialFormat(spcId);
  return `${prefix}${reversedYear}${month}${String(sequence).padStart(5, '0')}`;
};

/**
 * Extract trailing 5-digit running number from a serial (asset-style).
 * Returns null if the value is not a 11-digit numeric serial.
 */
const extractSequenceFromSerial = (serialNumber) => {
  const s = String(serialNumber || '').trim();
  if (!/^\d{11}$/.test(s)) return null;
  const seq = parseInt(s.slice(-5), 10);
  return Number.isFinite(seq) ? seq : null;
};

/**
 * Atomically reserve the next N sequences on tblSPCategory.last_gen_seq_no
 * (same technique as tblAssetTypes for assets). Counter only increases —
 * deleting a tblSPIndDet row never frees a sequence, so serials are never reused.
 */
const allocateAutoSerialNumbers = async (client, { spc_id, org_id, count }) => {
  const serials = [];
  for (let i = 0; i < count; i += 1) {
    const seqResult = await client.query(
      `
        UPDATE "tblSPCategory"
        SET last_gen_seq_no = COALESCE(last_gen_seq_no, 0) + 1,
            changed_on = CURRENT_TIMESTAMP
        WHERE spc_id = $1
          AND org_id = $2
        RETURNING last_gen_seq_no
      `,
      [spc_id, org_id]
    );
    if (!seqResult.rows.length) {
      const err = new Error('Failed to allocate spare part serial sequence');
      err.statusCode = 500;
      throw err;
    }
    const nextSequence = parseInt(seqResult.rows[0].last_gen_seq_no, 10);
    serials.push(buildSpareSerialNumber(spc_id, nextSequence));
  }
  return serials;
};

/**
 * If manual serials look like our generated format, advance last_gen_seq_no
 * to at least the highest sequence used (same idea as asset create).
 * Never decreases the counter.
 */
const bumpSeqFromManualSerials = async (client, { spc_id, org_id, serials }) => {
  let maxSeq = 0;
  for (const serial of serials) {
    const seq = extractSequenceFromSerial(serial);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  if (maxSeq <= 0) return;

  await client.query(
    `
      UPDATE "tblSPCategory"
      SET last_gen_seq_no = GREATEST(COALESCE(last_gen_seq_no, 0), $1),
          changed_on = CURRENT_TIMESTAMP
      WHERE spc_id = $2
        AND org_id = $3
    `,
    [maxSeq, spc_id, org_id]
  );
};

/**
 * Spare-part categories for an org (tblSPCategory).
 * @param {boolean} activeOnly - when true, only int_status = 1
 */
const ensureSpBrandModelSchema = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "tblSPBrand" (
      spb_id character varying(20) PRIMARY KEY,
      text character varying(100) NOT NULL,
      int_status integer NOT NULL DEFAULT 1,
      org_id character varying(10) NOT NULL,
      branch_id character varying(10),
      created_by character varying(50),
      created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by character varying(50),
      changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "tblSPBMod" (
      spbm_id character varying(20) PRIMARY KEY,
      spb_id character varying(20) NOT NULL,
      text character varying(100) NOT NULL,
      int_status integer NOT NULL DEFAULT 1,
      org_id character varying(10) NOT NULL,
      branch_id character varying(10),
      created_by character varying(50),
      created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by character varying(50),
      changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    ALTER TABLE "tblSPCategory"
      ADD COLUMN IF NOT EXISTS spb_id character varying(20)
  `);
  await client.query(`
    ALTER TABLE "tblSPCategory"
      ADD COLUMN IF NOT EXISTS spm_id character varying(20)
  `);

  // Minimum stock / reorder level are optional on create
  try {
    await client.query(`
      ALTER TABLE "tblSPCategory"
        ALTER COLUMN minimum_stock DROP NOT NULL
    `);
  } catch (error) {
    console.warn('[spareParts] Could not make minimum_stock nullable:', error.message);
  }
  try {
    await client.query(`
      ALTER TABLE "tblSPCategory"
        ALTER COLUMN re_order_level DROP NOT NULL
    `);
  } catch (error) {
    console.warn('[spareParts] Could not make re_order_level nullable:', error.message);
  }

  try {
    await client.query(`
      INSERT INTO "tblSPBrand" (
        spb_id, text, int_status, org_id, branch_id,
        created_by, created_on, changed_by, changed_on
      )
      SELECT
        i."spbId",
        i."brandName",
        COALESCE(i.int_status, 1),
        i.org_id,
        i.branch_id,
        i.created_by,
        i.created_on,
        i.changed_by,
        i.changed_on
      FROM "tblISPBrand" i
      WHERE i."spbId" IS NOT NULL
        AND BTRIM(COALESCE(i."brandName", '')) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "tblSPBrand" b WHERE b.spb_id = i."spbId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "tblSPBrand" b
          WHERE b.org_id = i.org_id
            AND LOWER(BTRIM(b.text)) = LOWER(BTRIM(i."brandName"))
        )
    `);
  } catch (error) {
    console.warn('[spareParts] Could not sync brands from tblISPBrand:', error.message);
  }

  try {
    await client.query(`
      INSERT INTO "tblSPBMod" (
        spbm_id, spb_id, text, int_status, org_id, branch_id,
        created_by, created_on, changed_by, changed_on
      )
      SELECT
        i."spbmId",
        i."spbId",
        i."modelName",
        COALESCE(i.int_status, 1),
        i.org_id,
        i.branch_id,
        i.created_by,
        i.created_on,
        i.changed_by,
        i.changed_on
      FROM "tblISPModel" i
      WHERE i."spbmId" IS NOT NULL
        AND i."spbId" IS NOT NULL
        AND BTRIM(COALESCE(i."modelName", '')) <> ''
        AND EXISTS (
          SELECT 1 FROM "tblSPBrand" b WHERE b.spb_id = i."spbId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "tblSPBMod" m WHERE m.spbm_id = i."spbmId"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "tblSPBMod" m
          WHERE m.spb_id = i."spbId"
            AND m.org_id = i.org_id
            AND LOWER(BTRIM(m.text)) = LOWER(BTRIM(i."modelName"))
        )
    `);
  } catch (error) {
    console.warn('[spareParts] Could not sync models from tblISPModel:', error.message);
  }
};

const getCategories = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false,
  activeOnly = true,
  skipBranchFilter = false
) => {
  const dbPool = getDb();
  const params = [org_id];
  await ensureSpBrandModelSchema(dbPool);

  let query = `
    SELECT
      c.spc_id,
      c.text,
      c.uom,
      c.minimum_stock,
      c.re_order_level,
      c.int_status,
      c.org_id,
      c.branch_id,
      c.created_by,
      c.created_on,
      c.changed_by,
      c.changed_on,
      c.spb_id,
      c.spm_id,
      b.text AS brand_name,
      m.text AS model_name
    FROM "tblSPCategory" c
    LEFT JOIN "tblSPBrand" b ON b.spb_id = c.spb_id
    LEFT JOIN "tblSPBMod" m ON m.spbm_id = c.spm_id
    WHERE c.org_id = $1
  `;

  if (activeOnly) {
    query += ` AND c.int_status = 1`;
  }

  if (!skipBranchFilter && !hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (c.branch_id IS NULL OR c.branch_id = $${params.length})`;
  }

  query += ` ORDER BY c.text ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const createCategory = async ({
  org_id,
  branch_id,
  text,
  uom,
  minimum_stock,
  re_order_level,
  spb_id,
  spm_id,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    await ensureSpBrandModelSchema(client);

    const name = String(text || '').trim();
    if (!name) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }
    if (!uom || !String(uom).trim()) {
      const err = new Error('UOM is required');
      err.statusCode = 400;
      throw err;
    }
    if (!spb_id) {
      const err = new Error('Brand is required');
      err.statusCode = 400;
      throw err;
    }
    if (!spm_id) {
      const err = new Error('Model is required');
      err.statusCode = 400;
      throw err;
    }

    const brand = await client.query(
      `
        SELECT spb_id FROM "tblSPBrand"
        WHERE spb_id = $1 AND org_id = $2 AND int_status = 1
      `,
      [spb_id, org_id]
    );
    if (!brand.rows.length) {
      const err = new Error('Selected brand was not found');
      err.statusCode = 400;
      throw err;
    }

    const model = await client.query(
      `
        SELECT spbm_id AS spm_id FROM "tblSPBMod"
        WHERE spbm_id = $1 AND spb_id = $2 AND org_id = $3 AND int_status = 1
      `,
      [spm_id, spb_id, org_id]
    );
    if (!model.rows.length) {
      const err = new Error('Selected model was not found for the selected brand');
      err.statusCode = 400;
      throw err;
    }

    const parseOptionalNonNegative = (value, label) => {
      if (value === undefined || value === null || value === '') return null;
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        const err = new Error(`${label} must be a valid non-negative number`);
        err.statusCode = 400;
        throw err;
      }
      return num;
    };
    const minStock = parseOptionalNonNegative(minimum_stock, 'Minimum stock');
    const reorder = parseOptionalNonNegative(re_order_level, 'Reorder level');

    const dup = await client.query(
      `
        SELECT 1 FROM "tblSPCategory"
        WHERE org_id = $1
          AND LOWER(TRIM(text)) = LOWER($2)
        LIMIT 1
      `,
      [org_id, name]
    );
    if (dup.rows.length) {
      const err = new Error('A spare part category with this name already exists');
      err.statusCode = 400;
      throw err;
    }

    const spc_id = await generateCustomIdForClient(client, 'sp_category', 3);

    const result = await client.query(
      `
        INSERT INTO "tblSPCategory" (
          spc_id, text, uom, minimum_stock, re_order_level, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on,
          spb_id, spm_id
        ) VALUES (
          $1, $2, $3, $4, $5, 1,
          $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP,
          $9, $10
        )
        RETURNING *
      `,
      [
        spc_id,
        name,
        String(uom).trim(),
        minStock,
        reorder,
        org_id,
        branch_id || null,
        created_by || null,
        spb_id,
        spm_id,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

const getTableColumnSet = async (client, tableName) => {
  const result = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
    `,
    [tableName]
  );
  return new Set(result.rows.map((row) => row.column_name));
};

const pickColumn = (columns, candidates) =>
  candidates.find((name) => columns.has(name)) || null;

const getSpBrands = async (org_id, spc_id = null) => {
  if (spc_id) {
    const rows = await getLotBrandsByCategory(org_id, spc_id);
    return rows
      .map((row) => ({
        spb_id: row.brand_id || row.spb_id || row.spbId,
        text: row.brand_name || row.text || row.brandName,
      }))
      .filter((row) => row.spb_id && row.text);
  }

  const dbPool = getDb();
  await ensureSpBrandModelSchema(dbPool);

  const columns = await getTableColumnSet(dbPool, 'tblSPBrand');
  const idCol = pickColumn(columns, ['spb_id', 'spbId', 'brand_id']);
  const nameCol = pickColumn(columns, ['text', 'brandName', 'brand_name', 'name']);
  if (!idCol || !nameCol) return [];

  const statusFilter = columns.has('int_status')
    ? 'AND COALESCE(int_status, 1) = 1'
    : '';

  const params = [];
  let query = `
    SELECT DISTINCT ${quoteIdent(idCol)} AS spb_id, ${quoteIdent(nameCol)} AS text
    FROM "tblSPBrand" b
    WHERE 1=1
      ${statusFilter}
  `;

  if (columns.has('org_id') && org_id) {
    params.push(org_id);
    query += ` AND (b.org_id = $${params.length} OR b.org_id IS NULL)`;
  }

  if (spc_id) {
    params.push(spc_id);
    const spcParam = `$${params.length}`;
    query += `
      AND (
        b.${quoteIdent(idCol)} IN (
          SELECT c.spb_id
          FROM "tblSPCategory" c
          WHERE c.spc_id = ${spcParam}
            AND c.spb_id IS NOT NULL
        )
        OR b.${quoteIdent(idCol)} IN (
          SELECT m.spb_id
          FROM "tblSPCategory" c
          INNER JOIN "tblSPBMod" m
            ON m.spbm_id = c.spm_id
          WHERE c.spc_id = ${spcParam}
            AND m.spb_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM "tblSPCategory" c
          INNER JOIN "tblISPModCat" mc
            ON mc."spcId" = c.spc_id
          INNER JOIN "tblISPModel" im
            ON im."spbmId" = mc."spbmId"
          INNER JOIN "tblISPBrand" ib
            ON ib."spbId" = im."spbId"
          WHERE c.spc_id = ${spcParam}
            AND LOWER(BTRIM(ib."brandName")) = LOWER(BTRIM(b.${quoteIdent(nameCol)}))
        )
      )
    `;
  }

  query += ` ORDER BY ${quoteIdent(nameCol)} ASC`;

  let result;
  try {
    result = await dbPool.query(query, params);
  } catch (error) {
    if (!spc_id) throw error;
    const fallbackParams = [];
    let fallback = `
      SELECT DISTINCT ${quoteIdent(idCol)} AS spb_id, ${quoteIdent(nameCol)} AS text
      FROM "tblSPBrand" b
      WHERE 1=1
        ${statusFilter}
    `;
    if (columns.has('org_id') && org_id) {
      fallbackParams.push(org_id);
      fallback += ` AND (b.org_id = $${fallbackParams.length} OR b.org_id IS NULL)`;
    }
    fallbackParams.push(spc_id);
    const spcParam = `$${fallbackParams.length}`;
    fallback += `
      AND (
        b.${quoteIdent(idCol)} IN (
          SELECT c.spb_id FROM "tblSPCategory" c
          WHERE c.spc_id = ${spcParam} AND c.spb_id IS NOT NULL
        )
        OR b.${quoteIdent(idCol)} IN (
          SELECT m.spb_id
          FROM "tblSPCategory" c
          INNER JOIN "tblSPBMod" m ON m.spbm_id = c.spm_id
          WHERE c.spc_id = ${spcParam} AND m.spb_id IS NOT NULL
        )
      )
      ORDER BY ${quoteIdent(nameCol)} ASC
    `;
    result = await dbPool.query(fallback, fallbackParams);
  }

  if (!result.rows.length && columns.has('org_id') && org_id && !spc_id) {
    result = await dbPool.query(
      `
        SELECT DISTINCT ${quoteIdent(idCol)} AS spb_id, ${quoteIdent(nameCol)} AS text
        FROM "tblSPBrand" b
        WHERE 1=1
          ${statusFilter}
        ORDER BY ${quoteIdent(nameCol)} ASC
      `
    );
  }
  return result.rows;
};

const createSpBrand = async ({ org_id, branch_id, text, created_by }) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    await ensureSpBrandModelSchema(client);

    const name = String(text || '').trim();
    if (!name) {
      const err = new Error('Brand is required');
      err.statusCode = 400;
      throw err;
    }

    const dupSp = await client.query(
      `
        SELECT spb_id FROM "tblSPBrand"
        WHERE org_id = $1
          AND LOWER(BTRIM(text)) = LOWER($2)
        LIMIT 1
      `,
      [org_id, name]
    );
    if (dupSp.rows.length) {
      const err = new Error('A brand with this name already exists');
      err.statusCode = 400;
      throw err;
    }

    try {
      const dupIsp = await client.query(
        `
          SELECT "spbId" FROM "tblISPBrand"
          WHERE org_id = $1
            AND LOWER(BTRIM("brandName")) = LOWER($2)
          LIMIT 1
        `,
        [org_id, name]
      );
      if (dupIsp.rows.length) {
        const err = new Error('A brand with this name already exists');
        err.statusCode = 400;
        throw err;
      }
    } catch (error) {
      if (error.statusCode) throw error;
      // tblISPBrand may be unavailable in some tenants
    }

    const spb_id = await generateCustomIdForClient(client, 'sp_brand', 3);
    const result = await client.query(
      `
        INSERT INTO "tblSPBrand" (
          spb_id, text, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, 1,
          $3, $4, $5, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [spb_id, name, org_id, branch_id || null, created_by || null]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getSpModels = async (org_id, spb_id, spc_id = null) => {
  if (spc_id) {
    if (!spb_id) return [];
    const rows = await getLotModelsByCategoryAndBrand(org_id, spc_id, spb_id);
    return rows
      .map((row) => ({
        spm_id: row.model_id || row.spm_id || row.spbmId,
        spb_id,
        text: row.model_name || row.text || row.modelName,
      }))
      .filter((row) => row.spm_id && row.text);
  }

  const dbPool = getDb();
  await ensureSpBrandModelSchema(dbPool);

  const columns = await getTableColumnSet(dbPool, 'tblSPBMod');
  const idCol = pickColumn(columns, ['spbm_id', 'spm_id', 'spbmId', 'spmId', 'model_id']);
  const brandCol = pickColumn(columns, ['spb_id', 'spbId', 'brand_id']);
  const nameCol = pickColumn(columns, ['text', 'modelName', 'model_name', 'name']);
  if (!idCol || !nameCol) return [];

  const statusFilter = columns.has('int_status')
    ? 'AND COALESCE(m.int_status, 1) = 1'
    : '';
  const params = [];
  let query = `
    SELECT DISTINCT
      m.${quoteIdent(idCol)} AS spm_id,
      ${brandCol ? `m.${quoteIdent(brandCol)} AS spb_id,` : ''}
      m.${quoteIdent(nameCol)} AS text
    FROM "tblSPBMod" m
    WHERE 1=1
      ${statusFilter}
  `;
  if (columns.has('org_id') && org_id) {
    params.push(org_id);
    query += ` AND (m.org_id = $${params.length} OR m.org_id IS NULL)`;
  }
  if (spb_id && brandCol) {
    params.push(spb_id);
    query += ` AND m.${quoteIdent(brandCol)} = $${params.length}`;
  }
  if (spc_id) {
    params.push(spc_id);
    const spcParam = `$${params.length}`;
    query += `
      AND (
        m.${quoteIdent(idCol)} IN (
          SELECT c.spm_id
          FROM "tblSPCategory" c
          WHERE c.spc_id = ${spcParam}
            AND c.spm_id IS NOT NULL
        )
        OR EXISTS (
          SELECT 1
          FROM "tblSPCategory" c
          INNER JOIN "tblISPModCat" mc
            ON mc."spcId" = c.spc_id
          INNER JOIN "tblISPModel" im
            ON im."spbmId" = mc."spbmId"
          WHERE c.spc_id = ${spcParam}
            AND LOWER(BTRIM(im."modelName")) = LOWER(BTRIM(m.${quoteIdent(nameCol)}))
        )
      )
    `;
  }
  query += ` ORDER BY m.${quoteIdent(nameCol)} ASC`;

  let result;
  try {
    result = await dbPool.query(query, params);
  } catch (error) {
    if (!spc_id) throw error;
    const fallbackParams = [];
    let fallback = `
      SELECT DISTINCT
        m.${quoteIdent(idCol)} AS spm_id,
        ${brandCol ? `m.${quoteIdent(brandCol)} AS spb_id,` : ''}
        m.${quoteIdent(nameCol)} AS text
      FROM "tblSPBMod" m
      WHERE 1=1
        ${statusFilter}
    `;
    if (columns.has('org_id') && org_id) {
      fallbackParams.push(org_id);
      fallback += ` AND (m.org_id = $${fallbackParams.length} OR m.org_id IS NULL)`;
    }
    if (spb_id && brandCol) {
      fallbackParams.push(spb_id);
      fallback += ` AND m.${quoteIdent(brandCol)} = $${fallbackParams.length}`;
    }
    fallbackParams.push(spc_id);
    fallback += `
      AND m.${quoteIdent(idCol)} IN (
        SELECT c.spm_id
        FROM "tblSPCategory" c
        WHERE c.spc_id = $${fallbackParams.length}
          AND c.spm_id IS NOT NULL
      )
      ORDER BY m.${quoteIdent(nameCol)} ASC
    `;
    result = await dbPool.query(fallback, fallbackParams);
  }
  return result.rows;
};

const createSpModel = async ({ org_id, branch_id, spb_id, text, created_by }) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    await ensureSpBrandModelSchema(client);

    if (!spb_id) {
      const err = new Error('Brand is required to create a model');
      err.statusCode = 400;
      throw err;
    }

    const brand = await client.query(
      `
        SELECT spb_id FROM "tblSPBrand"
        WHERE spb_id = $1 AND org_id = $2 AND int_status = 1
      `,
      [spb_id, org_id]
    );
    if (!brand.rows.length) {
      const err = new Error('Selected brand was not found');
      err.statusCode = 400;
      throw err;
    }

    const name = String(text || '').trim();
    if (!name) {
      const err = new Error('Model is required');
      err.statusCode = 400;
      throw err;
    }

    const dupSp = await client.query(
      `
        SELECT spbm_id AS spm_id FROM "tblSPBMod"
        WHERE org_id = $1
          AND spb_id = $2
          AND LOWER(BTRIM(text)) = LOWER($3)
        LIMIT 1
      `,
      [org_id, spb_id, name]
    );
    if (dupSp.rows.length) {
      const err = new Error('A model with this name already exists for the selected brand');
      err.statusCode = 400;
      throw err;
    }

    try {
      const dupIsp = await client.query(
        `
          SELECT "spbmId" FROM "tblISPModel"
          WHERE org_id = $1
            AND "spbId" = $2
            AND LOWER(BTRIM("modelName")) = LOWER($3)
          LIMIT 1
        `,
        [org_id, spb_id, name]
      );
      if (dupIsp.rows.length) {
        const err = new Error('A model with this name already exists for the selected brand');
        err.statusCode = 400;
        throw err;
      }
    } catch (error) {
      if (error.statusCode) throw error;
    }

    const spm_id = await generateCustomIdForClient(client, 'sp_model', 3);
    const result = await client.query(
      `
        INSERT INTO "tblSPBMod" (
          spbm_id, spb_id, text, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, $3, 1,
          $4, $5, $6, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP
        )
        RETURNING spbm_id AS spm_id, spbm_id, spb_id, text, int_status, org_id, branch_id
      `,
      [spm_id, spb_id, name, org_id, branch_id || null, created_by || null]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getCategoryMappings = async (org_id, branch_id = null, hasSuperAccess = false) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      m.spcatm_id,
      m.spc_id,
      c.text AS category_name,
      COALESCE(ib."brandName", sb.text) AS category_brand,
      COALESCE(im."modelName", sm.text) AS category_model,
      m.asset_type_id,
      at.text AS asset_type_name,
      ps.brand AS asset_brand,
      ps.model AS asset_model,
      m.spbm_id,
      m.prod_serv_id,
      m.int_status,
      m.org_id,
      m.branch_id,
      m.created_by,
      m.created_on
    FROM "tblSPCatATMap" m
    LEFT JOIN "tblSPCategory" c ON c.spc_id = m.spc_id
    LEFT JOIN "tblSPBrand" sb ON sb.spb_id = c.spb_id
    LEFT JOIN "tblSPBMod" sm ON sm.spbm_id = c.spm_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.asset_type_id
    LEFT JOIN "tblISPModel" im ON im."spbmId" = m.spbm_id
    LEFT JOIN "tblISPBrand" ib ON ib."spbId" = im."spbId"
    LEFT JOIN "tblProdServs" ps ON ps.prod_serv_id = m.prod_serv_id
    WHERE m.org_id = $1
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (m.branch_id IS NULL OR m.branch_id = $${params.length})`;
  }

  query += ` ORDER BY c.text ASC, at.text ASC, ib."brandName" ASC, im."modelName" ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const createCategoryMapping = async ({
  org_id,
  branch_id,
  spc_id,
  asset_type_id,
  category_brand_id,
  category_model_id,
  asset_brand,
  asset_model,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    if (!spc_id) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }
    if (!asset_type_id) {
      const err = new Error('Asset type is required');
      err.statusCode = 400;
      throw err;
    }
    const assetBrandVal = asset_brand != null ? String(asset_brand).trim() : '';
    const assetModelVal = asset_model != null ? String(asset_model).trim() : '';
    const categoryBrandIdVal =
      category_brand_id != null ? String(category_brand_id).trim() : '';
    const categoryModelIdVal =
      category_model_id != null ? String(category_model_id).trim() : '';

    const cat = await client.query(
      `
        SELECT spc_id FROM "tblSPCategory"
        WHERE spc_id = $1 AND org_id = $2 AND int_status = 1
      `,
      [spc_id, org_id]
    );
    if (!cat.rows.length) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    let spbm_id = null;

    // If caller provided brand/model ids, try to resolve from existing ISP mod-category.
    if (categoryBrandIdVal && categoryModelIdVal) {
      const modcat = await client.query(
        `
          SELECT mc."spbmId" AS spbm_id
          FROM "tblISPModCat" mc
          INNER JOIN "tblISPModel" m ON m."spbmId" = mc."spbmId"
          WHERE mc."spcId" = $1
            AND mc."spbmId" = $2
            AND m."spbId" = $3
            AND COALESCE(mc.int_status, 1) = 1
            AND COALESCE(m.int_status, 1) = 1
            AND (mc.org_id = $4 OR mc.org_id IS NULL)
          LIMIT 1
        `,
        [spc_id, categoryModelIdVal, categoryBrandIdVal, org_id]
      );
      spbm_id = modcat.rows[0]?.spbm_id || null;
    }

    // Otherwise (or if not found), fall back to the brand/model saved on tblSPCategory.
    if (!spbm_id) {
      await ensureSpBrandModelSchema(client);
      const catDetail = await client.query(
        `
          SELECT
            c.spc_id,
            c.spb_id,
            c.spm_id,
            b.text AS brand_name,
            m.text AS model_name
          FROM "tblSPCategory" c
          LEFT JOIN "tblSPBrand" b ON b.spb_id = c.spb_id AND b.org_id = c.org_id
          LEFT JOIN "tblSPBMod" m ON m.spbm_id = c.spm_id AND m.org_id = c.org_id
          WHERE c.spc_id = $1 AND c.org_id = $2 AND c.int_status = 1
          LIMIT 1
        `,
        [spc_id, org_id]
      );

      const detail = catDetail.rows[0];
      if (!detail?.brand_name || !detail?.model_name) {
        const err = new Error('Selected category / brand / model combination was not found');
        err.statusCode = 400;
        throw err;
      }

      const brandMatches =
        detail.spb_id === category_brand_id ||
        String(detail.brand_name).toLowerCase() === String(category_brand_id).toLowerCase();
      const modelMatches =
        detail.spm_id === category_model_id ||
        String(detail.model_name).toLowerCase() === String(category_model_id).toLowerCase();

      // Also accept explicit SP brand/model ids even if category columns differ (legacy)
      const spBrand = await client.query(
        `
          SELECT spb_id, text
          FROM "tblSPBrand"
          WHERE org_id = $1 AND int_status = 1
            AND (spb_id = $2 OR LOWER(BTRIM(text)) = LOWER($2))
          LIMIT 1
        `,
        [org_id, category_brand_id]
      );
      const spModel = await client.query(
        `
          SELECT spbm_id AS spm_id, spb_id, text
          FROM "tblSPBMod"
          WHERE org_id = $1 AND int_status = 1
            AND (spbm_id = $2 OR LOWER(BTRIM(text)) = LOWER($2))
            AND (
              spb_id = $3
              OR spb_id = $4
              OR $3 IS NULL
            )
          LIMIT 1
        `,
        [
          org_id,
          category_model_id,
          category_brand_id,
          detail.spb_id,
        ]
      );
      const brand = await findOrCreateIspBrand(client, {
        org_id,
        branch_id,
        created_by,
        brand_id: spBrand.rows[0]?.spb_id || (brandMatches ? detail.spb_id : null),
        brand_name: detail.brand_name,
        strictCreate: false,
      });
      const model = await findOrCreateIspModel(client, {
        org_id,
        branch_id,
        created_by,
        spbId: brand.spbId,
        model_id: spModel.rows[0]?.spm_id || (modelMatches ? detail.spm_id : null),
        model_name: detail.model_name,
        strictCreate: false,
      });
      await ensureIspModCat(client, {
        org_id,
        branch_id,
        created_by,
        spc_id,
        spbmId: model.spbmId,
      });
      spbm_id = model.spbmId;
    }

    const at = await client.query(
      `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE asset_type_id = $1 AND org_id = $2
      `,
      [asset_type_id, org_id]
    );
    if (!at.rows.length) {
      const err = new Error('Invalid asset type');
      err.statusCode = 400;
      throw err;
    }

    let prod_serv_id = null;
    if (assetBrandVal && assetModelVal) {
      const prodServ = await client.query(
        `
          SELECT prod_serv_id
          FROM "tblProdServs"
          WHERE asset_type_id = $1
            AND LOWER(BTRIM(brand)) = LOWER($2)
            AND LOWER(BTRIM(model)) = LOWER($3)
            AND (org_id = $4 OR org_id IS NULL)
          LIMIT 1
        `,
        [asset_type_id, assetBrandVal, assetModelVal, org_id]
      );
      if (!prodServ.rows.length) {
        const err = new Error('Selected asset type / brand / model combination was not found');
        err.statusCode = 400;
        throw err;
      }
      prod_serv_id = prodServ.rows[0].prod_serv_id;
    }

    const mapCols = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tblSPCatATMap'
      `
    );
    const colSet = new Set(mapCols.rows.map((row) => row.column_name));

    const dupParams = [org_id, spc_id, asset_type_id];
    let dupSql = `
      SELECT 1 FROM "tblSPCatATMap"
      WHERE org_id = $1
        AND spc_id = $2
        AND asset_type_id = $3
        AND int_status = 1
    `;
    if (colSet.has('spbm_id')) {
      if (spbm_id == null) {
        dupSql += ` AND spbm_id IS NULL`;
      } else {
        dupParams.push(spbm_id);
        dupSql += ` AND spbm_id = $${dupParams.length}`;
      }
    }
    if (colSet.has('prod_serv_id')) {
      if (prod_serv_id == null) {
        dupSql += ` AND prod_serv_id IS NULL`;
      } else {
        dupParams.push(prod_serv_id);
        dupSql += ` AND prod_serv_id = $${dupParams.length}`;
      }
    }
    dupSql += ` LIMIT 1`;
    const dup = await client.query(dupSql, dupParams);
    if (dup.rows.length) {
      const err = new Error('This category / asset type mapping already exists');
      err.statusCode = 400;
      throw err;
    }

    const spcatm_id = await generateCustomIdForClient(client, 'sp_cat_at_map', 3);

    const result = await client.query(
      `
        INSERT INTO "tblSPCatATMap" (
          spcatm_id, spc_id, asset_type_id, spbm_id, prod_serv_id, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, 1,
          $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spcatm_id,
        spc_id,
        asset_type_id,
        spbm_id,
        prod_serv_id,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getModCatCategories = async (org_id) => {
  const dbPool = getDb();
  await ensureSpBrandModelSchema(dbPool);
  const result = await dbPool.query(
    `
      SELECT
        c.spc_id,
        c.text,
        c.spb_id,
        c.spm_id
      FROM "tblSPCategory" c
      WHERE c.org_id = $1
        AND c.int_status = 1
      ORDER BY c.text ASC
    `,
    [org_id]
  );
  return result.rows;
};

const getProdServAssetTypes = async (org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT
        asset_type_id,
        text
      FROM "tblAssetTypes"
      WHERE org_id = $1
        AND int_status = 1
      ORDER BY text ASC
    `,
    [org_id]
  );
  return result.rows;
};

const getProdServBrands = async (org_id, asset_type_id) => {
  const dbPool = getDb();
  if (!asset_type_id) return [];
  const result = await dbPool.query(
    `
      SELECT DISTINCT brand
      FROM "tblProdServs"
      WHERE asset_type_id = $1
        AND brand IS NOT NULL
        AND BTRIM(brand) <> ''
        AND (org_id = $2 OR org_id IS NULL)
      ORDER BY brand ASC
    `,
    [asset_type_id, org_id]
  );
  return result.rows.map((row) => ({ brand: row.brand }));
};

const getProdServModels = async (org_id, asset_type_id, brand) => {
  const dbPool = getDb();
  if (!asset_type_id || !brand) return [];
  const result = await dbPool.query(
    `
      SELECT DISTINCT model
      FROM "tblProdServs"
      WHERE asset_type_id = $1
        AND LOWER(BTRIM(brand)) = LOWER($2)
        AND model IS NOT NULL
        AND BTRIM(model) <> ''
        AND (org_id = $3 OR org_id IS NULL)
      ORDER BY model ASC
    `,
    [asset_type_id, brand, org_id]
  );
  return result.rows.map((row) => ({ model: row.model }));
};

const getSparePartLots = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      l.spld_id,
      l.spc_id,
      c.text AS category_name,
      l.quantity,
      l.unit_price,
      l.invoice_no,
      l.lot_purchase_date,
      l.invoice_item_no,
      l.remarks,
      l.org_id,
      l.branch_id,
      l.created_by,
      l.created_on
    FROM "tblSPLotDet" l
    LEFT JOIN "tblSPCategory" c
      ON c.spc_id = l.spc_id
     AND c.org_id = l.org_id
    WHERE l.org_id = $1
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (l.branch_id IS NULL OR l.branch_id = $${params.length})`;
  }
  query += ` ORDER BY l.created_on DESC, l.spld_id DESC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

/**
 * Vendors that have spare-part supply mapping in tblVSPMap.
 */
const getLotVendors = async (org_id, branch_id = null, hasSuperAccess = false) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT DISTINCT
      vd.vendor_id,
      vd.vendor_name,
      vd.company_name,
      vd.int_status,
      vd.org_id,
      vd.branch_code
    FROM "tblVSPMap" m
    INNER JOIN "tblVendors" vd
      ON vd.vendor_id = m.vendor_id
     AND vd.org_id = m.org_id
    WHERE m.org_id = $1
      AND COALESCE(m.int_status, 1) = 1
      AND (vd.int_status = 1 OR vd.int_status IS NULL)
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (m.branch_id IS NULL OR m.branch_id = $${params.length})`;
  }

  query += ` ORDER BY vd.vendor_name ASC NULLS LAST, vd.company_name ASC NULLS LAST`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

/**
 * Categories for lot entry: vendor mappings when present, otherwise all active categories.
 */
const getLotCategoriesByVendor = async (
  org_id,
  vendor_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  if (!vendor_id) {
    return [];
  }

  const params = [org_id, vendor_id];
  let query = `
    SELECT DISTINCT
      c.spc_id,
      c.text,
      c.uom,
      c.minimum_stock,
      c.re_order_level,
      c.int_status,
      c.org_id,
      c.branch_id
    FROM "tblVSPMap" v
    INNER JOIN "tblSPCategory" c
      ON c.spc_id = v.spc_id
     AND (c.org_id = v.org_id OR c.org_id IS NULL OR v.org_id IS NULL)
    WHERE v.org_id = $1
      AND v.vendor_id = $2
      AND COALESCE(v.int_status, 1) = 1
      AND c.int_status = 1
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (v.branch_id IS NULL OR v.branch_id = $${params.length})`;
    query += ` AND (c.branch_id IS NULL OR c.branch_id = $${params.length})`;
  }

  query += ` ORDER BY c.text ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

/**
 * Brands for a category: from tblISPModCat when present, else brand linked on tblSPCategory.
 */
const getLotBrandsByCategory = async (
  org_id,
  spc_id,
  vendor_id = null,
  branch_id = null,
  hasSuperAccess = false
) => {
  if (!spc_id) return [];

  const dbPool = getDb();
  const run = async (withOrg) => {
    const params = [];
    let query = `
      SELECT DISTINCT
        b."spbId" AS brand_id,
        b."brandName" AS brand_name
      FROM "tblISPModCat" mc
      INNER JOIN "tblISPModel" m
        ON m."spbmId" = mc."spbmId"
      INNER JOIN "tblISPBrand" b
        ON b."spbId" = m."spbId"
      WHERE COALESCE(mc.int_status, 1) = 1
        AND COALESCE(m.int_status, 1) = 1
        AND COALESCE(b.int_status, 1) = 1
    `;
    if (spc_id) {
      params.push(spc_id);
      query += ` AND mc."spcId" = $${params.length}`;
    }
    if (withOrg && org_id) {
      params.push(org_id);
      query += ` AND (mc.org_id = $${params.length} OR mc.org_id IS NULL)`;
    }
    query += ` ORDER BY b."brandName" ASC`;
    return dbPool.query(query, params);
  };

  let result = await run(true);
  if (!result.rows.length) {
    result = await run(false);
  }
  if (result.rows.length) {
    return result.rows;
  }

  if (!spc_id) return [];

  await ensureSpBrandModelSchema(dbPool);
  const fallback = await dbPool.query(
    `
      SELECT DISTINCT
        COALESCE(ib."spbId", b.spb_id) AS brand_id,
        COALESCE(ib."brandName", b.text) AS brand_name
      FROM "tblSPCategory" c
      INNER JOIN "tblSPBrand" b
        ON b.spb_id = c.spb_id
       AND b.org_id = c.org_id
      LEFT JOIN "tblISPBrand" ib
        ON ib.org_id = c.org_id
       AND LOWER(BTRIM(ib."brandName")) = LOWER(BTRIM(b.text))
       AND COALESCE(ib.int_status, 1) = 1
      WHERE c.spc_id = $1
        AND c.org_id = $2
        AND c.int_status = 1
        AND c.spb_id IS NOT NULL
        AND COALESCE(b.int_status, 1) = 1
      ORDER BY 2 ASC
    `,
    [spc_id, org_id]
  );
  return fallback.rows;
};

/**
 * Models for category + brand: from tblISPModCat when present, else model linked on tblSPCategory.
 */
const getLotModelsByCategoryAndBrand = async (
  org_id,
  spc_id,
  brand_id,
  vendor_id = null,
  branch_id = null,
  hasSuperAccess = false
) => {
  if (!spc_id || !brand_id) return [];

  const dbPool = getDb();

  const run = async (withOrg) => {
    const params = [brand_id];
    let query = `
      SELECT DISTINCT
        m."spbmId" AS model_id,
        m."modelName" AS model_name
      FROM "tblISPModCat" mc
      INNER JOIN "tblISPModel" m
        ON m."spbmId" = mc."spbmId"
      WHERE m."spbId" = $1
        AND COALESCE(mc.int_status, 1) = 1
        AND COALESCE(m.int_status, 1) = 1
    `;
    if (spc_id) {
      params.push(spc_id);
      query += ` AND mc."spcId" = $${params.length}`;
    }
    if (withOrg && org_id) {
      params.push(org_id);
      query += ` AND (mc.org_id = $${params.length} OR mc.org_id IS NULL)`;
    }
    query += ` ORDER BY m."modelName" ASC`;
    return dbPool.query(query, params);
  };

  let result = await run(true);
  if (!result.rows.length) {
    result = await run(false);
  }
  if (result.rows.length) {
    return result.rows;
  }

  if (!spc_id) return [];

  await ensureSpBrandModelSchema(dbPool);
  const fallback = await dbPool.query(
    `
      SELECT DISTINCT
        COALESCE(im."spbmId", m.spbm_id) AS model_id,
        COALESCE(im."modelName", m.text) AS model_name
      FROM "tblSPCategory" c
      INNER JOIN "tblSPBMod" m
        ON m.spbm_id = c.spm_id
       AND m.org_id = c.org_id
      INNER JOIN "tblSPBrand" b
        ON b.spb_id = c.spb_id
       AND b.org_id = c.org_id
      LEFT JOIN "tblISPBrand" ib
        ON (
          ib."spbId" = $2
          OR (
            ib.org_id = c.org_id
            AND LOWER(BTRIM(ib."brandName")) = LOWER(BTRIM(b.text))
          )
        )
       AND COALESCE(ib.int_status, 1) = 1
      LEFT JOIN "tblISPModel" im
        ON im.org_id = c.org_id
       AND COALESCE(im.int_status, 1) = 1
       AND LOWER(BTRIM(im."modelName")) = LOWER(BTRIM(m.text))
       AND (
         im."spbId" = ib."spbId"
         OR im."spbId" = $2
         OR im."spbId" = b.spb_id
       )
      WHERE c.spc_id = $1
        AND c.org_id = $3
        AND c.int_status = 1
        AND c.spm_id IS NOT NULL
        AND (
          c.spb_id = $2
          OR ib."spbId" = $2
          OR b.spb_id = $2
        )
        AND COALESCE(m.int_status, 1) = 1
      ORDER BY 2 ASC
    `,
    [spc_id, brand_id, org_id]
  );
  return fallback.rows;
};

/**
 * Resolve part number from tblISPPartNumberSpec (tblSPpartNumberSpec)
 * plus vendor part number from tblISPPNVPNMap when that table exists.
 * Column names differ by tenant (camelCase vs snake_case).
 */
const getLotPartNumber = async ({
  org_id,
  vendor_id,
  spc_id,
  brand_id,
  model_id,
}) => {
  const dbPool = getDb();
  const specCols = await getTableColumnSet(dbPool, 'tblISPPartNumberSpec');
  const vpnCols = await getTableColumnSet(dbPool, 'tblISPPNVPNMap');

  const specIdCol = pickColumn(specCols, ['sppns_id', 'sppnsId']);
  const partNoCol = pickColumn(specCols, ['sppart_ext_id', 'sppartExtId']);
  const specPpdCol = pickColumn(specCols, ['sppd_id', 'sppdId']);

  if (!specIdCol || !partNoCol || !specPpdCol) {
    return null;
  }

  const specId = quoteIdent(specIdCol);
  const partNo = quoteIdent(partNoCol);
  const specPpd = quoteIdent(specPpdCol);

  const vpnIdCol = pickColumn(vpnCols, ['spvpnId', 'spvpn_id']);
  const vpnSpecCol = pickColumn(vpnCols, ['sppns_id', 'sppnsId']);
  const vpnPartCol = pickColumn(vpnCols, ['vendorPartNumber', 'vendor_part_number']);
  const vpnVendorCol = pickColumn(vpnCols, ['vendorId', 'vendor_id']);
  const hasVpnJoin = Boolean(
    vpnIdCol && vpnSpecCol && vpnPartCol && vpnVendorCol
  );

  const partExpr = hasVpnJoin
    ? `COALESCE(vpn.${quoteIdent(vpnPartCol)}, pn.${partNo})`
    : `pn.${partNo}`;
  const vpnJoin = hasVpnJoin
    ? `
      LEFT JOIN "tblISPPNVPNMap" vpn
        ON vpn.${quoteIdent(vpnSpecCol)} = pn.${specId}
       AND vpn.org_id = pn.org_id
       AND vpn.${quoteIdent(vpnVendorCol)} = $2
       AND COALESCE(vpn.int_status, 1) = 1
    `
    : '';
  const orderVpn = hasVpnJoin
    ? `CASE WHEN vpn.${quoteIdent(vpnIdCol)} IS NOT NULL THEN 0 ELSE 1 END,`
    : '';

  const result = await dbPool.query(
    `
      SELECT
        ${partExpr} AS part_number,
        pn.${specId} AS part_spec_id
      FROM "tblISPPartNumberSpec" pn
      INNER JOIN "tblISPPropDet" pd
        ON pd."sppdId" = pn.${specPpd}
       AND (pd.org_id = pn.org_id OR pd.org_id IS NULL OR pn.org_id IS NULL)
      INNER JOIN "tblISPModel" m
        ON m."spbmId" = pd."spbmId"
       AND (m.org_id = pd.org_id OR m.org_id IS NULL OR pd.org_id IS NULL)
      INNER JOIN "tblISPModCat" mc
        ON mc."spbmId" = m."spbmId"
       AND mc."spcId" = $3
       AND (mc.org_id = m.org_id OR mc.org_id IS NULL OR m.org_id IS NULL)
      ${vpnJoin}
      WHERE pn.org_id = $1
        AND COALESCE(pn.int_status, 1) = 1
        AND COALESCE(pd.int_status, 1) = 1
        AND COALESCE(m.int_status, 1) = 1
        AND COALESCE(mc.int_status, 1) = 1
        AND m."spbmId" = $4
        AND m."spbId" = $5
        AND BTRIM(COALESCE(${partExpr}, '')) <> ''
      ORDER BY
        ${orderVpn}
        pn.${specId} ASC
    `,
    [org_id, vendor_id, spc_id, model_id, brand_id]
  );

  if (!result.rows.length) {
    return null;
  }

  const partNumbers = [
    ...new Set(
      result.rows
        .map((row) => String(row.part_number || '').trim())
        .filter(Boolean)
    ),
  ];

  if (partNumbers.length > 1) {
    const err = new Error(
      'Multiple part numbers match this selection. Please review vendor, category, brand, and model.'
    );
    err.statusCode = 409;
    throw err;
  }

  return {
    part_number: partNumbers[0],
    part_spec_id: result.rows[0].part_spec_id,
  };
};

/**
 * Create lot header (tblSPLotDet) + individual unit rows (tblSPIndDet) in one transaction.
 */
const createSparePartLot = async ({
  org_id,
  branch_id,
  spc_id,
  vendor_id = null,
  brand_id = null,
  model_id = null,
  part_number = null,
  unit_price,
  lot_purchase_date,
  invoice_no,
  invoice_item_no,
  quantity,
  remarks = null,
  has_serial_number = false,
  serial_numbers = [],
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const categoryCheck = await client.query(
      `
        SELECT spc_id
        FROM "tblSPCategory"
        WHERE spc_id = $1
          AND org_id = $2
          AND int_status = 1
      `,
      [spc_id, org_id]
    );

    if (categoryCheck.rows.length === 0) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    const unitCount = Math.floor(qty);
    // Each quantity unit gets one serial (manual or auto-generated)
    if (unitCount !== qty) {
      const err = new Error('Quantity must be a whole number so each unit can have a serial number');
      err.statusCode = 400;
      throw err;
    }

    let resolvedSerials = [];

    if (has_serial_number) {
      if (!Array.isArray(serial_numbers) || serial_numbers.length !== unitCount) {
        const err = new Error(`Exactly ${unitCount} serial number(s) are required`);
        err.statusCode = 400;
        throw err;
      }
      resolvedSerials = serial_numbers.map((s) => String(s || '').trim());
      if (resolvedSerials.some((s) => !s)) {
        const err = new Error('All serial numbers are required');
        err.statusCode = 400;
        throw err;
      }
      const unique = new Set(resolvedSerials.map((s) => s.toLowerCase()));
      if (unique.size !== resolvedSerials.length) {
        const err = new Error('Serial numbers must be unique');
        err.statusCode = 400;
        throw err;
      }

      // Org-wide uniqueness (same idea as asset serial check)
      const existing = await client.query(
        `
          SELECT serial_number
          FROM "tblSPIndDet"
          WHERE org_id = $1
            AND serial_number IS NOT NULL
            AND BTRIM(serial_number) <> ''
            AND LOWER(serial_number) = ANY($2::text[])
        `,
        [org_id, resolvedSerials.map((s) => s.toLowerCase())]
      );
      if (existing.rows.length) {
        const dupes = existing.rows.map((r) => r.serial_number).join(', ');
        const err = new Error(`Serial number(s) already exist: ${dupes}`);
        err.statusCode = 400;
        throw err;
      }

      // Advance category counter so future auto-serials stay continuous / unique
      await bumpSeqFromManualSerials(client, {
        spc_id,
        org_id,
        serials: resolvedSerials,
      });
    } else {
      // Auto-generate: increment last_gen_seq_no per unit (never reused after delete)
      resolvedSerials = await allocateAutoSerialNumbers(client, {
        spc_id,
        org_id,
        count: unitCount,
      });
    }

    const spld_id = await generateCustomIdForClient(client, 'sp_lot_det', 3);

    const lotResult = await client.query(
      `
        INSERT INTO "tblSPLotDet" (
          spld_id,
          spc_id,
          vendor_id,
          brand_id,
          model_id,
          part_number,
          unit_price,
          lot_purchase_date,
          invoice_no,
          invoice_item_no,
          quantity,
          remarks,
          org_id,
          branch_id,
          created_by,
          created_on,
          changed_by,
          changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          CURRENT_TIMESTAMP, $15, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spld_id,
        spc_id,
        vendor_id || null,
        brand_id || null,
        model_id || null,
        part_number || null,
        unit_price,
        lot_purchase_date || null,
        invoice_no || null,
        invoice_item_no || null,
        qty,
        remarks,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    const individuals = [];

    for (let i = 0; i < unitCount; i += 1) {
      const spid_id = await generateCustomIdForClient(client, 'sp_ind_det', 3);
      const serial_number = resolvedSerials[i];

      const indResult = await client.query(
        `
          INSERT INTO "tblSPIndDet" (
            spid_id,
            spld_id,
            spc_id,
            serial_number,
            is_used,
            org_id,
            branch_id,
            created_by,
            created_on,
            changed_by,
            changed_on
          ) VALUES (
            $1, $2, $3, $4, 0, $5, $6, $7,
            CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP
          )
          RETURNING *
        `,
        [
          spid_id,
          spld_id,
          spc_id,
          serial_number,
          org_id,
          branch_id || null,
          created_by || null,
        ]
      );
      individuals.push(indResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      lot: lotResult.rows[0],
      individuals,
      serials_auto_generated: !has_serial_number,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore rollback errors */
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Individuals for a lot — used when serials were not entered manually
 * so records can be fetched from DB and displayed.
 */
const getIndividualsByLotId = async (spld_id, org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT
        spid_id,
        spld_id,
        spc_id,
        serial_number,
        is_used,
        org_id,
        branch_id,
        created_on
      FROM "tblSPIndDet"
      WHERE spld_id = $1
        AND org_id = $2
      ORDER BY spid_id ASC
    `,
    [spld_id, org_id]
  );
  return result.rows;
};

const getSparePartLotById = async (
  spld_id,
  org_id,
  branch_id = null,
  hasSuperAccess = false
) => {
  const dbPool = getDb();
  const params = [spld_id, org_id];
  let query = `
    SELECT
      l.spld_id,
      l.spc_id,
      c.text AS category_name,
      l.vendor_id,
      l.brand_id,
      l.model_id,
      l.part_number,
      l.quantity,
      l.unit_price,
      l.invoice_no,
      l.lot_purchase_date,
      l.invoice_item_no,
      l.remarks,
      l.org_id,
      l.branch_id,
      l.created_by,
      l.created_on
    FROM "tblSPLotDet" l
    LEFT JOIN "tblSPCategory" c
      ON c.spc_id = l.spc_id
     AND c.org_id = l.org_id
    WHERE l.spld_id = $1
      AND l.org_id = $2
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (l.branch_id IS NULL OR l.branch_id = $${params.length})`;
  }

  const result = await dbPool.query(query, params);
  if (!result.rows.length) return null;

  const individuals = await getIndividualsByLotId(spld_id, org_id);
  return { ...result.rows[0], individuals };
};

const updateSparePartLot = async ({
  spld_id,
  org_id,
  branch_id,
  changed_by,
  spc_id,
  vendor_id = null,
  brand_id = null,
  model_id = null,
  part_number = null,
  unit_price,
  lot_purchase_date,
  invoice_no,
  invoice_item_no,
  quantity,
  remarks = null,
  has_serial_number = false,
  serial_numbers = [],
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT *
        FROM "tblSPLotDet"
        WHERE spld_id = $1
          AND org_id = $2
        FOR UPDATE
      `,
      [spld_id, org_id]
    );
    if (!existing.rows.length) {
      const err = new Error('Spare part lot not found');
      err.statusCode = 404;
      throw err;
    }

    const categoryCheck = await client.query(
      `
        SELECT spc_id
        FROM "tblSPCategory"
        WHERE spc_id = $1
          AND org_id = $2
          AND int_status = 1
      `,
      [spc_id, org_id]
    );
    if (!categoryCheck.rows.length) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be a positive number');
      err.statusCode = 400;
      throw err;
    }
    if (Math.floor(qty) !== qty) {
      const err = new Error(
        'Quantity must be a whole number so each unit can have a serial number'
      );
      err.statusCode = 400;
      throw err;
    }

    const currentInd = await client.query(
      `
        SELECT *
        FROM "tblSPIndDet"
        WHERE spld_id = $1
          AND org_id = $2
        ORDER BY spid_id ASC
        FOR UPDATE
      `,
      [spld_id, org_id]
    );
    const individuals = currentInd.rows;
    const usedCount = individuals.filter(
      (row) => Number(row.is_used) === 1
    ).length;
    if (qty < usedCount) {
      const err = new Error(
        `Cannot reduce quantity below ${usedCount} issued unit(s)`
      );
      err.statusCode = 400;
      throw err;
    }

    const lotResult = await client.query(
      `
        UPDATE "tblSPLotDet"
        SET
          spc_id = $3,
          vendor_id = $4,
          brand_id = $5,
          model_id = $6,
          part_number = $7,
          unit_price = $8,
          lot_purchase_date = $9,
          invoice_no = $10,
          invoice_item_no = $11,
          quantity = $12,
          remarks = $13,
          changed_by = $14,
          changed_on = CURRENT_TIMESTAMP
        WHERE spld_id = $1
          AND org_id = $2
        RETURNING *
      `,
      [
        spld_id,
        org_id,
        spc_id,
        vendor_id || null,
        brand_id || null,
        model_id || null,
        part_number || null,
        unit_price,
        lot_purchase_date || null,
        invoice_no || null,
        invoice_item_no || null,
        qty,
        remarks,
        changed_by || null,
      ]
    );

    if (spc_id !== existing.rows[0].spc_id) {
      await client.query(
        `
          UPDATE "tblSPIndDet"
          SET
            spc_id = $3,
            changed_by = $4,
            changed_on = CURRENT_TIMESTAMP
          WHERE spld_id = $1
            AND org_id = $2
        `,
        [spld_id, org_id, spc_id, changed_by || null]
      );
    }

    if (qty > individuals.length) {
      const extra = qty - individuals.length;
      let extraSerials = [];
      if (has_serial_number) {
        const provided = Array.isArray(serial_numbers)
          ? serial_numbers.map((s) => String(s || '').trim()).filter(Boolean)
          : [];
        if (provided.length !== extra && provided.length !== qty) {
          const err = new Error(
            `Provide ${extra} new serial number(s) for the added quantity`
          );
          err.statusCode = 400;
          throw err;
        }
        extraSerials =
          provided.length === qty ? provided.slice(individuals.length) : provided;
        const unique = new Set(extraSerials.map((s) => s.toLowerCase()));
        if (unique.size !== extraSerials.length) {
          const err = new Error('Serial numbers must be unique');
          err.statusCode = 400;
          throw err;
        }
        const existingSerials = await client.query(
          `
            SELECT serial_number
            FROM "tblSPIndDet"
            WHERE org_id = $1
              AND serial_number IS NOT NULL
              AND BTRIM(serial_number) <> ''
              AND LOWER(serial_number) = ANY($2::text[])
              AND spld_id <> $3
          `,
          [org_id, extraSerials.map((s) => s.toLowerCase()), spld_id]
        );
        if (existingSerials.rows.length) {
          const dupes = existingSerials.rows.map((r) => r.serial_number).join(', ');
          const err = new Error(`Serial number(s) already exist: ${dupes}`);
          err.statusCode = 400;
          throw err;
        }
        await bumpSeqFromManualSerials(client, {
          spc_id,
          org_id,
          serials: extraSerials,
        });
      } else {
        extraSerials = await allocateAutoSerialNumbers(client, {
          spc_id,
          org_id,
          count: extra,
        });
      }

      for (let i = 0; i < extra; i += 1) {
        const spid_id = await generateCustomIdForClient(client, 'sp_ind_det', 3);
        await client.query(
          `
            INSERT INTO "tblSPIndDet" (
              spid_id,
              spld_id,
              spc_id,
              serial_number,
              is_used,
              org_id,
              branch_id,
              created_by,
              created_on,
              changed_by,
              changed_on
            ) VALUES (
              $1, $2, $3, $4, 0, $5, $6, $7,
              CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP
            )
          `,
          [
            spid_id,
            spld_id,
            spc_id,
            extraSerials[i],
            org_id,
            branch_id || existing.rows[0].branch_id || null,
            changed_by || null,
          ]
        );
      }
    } else if (qty < individuals.length) {
      const removable = [...individuals]
        .reverse()
        .filter((row) => Number(row.is_used) !== 1)
        .slice(0, individuals.length - qty);
      if (removable.length !== individuals.length - qty) {
        const err = new Error(
          'Cannot reduce quantity because some units have already been issued'
        );
        err.statusCode = 400;
        throw err;
      }
      await client.query(
        `
          DELETE FROM "tblSPIndDet"
          WHERE org_id = $1
            AND spid_id = ANY($2::text[])
        `,
        [org_id, removable.map((row) => row.spid_id)]
      );
    }

    await client.query('COMMIT');

    const updatedIndividuals = await getIndividualsByLotId(spld_id, org_id);
    return {
      lot: lotResult.rows[0],
      individuals: updatedIndividuals,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore rollback errors */
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Spare supply mappings for a vendor (tblVSPMap).
 */
const getVendorSpareMappings = async (vendor_id, org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT
        m.vspm_id,
        m.vendor_id,
        m.spc_id,
        m.brand,
        m.model,
        c.text AS category_text
      FROM "tblVSPMap" m
      LEFT JOIN "tblSPCategory" c
        ON c.spc_id = m.spc_id
       AND (c.org_id = m.org_id OR c.org_id IS NULL OR m.org_id IS NULL)
      WHERE m.vendor_id = $1
        AND COALESCE(m.int_status, 1) = 1
        AND (m.org_id = $2 OR m.org_id IS NULL OR $2::text IS NULL)
      ORDER BY m.created_on DESC NULLS LAST, m.vspm_id ASC
    `,
    [vendor_id, org_id]
  );
  return result.rows;
};

/**
 * Link vendor to spare part categories (tblVSPMap) in one transaction.
 * items: [{ spc_id, brand, model }]
 */
const createVendorSpareMappings = async ({
  org_id,
  branch_id,
  vendor_id,
  items,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    if (!vendor_id) {
      const err = new Error('Vendor is required');
      err.statusCode = 400;
      throw err;
    }
    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('At least one spare supply item is required');
      err.statusCode = 400;
      throw err;
    }

    const vendorCheck = await client.query(
      `SELECT vendor_id FROM "tblVendors" WHERE vendor_id = $1 AND org_id = $2`,
      [vendor_id, org_id]
    );
    if (!vendorCheck.rows.length) {
      const err = new Error('Vendor not found');
      err.statusCode = 400;
      throw err;
    }

    const created = [];

    for (const item of items) {
      const spc_id = item?.spc_id;
      const brandVal = item?.brand != null ? String(item.brand).trim() : '';
      const modelVal = item?.model != null ? String(item.model).trim() : '';

      if (!spc_id) {
        const err = new Error('Category is required for each spare supply item');
        err.statusCode = 400;
        throw err;
      }
      if (!brandVal) {
        const err = new Error('Brand is required for each spare supply item');
        err.statusCode = 400;
        throw err;
      }
      if (!modelVal) {
        const err = new Error('Model is required for each spare supply item');
        err.statusCode = 400;
        throw err;
      }

      const cat = await client.query(
        `
          SELECT spc_id FROM "tblSPCategory"
          WHERE spc_id = $1 AND org_id = $2 AND int_status = 1
        `,
        [spc_id, org_id]
      );
      if (!cat.rows.length) {
        const err = new Error(`Invalid or inactive spare part category: ${spc_id}`);
        err.statusCode = 400;
        throw err;
      }

      const dup = await client.query(
        `
          SELECT 1 FROM "tblVSPMap"
          WHERE org_id = $1
            AND vendor_id = $2
            AND spc_id = $3
            AND COALESCE(LOWER(TRIM(brand)), '') = LOWER($4)
            AND COALESCE(LOWER(TRIM(model)), '') = LOWER($5)
            AND int_status = 1
          LIMIT 1
        `,
        [org_id, vendor_id, spc_id, brandVal, modelVal]
      );
      if (dup.rows.length) {
        continue;
      }

      const vspm_id = await generateCustomIdForClient(client, 'vsp_map', 3);
      const result = await client.query(
        `
          INSERT INTO "tblVSPMap" (
            vspm_id, vendor_id, spc_id, brand, model, int_status,
            org_id, branch_id, created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, $2, $3, $4, $5, 1,
            $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP
          )
          RETURNING *
        `,
        [
          vspm_id,
          vendor_id,
          spc_id,
          brandVal,
          modelVal,
          org_id,
          branch_id || null,
          created_by || null,
        ]
      );
      created.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return created;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const nextQuotedIspId = async (client, table, column, prefix, pad = 3) => {
  const pattern = `^${prefix}[0-9]+$`;
  const startPos = prefix.length + 1;
  // Quote camelCase columns; leave snake_case unquoted
  const colSql = /[A-Z]/.test(column) ? `"${column}"` : column;
  const result = await client.query(
    `
      SELECT COALESCE(MAX(
        CASE
          WHEN ${colSql} ~ $1
          THEN CAST(SUBSTRING(${colSql} FROM ${startPos}) AS INTEGER)
          ELSE 0
        END
      ), 0)::int AS max_num
      FROM "${table}"
    `,
    [pattern]
  );
  const next = Number(result.rows[0]?.max_num || 0) + 1;
  return `${prefix}${String(next).padStart(pad, '0')}`;
};

const findOrCreateIspBrand = async (
  client,
  { org_id, branch_id, created_by, brand_id, brand_name, strictCreate = false }
) => {
  if (brand_id) {
    const existing = await client.query(
      `
        SELECT "spbId", "brandName"
        FROM "tblISPBrand"
        WHERE "spbId" = $1 AND org_id = $2 AND int_status = 1
      `,
      [brand_id, org_id]
    );
    if (existing.rows.length) {
      return existing.rows[0];
    }
    // Brand id may be from tblSPBrand — resolve by name below if brand_name provided
    if (!brand_name) {
      const spBrand = await client.query(
        `
          SELECT text AS brand_name
          FROM "tblSPBrand"
          WHERE spb_id = $1 AND org_id = $2 AND int_status = 1
        `,
        [brand_id, org_id]
      );
      if (spBrand.rows.length) {
        brand_name = spBrand.rows[0].brand_name;
      } else {
        const err = new Error('Selected brand was not found');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const name = String(brand_name || '').trim();
  if (!name) {
    const err = new Error('Brand is required');
    err.statusCode = 400;
    throw err;
  }

  const match = await client.query(
    `
      SELECT "spbId", "brandName"
      FROM "tblISPBrand"
      WHERE org_id = $1
        AND LOWER(BTRIM("brandName")) = LOWER($2)
      LIMIT 1
    `,
    [org_id, name]
  );
  if (match.rows.length) {
    if (strictCreate) {
      const err = new Error('A brand with this name already exists');
      err.statusCode = 400;
      throw err;
    }
    return match.rows[0];
  }

  if (strictCreate) {
    try {
      const dupSp = await client.query(
        `
          SELECT spb_id FROM "tblSPBrand"
          WHERE org_id = $1
            AND LOWER(BTRIM(text)) = LOWER($2)
          LIMIT 1
        `,
        [org_id, name]
      );
      if (dupSp.rows.length) {
        const err = new Error('A brand with this name already exists');
        err.statusCode = 400;
        throw err;
      }
    } catch (error) {
      if (error.statusCode) throw error;
    }
  }

  const spbId = await nextQuotedIspId(client, 'tblISPBrand', 'spbId', 'SPB', 3);
  const inserted = await client.query(
    `
      INSERT INTO "tblISPBrand" (
        "spbId", "brandName", int_status,
        org_id, branch_id, created_by, created_on, changed_by, changed_on
      ) VALUES (
        $1, $2, 1,
        $3, $4, $5, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP
      )
      RETURNING "spbId", "brandName"
    `,
    [spbId, name, org_id, branch_id || null, created_by || null]
  );
  return inserted.rows[0];
};

const findOrCreateIspModel = async (
  client,
  { org_id, branch_id, created_by, spbId, model_id, model_name, strictCreate = false }
) => {
  if (model_id) {
    const existing = await client.query(
      `
        SELECT "spbmId", "modelName", "spbId"
        FROM "tblISPModel"
        WHERE "spbmId" = $1
          AND org_id = $2
          AND "spbId" = $3
          AND int_status = 1
      `,
      [model_id, org_id, spbId]
    );
    if (existing.rows.length) {
      return existing.rows[0];
    }
    // Model id may be from tblSPBMod — resolve by name below
    if (!model_name) {
      const spModel = await client.query(
        `
          SELECT text AS model_name
          FROM "tblSPBMod"
          WHERE spbm_id = $1 AND org_id = $2 AND int_status = 1
        `,
        [model_id, org_id]
      );
      if (spModel.rows.length) {
        model_name = spModel.rows[0].model_name;
      } else {
        const err = new Error('Selected model was not found for the chosen brand');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const name = String(model_name || '').trim();
  if (!name) {
    const err = new Error('Model is required');
    err.statusCode = 400;
    throw err;
  }

  const match = await client.query(
    `
      SELECT "spbmId", "modelName", "spbId"
      FROM "tblISPModel"
      WHERE org_id = $1
        AND "spbId" = $2
        AND LOWER(BTRIM("modelName")) = LOWER($3)
      LIMIT 1
    `,
    [org_id, spbId, name]
  );
  if (match.rows.length) {
    if (strictCreate) {
      const err = new Error('A model with this name already exists for the selected brand');
      err.statusCode = 400;
      throw err;
    }
    return match.rows[0];
  }

  if (strictCreate) {
    try {
      const dupSp = await client.query(
        `
          SELECT spbm_id AS spm_id FROM "tblSPBMod"
          WHERE org_id = $1
            AND spb_id = $2
            AND LOWER(BTRIM(text)) = LOWER($3)
          LIMIT 1
        `,
        [org_id, spbId, name]
      );
      if (dupSp.rows.length) {
        const err = new Error('A model with this name already exists for the selected brand');
        err.statusCode = 400;
        throw err;
      }
    } catch (error) {
      if (error.statusCode) throw error;
    }
  }

  const spbmId = await nextQuotedIspId(client, 'tblISPModel', 'spbmId', 'SPBM', 3);
  const inserted = await client.query(
    `
      INSERT INTO "tblISPModel" (
        "spbmId", "spbId", "modelName", int_status,
        org_id, branch_id, created_by, created_on, changed_by, changed_on
      ) VALUES (
        $1, $2, $3, 1,
        $4, $5, $6, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP
      )
      RETURNING "spbmId", "modelName", "spbId"
    `,
    [spbmId, spbId, name, org_id, branch_id || null, created_by || null]
  );
  return inserted.rows[0];
};

const ensureIspModCat = async (
  client,
  { org_id, branch_id, created_by, spc_id, spbmId }
) => {
  const existing = await client.query(
    `
      SELECT "spbmcId"
      FROM "tblISPModCat"
      WHERE org_id = $1
        AND "spcId" = $2
        AND "spbmId" = $3
        AND int_status = 1
      LIMIT 1
    `,
    [org_id, spc_id, spbmId]
  );
  if (existing.rows.length) {
    return existing.rows[0].spbmcId;
  }

  const spbmcId = await nextQuotedIspId(client, 'tblISPModCat', 'spbmcId', 'SPBMC', 3);
  await client.query(
    `
      INSERT INTO "tblISPModCat" (
        "spbmcId", "spbmId", "spcId", int_status,
        org_id, branch_id, created_by, created_on, changed_by, changed_on
      ) VALUES (
        $1, $2, $3, 1,
        $4, $5, $6, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP
      )
    `,
    [spbmcId, spbmId, spc_id, org_id, branch_id || null, created_by || null]
  );
  return spbmcId;
};

const findOrCreateIspPropDet = async (
  client,
  { org_id, branch_id, created_by, spbmId, prop_id, prop_name }
) => {
  const existing = await client.query(
    `
      SELECT "sppdId", "propId", "propName"
      FROM "tblISPPropDet"
      WHERE org_id = $1
        AND "spbmId" = $2
        AND "propId" = $3
        AND int_status = 1
      LIMIT 1
    `,
    [org_id, spbmId, prop_id]
  );
  if (existing.rows.length) {
    return existing.rows[0];
  }

  const sppdId = await nextQuotedIspId(client, 'tblISPPropDet', 'sppdId', 'SPPD', 3);
  const inserted = await client.query(
    `
      INSERT INTO "tblISPPropDet" (
        "sppdId", "spbmId", "propId", "propName", int_status,
        org_id, branch_id, created_by, created_on, changed_by, changed_on
      ) VALUES (
        $1, $2, $3, $4, 1,
        $5, $6, $7, CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP
      )
      RETURNING "sppdId", "propId", "propName"
    `,
    [sppdId, spbmId, prop_id, prop_name, org_id, branch_id || null, created_by || null]
  );
  return inserted.rows[0];
};

/**
 * Create spare part master configuration:
 * Category → Brand → Model (tblISPModCat) + properties (tblISPPropDet) + part number specs (tblISPPartNumberSpec).
 */
const getSparePartMasters = async (org_id, branch_id = null, hasSuperAccess = false) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      pn.sppart_ext_id AS part_number,
      MIN(pn.sppns_id) AS sppns_id,
      MAX(c.spc_id) AS spc_id,
      MAX(c.text) AS category_name,
      MAX(b."spbId") AS brand_id,
      MAX(b."brandName") AS brand_name,
      MAX(m."spbmId") AS model_id,
      MAX(m."modelName") AS model_name,
      MAX(pn.int_status) AS int_status,
      MAX(pn.created_on) AS created_on
    FROM "tblISPPartNumberSpec" pn
    INNER JOIN "tblISPPropDet" pd
      ON pd."sppdId" = pn.sppd_id
     AND pd.org_id = pn.org_id
    INNER JOIN "tblISPModel" m
      ON m."spbmId" = pd."spbmId"
     AND m.org_id = pd.org_id
    INNER JOIN "tblISPBrand" b
      ON b."spbId" = m."spbId"
     AND b.org_id = m.org_id
    LEFT JOIN "tblISPModCat" mc
      ON mc."spbmId" = m."spbmId"
     AND mc.org_id = m.org_id
     AND COALESCE(mc.int_status, 1) = 1
    LEFT JOIN "tblSPCategory" c
      ON c.spc_id = mc."spcId"
     AND c.org_id = mc.org_id
    WHERE pn.org_id = $1
      AND COALESCE(pn.int_status, 1) = 1
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (pn.branch_id IS NULL OR pn.branch_id = $${params.length})`;
  }

  query += `
    GROUP BY pn.sppart_ext_id
    ORDER BY MAX(pn.created_on) DESC NULLS LAST, pn.sppart_ext_id ASC
  `;

  const result = await dbPool.query(query, params);
  return result.rows;
};

const createSparePartMaster = async ({
  org_id,
  branch_id,
  created_by,
  spc_id,
  brand_id = null,
  brand_name = null,
  model_id = null,
  model_name = null,
  part_number,
  properties = [],
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const partNo = String(part_number || '').trim();
    if (!partNo) {
      const err = new Error('Part number is required');
      err.statusCode = 400;
      throw err;
    }
    if (!spc_id) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }
    if (!Array.isArray(properties) || properties.length === 0) {
      const err = new Error('At least one property is required');
      err.statusCode = 400;
      throw err;
    }

    const categoryCheck = await client.query(
      `
        SELECT spc_id, text
        FROM "tblSPCategory"
        WHERE spc_id = $1 AND org_id = $2 AND int_status = 1
      `,
      [spc_id, org_id]
    );
    if (!categoryCheck.rows.length) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    const duplicatePart = await client.query(
      `
        SELECT sppns_id
        FROM "tblISPPartNumberSpec"
        WHERE org_id = $1
          AND int_status = 1
          AND LOWER(BTRIM(sppart_ext_id)) = LOWER($2)
        LIMIT 1
      `,
      [org_id, partNo]
    );
    if (duplicatePart.rows.length) {
      const err = new Error('Part number already exists');
      err.statusCode = 400;
      throw err;
    }

    const brand = await findOrCreateIspBrand(client, {
      org_id,
      branch_id,
      created_by,
      brand_id,
      brand_name,
      strictCreate: !brand_id,
    });
    const model = await findOrCreateIspModel(client, {
      org_id,
      branch_id,
      created_by,
      spbId: brand.spbId,
      model_id,
      model_name,
      strictCreate: !model_id,
    });
    const spbmcId = await ensureIspModCat(client, {
      org_id,
      branch_id,
      created_by,
      spc_id,
      spbmId: model.spbmId,
    });

    const savedSpecs = [];
    const seenProps = new Set();

    for (const item of properties) {
      const prop_id = item?.prop_id;
      if (!prop_id) {
        const err = new Error('Each property must include prop_id');
        err.statusCode = 400;
        throw err;
      }
      if (seenProps.has(prop_id)) {
        const err = new Error('Duplicate properties are not allowed');
        err.statusCode = 400;
        throw err;
      }
      seenProps.add(prop_id);

      const propRow = await client.query(
        `
          SELECT prop_id, property
          FROM "tblProps"
          WHERE prop_id = $1 AND org_id = $2 AND int_status = 1
        `,
        [prop_id, org_id]
      );
      if (!propRow.rows.length) {
        const err = new Error(`Invalid property: ${prop_id}`);
        err.statusCode = 400;
        throw err;
      }

      const propDet = await findOrCreateIspPropDet(client, {
        org_id,
        branch_id,
        created_by,
        spbmId: model.spbmId,
        prop_id,
        prop_name: propRow.rows[0].property,
      });

      let aplvIds = [];
      if (Array.isArray(item?.aplv_ids)) {
        aplvIds = item.aplv_ids.filter(Boolean);
      } else if (item?.aplv_id) {
        aplvIds = [item.aplv_id];
      }

      const availableValues = await client.query(
        `
          SELECT aplv_id
          FROM "tblAssetPropListValues"
          WHERE prop_id = $1
            AND int_status = 1
            AND (org_id = $2 OR org_id IS NULL)
        `,
        [prop_id, org_id]
      );

      if (availableValues.rows.length && aplvIds.length === 0) {
        const err = new Error(
          `Select at least one list value for property ${propRow.rows[0].property}`
        );
        err.statusCode = 400;
        throw err;
      }

      for (const aplvId of aplvIds) {
        const valueCheck = await client.query(
          `
            SELECT aplv_id
            FROM "tblAssetPropListValues"
            WHERE aplv_id = $1
              AND prop_id = $2
              AND int_status = 1
          `,
          [aplvId, prop_id]
        );
        if (!valueCheck.rows.length) {
          const err = new Error(
            `Invalid list value for property ${propRow.rows[0].property}`
          );
          err.statusCode = 400;
          throw err;
        }
      }

      const specIds = aplvIds.length ? aplvIds : [null];
      for (const aplvId of specIds) {
        const sppnsId = await nextQuotedIspId(
          client,
          'tblISPPartNumberSpec',
          'sppns_id',
          'SPPNS',
          3
        );
        const specResult = await client.query(
          `
            INSERT INTO "tblISPPartNumberSpec" (
              sppns_id, sppart_ext_id, sppd_id, aplv_id, int_status,
              org_id, branch_id, created_by, created_on, changed_by, changed_on
            ) VALUES (
              $1, $2, $3, $4, 1,
              $5, $6, $7, CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP
            )
            RETURNING *
          `,
          [
            sppnsId,
            partNo,
            propDet.sppdId,
            aplvId,
            org_id,
            branch_id || null,
            created_by || null,
          ]
        );
        savedSpecs.push(specResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    return {
      spbmcId,
      category: categoryCheck.rows[0],
      brand,
      model,
      part_number: partNo,
      part_specs: savedSpecs,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getPropertyListValues = async (org_id, prop_id) => {
  const dbPool = getDb();
  if (!prop_id) return [];

  let result = await dbPool.query(
    `
      SELECT aplv_id, value, int_status, prop_id
      FROM "tblAssetPropListValues"
      WHERE prop_id = $1
        AND int_status = 1
        AND (org_id = $2 OR org_id IS NULL)
      ORDER BY value ASC
    `,
    [prop_id, org_id]
  );

  if (!result.rows.length) {
    result = await dbPool.query(
      `
        SELECT aplv_id, value, int_status, prop_id
        FROM "tblAssetPropListValues"
        WHERE prop_id = $1
          AND int_status = 1
        ORDER BY value ASC
      `,
      [prop_id]
    );
  }

  return result.rows;
};

const getIspModels = async (org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT
        m."spbmId" AS spbm_id,
        m."modelName" AS model_name,
        b."brandName" AS brand_name
      FROM "tblISPModel" m
      LEFT JOIN "tblISPBrand" b ON b."spbId" = m."spbId"
      WHERE m.org_id = $1
        AND COALESCE(m.int_status, 1) = 1
      ORDER BY b."brandName" ASC, m."modelName" ASC
    `,
    [org_id]
  );
  return result.rows;
};

/**
 * Create lot header (tblSPLotDet) + individual unit rows (tblSPIndDet) in one transaction.
 */

const markIndividualIssuedToAsset = async (client, { spid_id, asset_id, org_id, changed_by }) => {
  const db = client || getDb();
  const result = await db.query(
    `
      UPDATE "tblSPIndDet"
      SET
        asset_id = $1,
        is_used = 1,
        changed_by = $2,
        changed_on = CURRENT_TIMESTAMP
      WHERE spid_id = $3
        AND org_id = $4
      RETURNING *
    `,
    [asset_id, changed_by || null, spid_id, org_id]
  );
  return result.rows[0] || null;
};

/**
 * Create spare issue on maintenance approval.
 * Saves both assetmaintsch_id (ams_id) and asset_id, and marks the unit used.
 */
const createSpareIssueOnApproval = async ({
  org_id,
  branch_id,
  ss_id,
  assetmaintsch_id,
  asset_id,
  spid_id,
  quantity_issued = 1,
  issued_to,
  issued_by,
  remarks,
  status = 'ISSUED',
  created_by,
}) => {
  if (!org_id) throw new Error('org_id is required');
  if (!ss_id) throw new Error('ss_id is required');
  if (!assetmaintsch_id) throw new Error('assetmaintsch_id is required');
  if (!asset_id) throw new Error('asset_id is required');

  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    // Prefer explicit asset_id; otherwise resolve from maintenance schedule
    let resolvedAssetId = asset_id;
    const amsResult = await client.query(
      `
        SELECT ams_id, asset_id
        FROM "tblAssetMaintSch"
        WHERE ams_id = $1
          AND org_id = $2
      `,
      [assetmaintsch_id, org_id]
    );
    if (!amsResult.rows.length) {
      throw new Error(`Maintenance schedule ${assetmaintsch_id} not found`);
    }
    if (!resolvedAssetId) {
      resolvedAssetId = amsResult.rows[0].asset_id;
    }
    if (!resolvedAssetId) {
      throw new Error(`No asset_id found for maintenance schedule ${assetmaintsch_id}`);
    }

    const si_id = await generateCustomIdForClient(client, 'spare_issue', 3);

    const issueResult = await client.query(
      `
        INSERT INTO "tblSpareIssue" (
          si_id,
          org_id,
          branch_id,
          ss_id,
          assetmaintsch_id,
          asset_id,
          spid_id,
          quantity_issued,
          issued_to,
          issued_by,
          remarks,
          status,
          created_by,
          created_on,
          changed_by,
          changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          CURRENT_TIMESTAMP, $13, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        si_id,
        org_id,
        branch_id || null,
        ss_id,
        assetmaintsch_id,
        resolvedAssetId,
        spid_id || null,
        quantity_issued,
        issued_to || null,
        issued_by || created_by || null,
        remarks || null,
        status,
        created_by || null,
      ]
    );

    let individual = null;
    if (spid_id) {
      individual = await markIndividualIssuedToAsset(client, {
        spid_id,
        asset_id: resolvedAssetId,
        org_id,
        changed_by: created_by,
      });
    }

    const sph_id = await generateCustomIdForClient(client, 'spare_history', 3);
    await client.query(
      `
        INSERT INTO "tblSpareHistory" (
          sph_id, si_id, status, remarks, org_id, branch_id, created_by, created_on
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
        )
      `,
      [
        sph_id,
        si_id,
        status,
        remarks || null,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    await client.query('COMMIT');
    return {
      issue: issueResult.rows[0],
      individual,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getIspModels,
  markIndividualIssuedToAsset,
  createSpareIssueOnApproval,

  getCategories,
  createCategory,
  getSpBrands,
  createSpBrand,
  getSpModels,
  createSpModel,
  getCategoryMappings,
  createCategoryMapping,
  getModCatCategories,
  getProdServAssetTypes,
  getProdServBrands,
  getProdServModels,
  getSparePartLots,
  getSparePartLotById,
  createSparePartLot,
  updateSparePartLot,
  getLotVendors,
  getLotCategoriesByVendor,
  getLotBrandsByCategory,
  getLotModelsByCategoryAndBrand,
  getLotPartNumber,
  getSparePartMasters,
  createSparePartMaster,
  getPropertyListValues,
  getIndividualsByLotId,
  getVendorSpareMappings,
  createVendorSpareMappings,
  convertSpcToSerialFormat,
  buildSpareSerialNumber,
  extractSequenceFromSerial,
  SPARE_ISSUE_STATUS,
  getCategoryMappingsByAssetType,
  getSparePartMaintenanceList,
  getSparePartMaintenanceDetail,
  createSpareIssueRequests,
  getSpareIssueApprovals,
  getSpareIssueApprovalDetail,
  approveSpareIssue,
  confirmSparePartIssue,
  getAvailableQuantity,
  resolveIssueSpcId,
  getSpareIssuedNotificationsByUser,
  notifySparePartIssued,
};
