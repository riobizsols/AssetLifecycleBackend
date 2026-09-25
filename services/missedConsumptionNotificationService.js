const { getDbFromContext } = require('../utils/dbContext');
const fcmService = require('./fcmService');
const {
  getConsumptionMissNotificationsByUser,
} = require('../models/utilityModel');

const getDb = () => getDbFromContext();

/**
 * Daily scan: for each assigned employee with overdue utility readings
 * (based on measurement-profile frequency), push an FCM alert.
 * Dashboard/list alerts are computed live in getConsumptionMissNotificationsByUser.
 */
class MissedConsumptionNotificationService {
  async runScanAndNotify({ orgId = null, dryRun = false } = {}) {
    const dbPool = getDb();

    // Distinct assignees that currently hold assets with utility mappings
    const { rows: assignees } = await dbPool.query(
      `
        SELECT DISTINCT aa.employee_int_id, a.org_id
        FROM "tblAssetAssignments" aa
        INNER JOIN "tblAssets" a ON a.asset_id = aa.asset_id
        INNER JOIN "tblATUtilityMap" m ON m.assettype_id = a.asset_type_id
        WHERE aa.action = 'A'
          AND aa.latest_assignment_flag = true
          AND aa.employee_int_id IS NOT NULL
          AND COALESCE(a.current_status, '') <> 'SCRAPPED'
          AND ($1::text IS NULL OR a.org_id = $1)
      `,
      [orgId || null],
    );

    let notified = 0;
    let scanned = 0;

    for (const assignee of assignees) {
      try {
        const misses = await getConsumptionMissNotificationsByUser({
          empIntId: assignee.employee_int_id,
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
          [assignee.employee_int_id],
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
          assignee.employee_int_id,
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
}

module.exports = new MissedConsumptionNotificationService();
