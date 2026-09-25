require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const p = new Pool({ connectionString: tenantUrl('ngp_db'), ssl: false });
  try {
    const byStatus = await p.query(`
      SELECT status, alert_status, COUNT(*)::int AS c
        FROM "tblStockStatusNotify"
       WHERE org_id = 'ORG003'
       GROUP BY 1, 2
       ORDER BY 1, 2
    `);
    console.log('By status:', byStatus.rows);

    const open = await p.query(`
      SELECT notify_id, part_name, alert_status, emp_int_id, status, created_on
        FROM "tblStockStatusNotify"
       WHERE org_id = 'ORG003'
         AND status = ANY(ARRAY['NEW','OPEN','UNREAD','SNOOZED'])
       ORDER BY part_name, created_on
    `);
    console.log('Open rows:', open.rows.length);
    console.log(open.rows);

    // Force resolve all but earliest per group
    const dedupe = await p.query(`
      WITH ranked AS (
        SELECT notify_id,
               ROW_NUMBER() OVER (
                 PARTITION BY notif_group_id
                 ORDER BY created_on ASC, notify_id ASC
               ) AS rn
          FROM "tblStockStatusNotify"
         WHERE org_id = 'ORG003'
           AND status = ANY(ARRAY['NEW','OPEN','UNREAD','SNOOZED'])
      )
      UPDATE "tblStockStatusNotify" t
         SET status = 'RESOLVED', changed_on = CURRENT_TIMESTAMP
        FROM ranked r
       WHERE t.notify_id = r.notify_id
         AND r.rn > 1
      RETURNING t.notify_id
    `);
    console.log('Force resolved extras:', dedupe.rowCount);

    const openAfter = await p.query(`
      SELECT notify_id, part_name, alert_status, status
        FROM "tblStockStatusNotify"
       WHERE org_id = 'ORG003'
         AND status = ANY(ARRAY['NEW','OPEN','UNREAD','SNOOZED'])
       ORDER BY part_name
    `);
    console.log('Open after:', openAfter.rows);
  } finally {
    await p.end();
  }
})();
