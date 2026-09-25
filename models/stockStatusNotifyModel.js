/**
 * Stock status notifications — Out of stock / Needs purchase.
 *
 * Creates rows in tblStockStatusNotify when available hits 0 or
 * available is at/below minimum_stock (and not zero). Dedupes by
 * notif_group_id so the same status does not spam.
 */
const { getDb } = require('../utils/dbContext');
const fcmService = require('../services/fcmService');

const OPEN_STATUSES = ['NEW', 'OPEN', 'UNREAD', 'SNOOZED'];
const TABLE = 'tblStockStatusNotify';

let tableReady = false;

const makeNotifyId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SSN${ts}${rnd}`;
};

const makePreferenceId = () => `PREF${Math.random().toString(36).slice(2, 15).toUpperCase()}`;

async function ensureStockNotifyTable(db = getDb()) {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS "${TABLE}" (
      notify_id       VARCHAR(50) PRIMARY KEY,
      notif_group_id  VARCHAR(80) NOT NULL,
      org_id          VARCHAR(50) NOT NULL,
      spc_id          VARCHAR(50) NOT NULL,
      part_name       VARCHAR(255),
      alert_status    VARCHAR(30) NOT NULL,
      available_qty   INTEGER,
      minimum_stock   INTEGER,
      status          VARCHAR(20) NOT NULL DEFAULT 'NEW',
      title           VARCHAR(255),
      body            TEXT,
      emp_int_id      VARCHAR(50),
      user_id         VARCHAR(50),
      last_seen_on    TIMESTAMPTZ,
      created_on      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      changed_on      TIMESTAMPTZ
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_${TABLE}_org_status ON "${TABLE}" (org_id, status)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_${TABLE}_emp ON "${TABLE}" (emp_int_id)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_${TABLE}_group ON "${TABLE}" (notif_group_id)`,
  );
  tableReady = true;
}

async function ensurePushPreference(db, userId, notificationType) {
  if (!userId) return;
  const existing = await db.query(
    `
      SELECT preference_id
        FROM "tblNotificationPreferences"
       WHERE user_id = $1 AND notification_type = $2
       LIMIT 1
    `,
    [userId, notificationType],
  );
  if (existing.rows.length) return;
  try {
    await db.query(
      `
        INSERT INTO "tblNotificationPreferences" (
          preference_id, user_id, notification_type,
          is_enabled, email_enabled, push_enabled
        ) VALUES ($1, $2, $3, true, true, true)
      `,
      [makePreferenceId(), userId, notificationType],
    );
  } catch (err) {
    console.warn(`[StockNotify] preference create failed: ${err.message}`);
  }
}

async function getRecipientUsers(db, orgId) {
  const res = await db.query(
    `
      SELECT DISTINCT u.user_id, u.emp_int_id
        FROM "tblUsers" u
        INNER JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
        INNER JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
        LEFT JOIN "tblJobRoleNav" n
          ON n.job_role_id = ujr.job_role_id
         AND COALESCE(n.int_status, 1) = 1
         AND n.app_id IN ('OUTOFSTOCKREPORT', 'PURCHASEREQUIREMENTREPORT', 'SPAREPARTAPPROVAL')
       WHERE u.int_status = 1
         AND u.emp_int_id IS NOT NULL
         AND (u.org_id = $1 OR u.org_id IS NULL)
         AND (
           n.app_id IS NOT NULL
           OR ujr.job_role_id = 'JR001'
           OR LOWER(TRIM(jr.text)) = 'system administrator'
         )
    `,
    [orgId],
  );
  return res.rows.filter((r) => r.user_id && r.emp_int_id);
}

/**
 * Parts that are out of stock or at/below minimum stock (not zero).
 */
async function listAlertParts(db, orgId) {
  const res = await db.query(
    `
      SELECT
        c.spc_id AS part_code,
        c.text AS description,
        c.minimum_stock,
        COALESCE(s.available_qty, 0)::int AS available
      FROM "tblSPCategory" c
      LEFT JOIN (
        SELECT
          ind.spc_id,
          COUNT(*) FILTER (WHERE COALESCE(ind.is_used, 0) = 0)::int AS available_qty
        FROM "tblSPIndDet" ind
        WHERE ind.org_id = $1
        GROUP BY ind.spc_id
      ) s ON s.spc_id = c.spc_id
      WHERE c.org_id = $1
        AND COALESCE(c.int_status, 1) = 1
    `,
    [orgId],
  );

  return res.rows
    .map((row) => {
      const available = Number(row.available) || 0;
      const min =
        row.minimum_stock == null || row.minimum_stock === ''
          ? null
          : Number(row.minimum_stock);
      const hasMin = min != null && !Number.isNaN(min) && min > 0;
      const isOutOfStock = available <= 0;
      const needsPurchase = hasMin && available > 0 && available <= min;
      if (!isOutOfStock && !needsPurchase) return null;
      const alertStatus = isOutOfStock ? 'OUT_OF_STOCK' : 'NEEDS_PURCHASE';
      return {
        spc_id: row.part_code,
        description: row.description || row.part_code,
        available,
        minimum_stock: hasMin ? min : null,
        alert_status: alertStatus,
      };
    })
    .filter(Boolean);
}

function buildMessage(part) {
  if (part.alert_status === 'OUT_OF_STOCK') {
    return {
      title: 'Out of stock',
      body: `${part.description} (${part.spc_id}) is out of stock (available 0${
        part.minimum_stock != null ? `, minimum ${part.minimum_stock}` : ''
      }).`,
      notificationType: 'stock_out_of_stock',
      workflowType: 'STOCK_OUT_OF_STOCK',
    };
  }
  return {
    title: 'Needs purchase',
    body: `${part.description} (${part.spc_id}) needs purchase — available ${part.available}, minimum ${part.minimum_stock}.`,
    notificationType: 'stock_needs_purchase',
    workflowType: 'STOCK_NEEDS_PURCHASE',
  };
}

async function sendStockPush({ userId, title, body, notifyId, part, notificationType }) {
  try {
    await ensurePushPreference(getDb(), userId, notificationType);
    const result = await fcmService.sendNotificationToUser({
      userId,
      title,
      body,
      data: {
        notify_id: notifyId,
        spc_id: part.spc_id,
        alert_status: part.alert_status,
        notification_type: notificationType,
        type: notificationType,
        route: '/reports/purchase-requirement',
      },
      notificationType,
    });
    if (!result.success) {
      console.log(
        `[StockNotify] Push skipped for ${userId}: ${result.reason || 'unknown'}`,
      );
    }
  } catch (err) {
    console.warn(`[StockNotify] Push failed for ${userId}: ${err.message}`);
  }
}

/**
 * Create notifications for newly alerted parts; resolve ones no longer alerted.
 * One inbox row per part+status (not per user). Push is sent once per recipient
 * only when the inbox row is newly created.
 */
async function ensureStockStatusNotificationsForOrg({ orgId }) {
  if (!orgId) return { scanned: 0, created: 0, resolved: 0 };
  const db = getDb();
  await ensureStockNotifyTable(db);

  const parts = await listAlertParts(db, orgId);
  const recipients = await getRecipientUsers(db, orgId);

  let created = 0;
  for (const part of parts) {
    const { title, body, notificationType } = buildMessage(part);
    const groupId = `SSN_${orgId}_${part.spc_id}_${part.alert_status}`;

    const existing = await db.query(
      `
        SELECT notify_id
          FROM "${TABLE}"
         WHERE notif_group_id = $1
           AND status = ANY($2::text[])
         ORDER BY created_on ASC
         LIMIT 1
      `,
      [groupId, OPEN_STATUSES],
    );

    if (existing.rows.length) {
      // Keep a single open row for this part/status; close any extras
      await db.query(
        `
          UPDATE "${TABLE}"
             SET status = 'RESOLVED', changed_on = CURRENT_TIMESTAMP
           WHERE notif_group_id = $1
             AND status = ANY($2::text[])
             AND notify_id <> $3
        `,
        [groupId, OPEN_STATUSES, existing.rows[0].notify_id],
      );
      continue;
    }

    const notifyId = makeNotifyId();
    await db.query(
      `
        INSERT INTO "${TABLE}" (
          notify_id, notif_group_id, org_id, spc_id, part_name,
          alert_status, available_qty, minimum_stock, status,
          title, body, emp_int_id, user_id, created_on
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, 'NEW',
          $9, $10, NULL, NULL, CURRENT_TIMESTAMP
        )
      `,
      [
        notifyId,
        groupId,
        orgId,
        part.spc_id,
        part.description,
        part.alert_status,
        part.available,
        part.minimum_stock,
        title,
        body,
      ],
    );
    created += 1;

    for (const recipient of recipients) {
      await sendStockPush({
        userId: recipient.user_id,
        title,
        body,
        notifyId,
        part,
        notificationType,
      });
    }
  }

  // Resolve open alerts that are no longer in an alert state (or status changed)
  const activeKeys = new Set(
    parts.map((p) => `SSN_${orgId}_${p.spc_id}_${p.alert_status}`),
  );
  const openRes = await db.query(
    `
      SELECT notify_id, notif_group_id
        FROM "${TABLE}"
       WHERE org_id = $1
         AND status = ANY($2::text[])
    `,
    [orgId, OPEN_STATUSES],
  );
  let resolved = 0;
  for (const row of openRes.rows) {
    if (activeKeys.has(row.notif_group_id)) continue;
    await db.query(
      `
        UPDATE "${TABLE}"
           SET status = 'RESOLVED', changed_on = CURRENT_TIMESTAMP
         WHERE notify_id = $1
      `,
      [row.notify_id],
    );
    resolved += 1;
  }

  return {
    scanned: parts.length,
    created,
    resolved,
    recipients: recipients.length,
    parts: parts.map((p) => ({
      spc_id: p.spc_id,
      description: p.description,
      alert_status: p.alert_status,
      available: p.available,
      minimum_stock: p.minimum_stock,
    })),
  };
}

async function ensureStockStatusNotificationsForAllOrgs() {
  const db = getDb();
  await ensureStockNotifyTable(db);
  const orgs = await db.query(
    `
      SELECT DISTINCT org_id
        FROM "tblSPCategory"
       WHERE org_id IS NOT NULL
         AND COALESCE(int_status, 1) = 1
    `,
  );
  let created = 0;
  let scanned = 0;
  let resolved = 0;
  const breakdown = [];
  for (const row of orgs.rows) {
    const result = await ensureStockStatusNotificationsForOrg({ orgId: row.org_id });
    breakdown.push({ org_id: row.org_id, ...result });
    created += Number(result.created || 0);
    scanned += Number(result.scanned || 0);
    resolved += Number(result.resolved || 0);
  }
  return { orgs: orgs.rows.length, scanned, created, resolved, org_breakdown: breakdown };
}

async function getStockStatusNotificationsByUser({
  empIntId,
  orgId,
  hasSuperAccess = false,
}) {
  const db = getDb();
  await ensureStockNotifyTable(db);

  // Org-level alerts: one row per part/status. Eligible users see each once.
  const recipients = await getRecipientUsers(db, orgId);
  const isRecipient = recipients.some((r) => r.emp_int_id === empIntId);
  if (!hasSuperAccess && !isRecipient) {
    return [];
  }

  const res = await db.query(
    `
      SELECT DISTINCT ON (n.notif_group_id)
        n.notify_id,
        n.notif_group_id,
        n.org_id,
        n.spc_id,
        n.part_name,
        n.alert_status,
        n.available_qty,
        n.minimum_stock,
        n.status,
        n.title,
        n.body,
        n.emp_int_id,
        n.created_on,
        n.changed_on
      FROM "${TABLE}" n
      WHERE n.org_id = $1
        AND n.status = ANY($2::text[])
      ORDER BY n.notif_group_id, n.created_on ASC
    `,
    [orgId, OPEN_STATUSES],
  );
  return res.rows;
}

/**
 * Collapse duplicate open rows so only one remains per notif_group_id.
 */
async function dedupeOpenStockNotifications({ orgId }) {
  const db = getDb();
  await ensureStockNotifyTable(db);
  const result = await db.query(
    `
      WITH ranked AS (
        SELECT notify_id,
               ROW_NUMBER() OVER (
                 PARTITION BY notif_group_id
                 ORDER BY created_on ASC, notify_id ASC
               ) AS rn
          FROM "${TABLE}"
         WHERE org_id = $1
           AND status = ANY($2::text[])
      )
      UPDATE "${TABLE}" t
         SET status = 'RESOLVED', changed_on = CURRENT_TIMESTAMP
        FROM ranked r
       WHERE t.notify_id = r.notify_id
         AND r.rn > 1
      RETURNING t.notify_id
    `,
    [orgId, OPEN_STATUSES],
  );
  return { resolved_duplicates: result.rowCount || 0 };
}

async function markStockNotificationOpen(notifyId, empIntId) {
  const db = getDb();
  await ensureStockNotifyTable(db);
  await db.query(
    `
      UPDATE "${TABLE}"
         SET status = 'OPEN', last_seen_on = CURRENT_TIMESTAMP, changed_on = CURRENT_TIMESTAMP
       WHERE notify_id = $1
         AND (emp_int_id IS NULL OR $2::text IS NULL OR emp_int_id = $2)
    `,
    [notifyId, empIntId || null],
  );
}

async function discardStockNotification(notifyId, empIntId) {
  const db = getDb();
  await ensureStockNotifyTable(db);
  await db.query(
    `
      UPDATE "${TABLE}"
         SET status = 'DISCARDED', changed_on = CURRENT_TIMESTAMP
       WHERE notify_id = $1
         AND (emp_int_id IS NULL OR $2::text IS NULL OR emp_int_id = $2)
    `,
    [notifyId, empIntId || null],
  );
}

module.exports = {
  ensureStockNotifyTable,
  ensureStockStatusNotificationsForOrg,
  ensureStockStatusNotificationsForAllOrgs,
  getStockStatusNotificationsByUser,
  markStockNotificationOpen,
  discardStockNotification,
  dedupeOpenStockNotifications,
  listAlertParts,
  OPEN_STATUSES,
};
