const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomIdForClient } = require('../utils/idGenerator');
const fcmService = require('../services/fcmService');

const getDb = () => getDbFromContext();

const SPARE_ISSUE_STATUS = {
  REQUESTED: 'RQ',
  ISSUED: 'IS',
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
      m.brand,
      m.model,
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
  query += ` ORDER BY c.text ASC, m.brand ASC, m.model ASC`;
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
  let query = `
    SELECT
      ams.ams_id,
      ams.asset_id,
      ams.maint_type_id,
      ams.vendor_id,
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
          CASE si.status WHEN 'IS' THEN 1 WHEN 'RQ' THEN 2 ELSE 3 END,
          si.created_on DESC NULLS LAST
        LIMIT 1
      ) AS spare_status
    FROM "tblAssetMaintSch" ams
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    WHERE ams.org_id = $1
      AND a.org_id = $1
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
  let query = `
    SELECT
      ams.*,
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
          CASE si.status WHEN 'IS' THEN 1 WHEN 'RQ' THEN 2 ELSE 3 END,
          si.created_on DESC NULLS LAST
        LIMIT 1
      ) AS spare_status
    FROM "tblAssetMaintSch" ams
    INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    WHERE ams.ams_id = $1
      AND ams.org_id = $2
      AND a.org_id = $2
  `;
  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND a.branch_id = $${params.length}`;
  }
  const result = await dbPool.query(query, params);
  return result.rows[0] || null;
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
        SELECT ams.ams_id, ams.org_id, ams.vendor_id, a.asset_type_id, a.branch_id
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
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
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    LEFT JOIN "tblSPIndDet" ind ON si.spid_id = ind.spid_id
    WHERE si.org_id = $1
      AND si.status IN ('RQ', 'IS')
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
      is_approved: row.status === SPARE_ISSUE_STATUS.ISSUED,
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
  let query = `
    SELECT
      si.*,
      ams.maint_type_id,
      ams.vendor_id,
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
    LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
    LEFT JOIN "tblSPIndDet" ind ON si.spid_id = ind.spid_id
    WHERE si.si_id = $1
      AND si.org_id = $2
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
    is_approved: row.status === SPARE_ISSUE_STATUS.ISSUED,
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

const notifySparePartIssued = async ({ issueRow, org_id }) => {
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

    const title = 'Spare Part Issued';
    const body = `Maintenance ${maintenanceId || '-'}: ${assetTypeName} / ${categoryName} — spare part issued${
      quantityIssued !== '' && quantityIssued != null
        ? ` (qty ${quantityIssued})`
        : ''
    }`;
    const payload = {
      type: 'spare_part_issued',
      si_id: issueRow.si_id,
      assetmaintsch_id: maintenanceId || '',
      maintenance_id: maintenanceId || '',
      asset_type_name: assetTypeName,
      category_name: categoryName,
      quantity_issued: String(quantityIssued ?? ''),
      status: 'Issued',
      spc_id,
      route: `/spare-part-list-detail/${maintenanceId || ''}`,
    };

    const adminUserIds = await getSystemAdminUserIds(dbPool, org_id);
    const targetUserIds = new Set(adminUserIds);
    if (issueRow.created_by) targetUserIds.add(issueRow.created_by);

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
 * In-app notifications after spare parts are Issued.
 * Requesters see their own; System Administrators see all org issued rows.
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

  const params = [orgId];
  let branchFilter = '';
  if (!hasSuperAccess && branchId) {
    params.push(branchId);
    branchFilter = ` AND (a.branch_id = $${params.length} OR a.branch_id IS NULL OR si.branch_id = $${params.length})`;
  }

  let requesterJoin = '';
  if (!isAdmin) {
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
        AND si.status = $${params.length + 1}
        ${branchFilter}
      ORDER BY COALESCE(si.changed_on, si.created_on) DESC
      LIMIT 100
    `,
    [...params, SPARE_ISSUE_STATUS.ISSUED],
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
      status_label: 'Issued',
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
    if (issue.status === SPARE_ISSUE_STATUS.ISSUED) {
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
        SPARE_ISSUE_STATUS.ISSUED,
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
        SPARE_ISSUE_STATUS.ISSUED,
        `Issued ${qty} unit(s) for category ${spc_id}`,
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
const getCategories = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false,
  activeOnly = true
) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      spc_id,
      text,
      uom,
      minimum_stock,
      re_order_level,
      int_status,
      org_id,
      branch_id,
      created_by,
      created_on,
      changed_by,
      changed_on
    FROM "tblSPCategory"
    WHERE org_id = $1
  `;

  if (activeOnly) {
    query += ` AND int_status = 1`;
  }

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (branch_id IS NULL OR branch_id = $${params.length})`;
  }

  query += ` ORDER BY text ASC`;
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
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

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
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, 1,
          $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP
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

const getCategoryMappings = async (org_id, branch_id = null, hasSuperAccess = false) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      m.spcatm_id,
      m.spc_id,
      c.text AS category_name,
      m.asset_type_id,
      at.text AS asset_type_name,
      m.spbm_id,
      isp."modelName" AS model_name,
      br."brandName" AS brand_name,
      m.prod_serv_id,
      ps.description AS prod_serv_name,
      ps.brand AS prod_serv_brand,
      ps.model AS prod_serv_model,
      m.int_status,
      m.org_id,
      m.branch_id,
      m.created_by,
      m.created_on
    FROM "tblSPCatATMap" m
    LEFT JOIN "tblSPCategory" c ON c.spc_id = m.spc_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.asset_type_id
    LEFT JOIN "tblISPModel" isp ON isp."spbmId" = m.spbm_id
    LEFT JOIN "tblISPBrand" br ON br."spbId" = isp."spbId"
    LEFT JOIN "tblProdServs" ps ON ps.prod_serv_id = m.prod_serv_id
    WHERE m.org_id = $1
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (m.branch_id IS NULL OR m.branch_id = $${params.length})`;
  }

  query += ` ORDER BY c.text ASC, at.text ASC, br."brandName" ASC, isp."modelName" ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const createCategoryMapping = async ({
  org_id,
  branch_id,
  spc_id,
  asset_type_id,
  spbm_id,
  prod_serv_id,
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

    const spbmVal = spbm_id != null && String(spbm_id).trim() ? String(spbm_id).trim() : null;
    const prodServVal =
      prod_serv_id != null && String(prod_serv_id).trim() ? String(prod_serv_id).trim() : null;

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

    if (spbmVal) {
      const modelRow = await client.query(
        `
          SELECT "spbmId" FROM "tblISPModel"
          WHERE "spbmId" = $1 AND org_id = $2
        `,
        [spbmVal, org_id]
      );
      if (!modelRow.rows.length) {
        const err = new Error('Invalid brand / model');
        err.statusCode = 400;
        throw err;
      }
    }

    if (prodServVal) {
      const ps = await client.query(
        `
          SELECT prod_serv_id FROM "tblProdServs"
          WHERE prod_serv_id = $1 AND org_id = $2
        `,
        [prodServVal, org_id]
      );
      if (!ps.rows.length) {
        const err = new Error('Invalid product / service');
        err.statusCode = 400;
        throw err;
      }
    }

    const dup = await client.query(
      `
        SELECT 1 FROM "tblSPCatATMap"
        WHERE org_id = $1
          AND spc_id = $2
          AND asset_type_id = $3
          AND COALESCE(spbm_id, '') = COALESCE($4, '')
          AND COALESCE(prod_serv_id, '') = COALESCE($5, '')
          AND int_status = 1
        LIMIT 1
      `,
      [org_id, spc_id, asset_type_id, spbmVal, prodServVal]
    );
    if (dup.rows.length) {
      const err = new Error('This category / asset type / brand-model / product-service mapping already exists');
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
        spbmVal,
        prodServVal,
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
 * Create lot header (tblSPLotDet) + individual unit rows (tblSPIndDet) in one transaction.
 */
const createSparePartLot = async ({
  org_id,
  branch_id,
  spc_id,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          CURRENT_TIMESTAMP, $11, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spld_id,
        spc_id,
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
  getCategoryMappings,
  createCategoryMapping,
  getSparePartLots,
  createSparePartLot,
  getIndividualsByLotId,
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
  getAvailableQuantity,
  resolveIssueSpcId,
  getSpareIssuedNotificationsByUser,
  notifySparePartIssued,
};
