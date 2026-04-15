const { getDb } = require("../utils/dbContext");

const OPEN_STATUSES = ["NEW", "OPEN", "SNOOZED", "UNREAD"];

const mapStatus = (status) => {
  if (!status) return "NEW";
  const normalized = String(status).toUpperCase();
  if (normalized === "UNREAD") return "NEW";
  return normalized;
};

const makeNotifyId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AWN${ts}${rnd}`;
};

const getEligibleWarrantyRoles = async (orgId) => {
  const res = await getDb().query(
    `
      SELECT
        jr.job_role_id,
        jr.text AS job_role_name,
        COUNT(DISTINCT u.emp_int_id) AS user_count
      FROM "tblJobRoles" jr
      LEFT JOIN "tblUserJobRoles" ujr ON ujr.job_role_id = jr.job_role_id
      LEFT JOIN "tblUsers" u
        ON u.user_id = ujr.user_id
       AND u.int_status = 1
       AND u.emp_int_id IS NOT NULL
      WHERE jr.org_id = $1
        AND COALESCE(jr.notif_warranty, FALSE) = TRUE
      GROUP BY jr.job_role_id, jr.text
      ORDER BY jr.job_role_id
    `,
    [orgId]
  );

  const roles = res.rows.map((r) => ({
    job_role_id: r.job_role_id,
    job_role_name: r.job_role_name,
    user_count: Number(r.user_count || 0),
  }));
  const totalUsers = roles.reduce((sum, r) => sum + r.user_count, 0);
  return { roles, totalUsers };
};

const createWarrantyNotificationsForAsset = async ({ assetId, orgId }) => {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const assetRes = await client.query(
      `
        SELECT a.asset_id, a.text, a.warranty_period, a.service_vendor_id, a.asset_type_id
        FROM "tblAssets" a
        WHERE a.asset_id = $1 AND a.org_id = $2
      `,
      [assetId, orgId]
    );

    if (!assetRes.rows.length) {
      throw new Error("Asset not found");
    }

    const asset = assetRes.rows[0];
    if (!asset.warranty_period) {
      await client.query("COMMIT");
      return { created: 0, skipped: true };
    }

    const recipientsRes = await client.query(
      `
        SELECT DISTINCT u.emp_int_id
        FROM "tblJobRoles" jr
        INNER JOIN "tblUserJobRoles" ujr ON ujr.job_role_id = jr.job_role_id
        INNER JOIN "tblUsers" u ON u.user_id = ujr.user_id
        WHERE jr.org_id = $1
          AND COALESCE(jr.notif_warranty, FALSE) = TRUE
          AND u.int_status = 1
          AND u.emp_int_id IS NOT NULL
      `,
      [orgId]
    );

    let created = 0;
    for (const recipient of recipientsRes.rows) {
      const existingRes = await client.query(
        `
          SELECT notify_id
          FROM "tblAssetWarrantyNotify"
          WHERE org_id = $1
            AND asset_id = $2
            AND emp_int_id = $3
            AND UPPER(status) = ANY($4::text[])
          ORDER BY created_on DESC
          LIMIT 1
        `,
        [orgId, assetId, recipient.emp_int_id, OPEN_STATUSES]
      );

      if (existingRes.rows.length > 0) {
        continue;
      }

      const title = "Warranty Expiry";
      const body = `Asset ${asset.asset_id} (${asset.text || "Unnamed Asset"}) warranty expires on ${new Date(asset.warranty_period).toISOString().slice(0, 10)}.`;

      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        const notifyId = makeNotifyId();
        try {
          await client.query(
            `
              INSERT INTO "tblAssetWarrantyNotify"
                (notify_id, notif_group_id, asset_id, org_id, status, title, body, snooze_days, emp_int_id, created_on)
              VALUES
                ($1, $2, $3, $4, 'NEW', $5, $6, 0, $7, CURRENT_TIMESTAMP)
            `,
            [notifyId, `AWNG_${assetId}`, assetId, orgId, title, body, recipient.emp_int_id]
          );
          inserted = true;
        } catch (error) {
          if (error.code !== "23505") {
            throw error;
          }
        }
      }
      if (!inserted) {
        throw new Error("Failed to generate unique warranty notify_id");
      }
      created += 1;
    }

    await client.query("COMMIT");
    return { created, skipped: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const ensureWarrantyNotificationsForWindow = async ({ orgId, days = 10 }) => {
  const eligibility = await getEligibleWarrantyRoles(orgId);
  const assetsRes = await getDb().query(
    `
      SELECT asset_id
      FROM "tblAssets"
      WHERE org_id = $1
        AND warranty_period IS NOT NULL
        AND warranty_period <= (CURRENT_DATE + ($2::int * INTERVAL '1 day'))
    `,
    [orgId, days]
  );

  let created = 0;
  for (const row of assetsRes.rows) {
    const result = await createWarrantyNotificationsForAsset({
      assetId: row.asset_id,
      orgId,
    });
    created += Number(result.created || 0);
  }
  return {
    scanned: assetsRes.rows.length,
    created,
    eligible_roles: eligibility.roles,
    eligible_users_count: eligibility.totalUsers,
  };
};

const ensureWarrantyNotificationsForWindowAllOrgs = async ({ days = 10 }) => {
  const orgsRes = await getDb().query(
    `
      SELECT DISTINCT org_id
      FROM "tblAssets"
      WHERE org_id IS NOT NULL
        AND warranty_period IS NOT NULL
        AND warranty_period <= (CURRENT_DATE + ($1::int * INTERVAL '1 day'))
    `,
    [days]
  );

  let scanned = 0;
  let created = 0;
  const orgBreakdown = [];
  for (const row of orgsRes.rows) {
    const result = await ensureWarrantyNotificationsForWindow({
      orgId: row.org_id,
      days,
    });
    orgBreakdown.push({
      org_id: row.org_id,
      scanned: result.scanned,
      created: result.created,
      eligible_roles: result.eligible_roles,
      eligible_users_count: result.eligible_users_count,
    });
    scanned += Number(result.scanned || 0);
    created += Number(result.created || 0);
  }

  return { orgs: orgsRes.rows.length, scanned, created, org_breakdown: orgBreakdown };
};

const getWarrantyNotificationsByUser = async ({
  empIntId,
  orgId,
  branchId,
  hasSuperAccess = false,
}) => {
  const params = [empIntId, orgId];
  let branchFilter = "";
  if (!hasSuperAccess && branchId) {
    params.push(branchId);
    branchFilter = ` AND (a.branch_id = $${params.length} OR a.branch_id IS NULL)`;
  }

  const res = await getDb().query(
    `
      SELECT
        n.notify_id,
        n.asset_id,
        n.status,
        n.title,
        n.body,
        n.created_on,
        n.last_seen_on,
        n.snooze_days,
        a.warranty_period,
        a.service_vendor_id,
        a.asset_type_id,
        at.text AS asset_type_name
      FROM "tblAssetWarrantyNotify" n
      INNER JOIN "tblAssets" a ON a.asset_id = n.asset_id AND a.org_id = n.org_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE n.emp_int_id = $1
        AND n.org_id = $2
        AND UPPER(n.status) <> 'RESOLVED'
        AND UPPER(n.status) <> 'CLOSED'
        ${branchFilter}
      ORDER BY n.created_on DESC
      LIMIT 200
    `,
    params
  );

  return res.rows.filter((row) => {
    if ((row.snooze_days || 0) <= 0 || !row.last_seen_on) {
      return true;
    }
    const availableOn = new Date(row.last_seen_on);
    availableOn.setDate(availableOn.getDate() + Number(row.snooze_days || 0));
    return availableOn <= new Date();
  });
};

const markWarrantyNotificationOpen = async ({ notifyId, orgId, empIntId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetWarrantyNotify"
      SET status = 'OPEN', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId]
  );
  return res.rows[0] || null;
};

const discardWarrantyNotification = async ({ notifyId, orgId, empIntId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetWarrantyNotify"
      SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId]
  );
  return res.rows[0] || null;
};

const snoozeWarrantyNotification = async ({
  notifyId,
  orgId,
  empIntId,
  snoozeDays,
}) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetWarrantyNotify"
      SET status = 'SNOOZED', snooze_days = $4, last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId, snoozeDays]
  );
  return res.rows[0] || null;
};

const resolveWarrantyNotification = async ({ notifyId, orgId }) => {
  if (!notifyId) return null;
  const res = await getDb().query(
    `
      UPDATE "tblAssetWarrantyNotify"
      SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2
      RETURNING *
    `,
    [notifyId, orgId]
  );
  return res.rows[0] || null;
};

const resolveWarrantyNotificationsByAsset = async ({ assetId, orgId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetWarrantyNotify"
      SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
      WHERE asset_id = $1
        AND org_id = $2
        AND UPPER(status) <> 'RESOLVED'
        AND UPPER(status) <> 'CLOSED'
      RETURNING notify_id
    `,
    [assetId, orgId]
  );
  return res.rowCount || 0;
};

module.exports = {
  mapStatus,
  createWarrantyNotificationsForAsset,
  ensureWarrantyNotificationsForWindow,
  ensureWarrantyNotificationsForWindowAllOrgs,
  getWarrantyNotificationsByUser,
  markWarrantyNotificationOpen,
  discardWarrantyNotification,
  snoozeWarrantyNotification,
  resolveWarrantyNotification,
  resolveWarrantyNotificationsByAsset,
};
