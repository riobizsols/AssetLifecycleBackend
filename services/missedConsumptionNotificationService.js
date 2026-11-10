const { getDbFromContext, runWithDb } = require('../utils/dbContext');
const fcmService = require('./fcmService');
const {
  getConsumptionMissNotificationsByUser,
} = require('../models/utilityModel');

const getDb = () => getDbFromContext();

/**
 * Resolve employees who should receive missed-consumption alerts for this tenant DB:
 * - direct asset assignees (employee_int_id)
 * - employees/users belonging to departments that hold utility-mapped assets
 */
async function listMissAssignees(orgId = null) {
  const dbPool = getDb();
  const { rows } = await dbPool.query(
    `
      WITH util_assets AS (
        SELECT DISTINCT
          a.org_id,
          aa.employee_int_id,
          aa.dept_id
        FROM "tblAssetAssignments" aa
        INNER JOIN "tblAssets" a ON a.asset_id = aa.asset_id
        INNER JOIN "tblATUtilityMap" m ON m.assettype_id = a.asset_type_id
        WHERE aa.action = 'A'
          AND aa.latest_assignment_flag = true
          AND COALESCE(a.current_status, '') <> 'SCRAPPED'
          AND ($1::text IS NULL OR a.org_id = $1)
      ),
      direct AS (
        SELECT DISTINCT employee_int_id AS emp_int_id, org_id
        FROM util_assets
        WHERE employee_int_id IS NOT NULL
      ),
      by_dept AS (
        SELECT DISTINCT e.emp_int_id, ua.org_id
        FROM util_assets ua
        INNER JOIN "tblEmployees" e ON e.dept_id = ua.dept_id
        WHERE ua.dept_id IS NOT NULL
          AND NULLIF(BTRIM(e.dept_id), '') IS NOT NULL
          AND e.emp_int_id IS NOT NULL
          AND COALESCE(e.int_status, 1) = 1
        UNION
        SELECT DISTINCT u.emp_int_id, ua.org_id
        FROM util_assets ua
        INNER JOIN "tblUsers" u ON u.dept_id = ua.dept_id
        WHERE ua.dept_id IS NOT NULL
          AND NULLIF(BTRIM(u.dept_id), '') IS NOT NULL
          AND u.emp_int_id IS NOT NULL
          AND COALESCE(u.int_status, 1) = 1
      )
      SELECT DISTINCT emp_int_id, org_id
      FROM (
        SELECT * FROM direct
        UNION
        SELECT * FROM by_dept
      ) x
      WHERE emp_int_id IS NOT NULL
    `,
    [orgId || null],
  );
  return rows;
}

/**
 * Daily scan for one tenant DB context:
 * for each assignee with overdue utility readings, push an FCM alert.
 * Dashboard/list alerts are computed live in getConsumptionMissNotificationsByUser.
 */
async function runScanAndNotifyForCurrentDb({ orgId = null, dryRun = false } = {}) {
  const dbPool = getDb();
  const assignees = await listMissAssignees(orgId);

  let notified = 0;
  let scanned = 0;

  for (const assignee of assignees) {
    try {
      const misses = await getConsumptionMissNotificationsByUser({
        empIntId: assignee.emp_int_id,
        orgId: assignee.org_id || orgId || null,
      });
      scanned += misses.length;
      if (!misses.length) continue;

      const userRes = await dbPool.query(
        `
          SELECT u.user_id, u.full_name
          FROM "tblUsers" u
          WHERE u.emp_int_id = $1
            AND COALESCE(u.int_status, 1) = 1
          LIMIT 1
        `,
        [assignee.emp_int_id],
      );
      if (!userRes.rows.length) continue;
      const user = userRes.rows[0];

      for (const miss of misses) {
        if (dryRun) {
          notified += 1;
          continue;
        }
        try {
          await fcmService.sendNotificationToUser({
            userId: user.user_id,
            title: miss.title || 'Consumption Miss Alert',
            body: miss.body,
            data: {
              notification_type: 'consumption_missed',
              workflow_type: 'CONSUMPTION_MISS',
              asset_id: miss.assetId,
              utild_id: miss.utildId,
              route: miss.route || '/utilities/consumption',
            },
            notificationType: 'consumption_missed',
          });
          notified += 1;
        } catch (pushErr) {
          console.error(
            'Missed consumption FCM failed for',
            miss.id,
            pushErr.message || pushErr,
          );
        }
      }
    } catch (err) {
      console.error(
        'Error scanning missed consumption for assignee',
        assignee.emp_int_id,
        err.message || err,
      );
    }
  }

  return {
    success: true,
    assignees: assignees.length,
    missed: scanned,
    notified,
  };
}

/**
 * Multi-tenant cron entry: scan every active registry tenant.
 */
async function runScanAndNotifyAcrossTenants({ dryRun = false } = {}) {
  const { initTenantRegistryPool, getTenantPool } = require('./tenantService');
  const registry = initTenantRegistryPool();
  const tenants = await registry.query(
    `
      SELECT grouped_org_id AS org_id, COALESCE(subdomain, db_name) AS label
      FROM "tenants"
      WHERE is_active = true
      ORDER BY grouped_org_id
    `,
  );

  let assignees = 0;
  let missed = 0;
  let notified = 0;
  const tenantBreakdown = [];

  for (const tenant of tenants.rows) {
    try {
      const pool = await getTenantPool(tenant.org_id);
      const result = await runWithDb(pool, () =>
        runScanAndNotifyForCurrentDb({ dryRun }),
      );
      assignees += Number(result.assignees || 0);
      missed += Number(result.missed || 0);
      notified += Number(result.notified || 0);
      tenantBreakdown.push({
        tenant: tenant.org_id,
        label: tenant.label,
        ...result,
      });
    } catch (error) {
      console.error(
        `[MissedConsumption] Tenant ${tenant.org_id} (${tenant.label}) failed:`,
        error.message,
      );
      tenantBreakdown.push({
        tenant: tenant.org_id,
        label: tenant.label,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    tenants: tenants.rows.length,
    assignees,
    missed,
    notified,
    tenantBreakdown,
  };
}

class MissedConsumptionNotificationService {
  /**
   * Prefer multi-tenant scan from cron. If already inside a tenant DB context
   * (manual trigger / job monitor), scan that tenant only.
   */
  async runScanAndNotify({ orgId = null, dryRun = false, allTenants = true } = {}) {
    const { tryGetDb } = require('../utils/dbContext');
    if (tryGetDb() && !allTenants) {
      return runScanAndNotifyForCurrentDb({ orgId, dryRun });
    }
    if (allTenants) {
      return runScanAndNotifyAcrossTenants({ dryRun });
    }
    return runScanAndNotifyForCurrentDb({ orgId, dryRun });
  }
}

module.exports = new MissedConsumptionNotificationService();
module.exports.runScanAndNotifyForCurrentDb = runScanAndNotifyForCurrentDb;
module.exports.runScanAndNotifyAcrossTenants = runScanAndNotifyAcrossTenants;
module.exports.listMissAssignees = listMissAssignees;
