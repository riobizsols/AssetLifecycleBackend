const { getDb } = require("../utils/dbContext");
const fcmService = require("../services/fcmService");

const OPEN_STATUSES = ["NEW", "OPEN", "SNOOZED", "UNREAD"];
const TITLE_EXPIRING = "Asset Expiry";
const TITLE_EXPIRED = "Asset Expired";
const DEFAULT_ALERT_DAYS = 7;

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getExpiryPhase = (expiryDate) => {
  const assetExpiry = toDateOnly(expiryDate);
  if (!assetExpiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (assetExpiry < today) {
    return {
      isExpired: true,
      title: TITLE_EXPIRED,
      bodyPrefix: "lifecycle expiry date was",
      notifGroupIdSuffix: "EXPIRED",
    };
  }

  return {
    isExpired: false,
    title: TITLE_EXPIRING,
    bodyPrefix: "lifecycle expiry date is",
    notifGroupIdSuffix: "EXPIRING",
  };
};

const mapStatus = (status) => {
  if (!status) return "NEW";
  const normalized = String(status).toUpperCase();
  if (normalized === "UNREAD") return "NEW";
  return normalized;
};

const makeNotifyId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AEN${ts}${rnd}`;
};

const makePreferenceId = () => `PREF${Math.random().toString(36).slice(2, 15).toUpperCase()}`;

const ensureExpiryPushPreference = async (userId, notificationType) => {
  const db = getDb();
  const existing = await db.query(
    `
      SELECT preference_id, push_enabled
      FROM "tblNotificationPreferences"
      WHERE user_id = $1 AND notification_type = $2
    `,
    [userId, notificationType]
  );

  if (existing.rows.length === 0) {
    await db.query(
      `
        INSERT INTO "tblNotificationPreferences" (
          preference_id, user_id, notification_type,
          is_enabled, email_enabled, push_enabled
        ) VALUES ($1, $2, $3, true, true, true)
      `,
      [makePreferenceId(), userId, notificationType]
    );
    return true;
  }

  return !!existing.rows[0].push_enabled;
};

const sendExpiryPushNotification = async ({
  userId,
  title,
  body,
  notifyId,
  assetId,
  isExpired,
}) => {
  const notificationType = isExpired ? "asset_expired" : "asset_expiry";

  try {
    await ensureExpiryPushPreference(userId, notificationType);
    const result = await fcmService.sendNotificationToUser({
      userId,
      title,
      body,
      data: {
        asset_id: assetId,
        notify_id: notifyId,
        notification_type: notificationType,
        type: notificationType,
        route: "AssetExpiryNotifications",
      },
      notificationType,
    });

    if (!result.success) {
      console.log(
        `[AssetExpiryPush] Skipped mobile push for user ${userId}: ${result.reason || "unknown"}`
      );
    }
  } catch (error) {
    console.error(`[AssetExpiryPush] Failed for user ${userId}:`, error.message);
  }
};

const getEligibleExpiryRoles = async (orgId) => {
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
        AND COALESCE(jr.notif_scrap, FALSE) = TRUE
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

const createExpiryNotificationsForAsset = async ({ assetId, orgId }) => {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const assetRes = await client.query(
      `
        SELECT a.asset_id, a.text, a.expiry_date, a.asset_type_id, a.current_status
        FROM "tblAssets" a
        WHERE a.asset_id = $1 AND a.org_id = $2
      `,
      [assetId, orgId]
    );

    if (!assetRes.rows.length) {
      throw new Error("Asset not found");
    }

    const asset = assetRes.rows[0];
    if (!asset.expiry_date) {
      await client.query("COMMIT");
      return { created: 0, skipped: true };
    }

    if (String(asset.current_status || "").toUpperCase() === "SCRAPPED") {
      await client.query("COMMIT");
      return { created: 0, skipped: true };
    }

    const phase = getExpiryPhase(asset.expiry_date);
    if (!phase) {
      await client.query("COMMIT");
      return { created: 0, skipped: true };
    }

    const expiryDateStr = toDateOnly(asset.expiry_date).toISOString().slice(0, 10);
    const title = phase.title;
    const body = `Asset ${asset.asset_id} (${asset.text || "Unnamed Asset"}) ${phase.bodyPrefix} ${expiryDateStr}.`;
    const notifGroupId = `AENG_${assetId}_${phase.notifGroupIdSuffix}`;

    const recipientsRes = await client.query(
      `
        SELECT DISTINCT u.user_id, u.emp_int_id
        FROM "tblJobRoles" jr
        INNER JOIN "tblUserJobRoles" ujr ON ujr.job_role_id = jr.job_role_id
        INNER JOIN "tblUsers" u ON u.user_id = ujr.user_id
        WHERE jr.org_id = $1
          AND COALESCE(jr.notif_scrap, FALSE) = TRUE
          AND u.int_status = 1
          AND u.emp_int_id IS NOT NULL
      `,
      [orgId]
    );

    let created = 0;
    const pushTargets = [];
    for (const recipient of recipientsRes.rows) {
      if (phase.isExpired) {
        await client.query(
          `
            UPDATE "tblAssetExpiryNotify"
            SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
            WHERE org_id = $1
              AND asset_id = $2
              AND emp_int_id = $3
              AND title = $4
              AND UPPER(status) = ANY($5::text[])
          `,
          [orgId, assetId, recipient.emp_int_id, TITLE_EXPIRING, OPEN_STATUSES]
        );
      }

      const existingRes = await client.query(
        `
          SELECT notify_id
          FROM "tblAssetExpiryNotify"
          WHERE org_id = $1
            AND asset_id = $2
            AND emp_int_id = $3
            AND title = $4
            AND UPPER(status) = ANY($5::text[])
          ORDER BY created_on DESC
          LIMIT 1
        `,
        [orgId, assetId, recipient.emp_int_id, title, OPEN_STATUSES]
      );

      if (existingRes.rows.length > 0) {
        continue;
      }

      let inserted = false;
      let notifyId = null;
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        notifyId = makeNotifyId();
        try {
          await client.query(
            `
              INSERT INTO "tblAssetExpiryNotify"
                (notify_id, notif_group_id, asset_id, org_id, status, title, body, snooze_days, emp_int_id, created_on)
              VALUES
                ($1, $2, $3, $4, 'NEW', $5, $6, 0, $7, CURRENT_TIMESTAMP)
            `,
            [notifyId, notifGroupId, assetId, orgId, title, body, recipient.emp_int_id]
          );
          inserted = true;
        } catch (error) {
          if (error.code !== "23505") {
            throw error;
          }
        }
      }
      if (!inserted) {
        throw new Error("Failed to generate unique asset expiry notify_id");
      }
      created += 1;
      pushTargets.push({
        userId: recipient.user_id,
        title,
        body,
        notifyId,
        assetId,
        isExpired: phase.isExpired,
      });
    }

    await client.query("COMMIT");

    for (const target of pushTargets) {
      sendExpiryPushNotification(target);
    }

    return { created, skipped: false, pushQueued: pushTargets.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const ensureExpiryNotificationsForWindow = async ({ orgId, days = DEFAULT_ALERT_DAYS }) => {
  const eligibility = await getEligibleExpiryRoles(orgId);
  const assetsRes = await getDb().query(
    `
      SELECT asset_id
      FROM "tblAssets"
      WHERE org_id = $1
        AND expiry_date IS NOT NULL
        AND UPPER(COALESCE(current_status, '')) <> 'SCRAPPED'
        AND expiry_date <= (CURRENT_DATE + ($2::int * INTERVAL '1 day'))
    `,
    [orgId, days]
  );

  let created = 0;
  for (const row of assetsRes.rows) {
    const result = await createExpiryNotificationsForAsset({
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

const ensureExpiryNotificationsForWindowAllOrgs = async ({ days = DEFAULT_ALERT_DAYS }) => {
  const orgsRes = await getDb().query(
    `
      SELECT DISTINCT org_id
      FROM "tblAssets"
      WHERE org_id IS NOT NULL
        AND expiry_date IS NOT NULL
        AND UPPER(COALESCE(current_status, '')) <> 'SCRAPPED'
        AND expiry_date <= (CURRENT_DATE + ($1::int * INTERVAL '1 day'))
    `,
    [days]
  );

  let scanned = 0;
  let created = 0;
  const orgBreakdown = [];
  for (const row of orgsRes.rows) {
    const result = await ensureExpiryNotificationsForWindow({
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

const getExpiryNotificationsByUser = async ({
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

  try {
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
        a.expiry_date,
        a.asset_type_id,
        a.text AS asset_name,
        at.text AS asset_type_name
      FROM "tblAssetExpiryNotify" n
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
  } catch (error) {
    if (error.code === '42P01') {
      return [];
    }
    throw error;
  }
};

const markExpiryNotificationOpen = async ({ notifyId, orgId, empIntId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetExpiryNotify"
      SET status = 'OPEN', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId]
  );
  return res.rows[0] || null;
};

const discardExpiryNotification = async ({ notifyId, orgId, empIntId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetExpiryNotify"
      SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId]
  );
  return res.rows[0] || null;
};

const snoozeExpiryNotification = async ({
  notifyId,
  orgId,
  empIntId,
  snoozeDays,
}) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetExpiryNotify"
      SET status = 'SNOOZED', snooze_days = $4, last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2 AND emp_int_id = $3
      RETURNING *
    `,
    [notifyId, orgId, empIntId, snoozeDays]
  );
  return res.rows[0] || null;
};

const resolveExpiryNotification = async ({ notifyId, orgId }) => {
  if (!notifyId) return null;
  const res = await getDb().query(
    `
      UPDATE "tblAssetExpiryNotify"
      SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
      WHERE notify_id = $1 AND org_id = $2
      RETURNING *
    `,
    [notifyId, orgId]
  );
  return res.rows[0] || null;
};

const resolveExpiryNotificationsByAsset = async ({ assetId, orgId }) => {
  const res = await getDb().query(
    `
      UPDATE "tblAssetExpiryNotify"
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
  mapStatus: mapStatus,
  DEFAULT_ALERT_DAYS,
  createExpiryNotificationsForAsset,
  ensureExpiryNotificationsForWindow,
  ensureExpiryNotificationsForWindowAllOrgs,
  getExpiryNotificationsByUser,
  markExpiryNotificationOpen,
  discardExpiryNotification,
  snoozeExpiryNotification,
  resolveExpiryNotification,
  resolveExpiryNotificationsByAsset,
};
