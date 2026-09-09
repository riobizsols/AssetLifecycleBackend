/**
 * Seed ~2000 realistic audit logs into hospitality tblAuditLogs.
 * Run: node scripts/seed-hospitality-audit-logs.js [count]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const TARGET_COUNT = parseInt(process.argv[2] || '2000', 10);

const SCENARIOS = [
  { app_id: 'LOGIN', event_id: 'Eve001', text: 'Logging In: User Logged In Successfully' },
  { app_id: 'LOGIN', event_id: 'Eve002', text: 'Logging Out: User Logged Out Successfully' },
  { app_id: 'ASSETTYPES', event_id: 'Eve005', text: 'Create: Asset Type Created' },
  { app_id: 'ASSETTYPES', event_id: 'Eve008', text: 'Update: Asset Type Updated' },
  { app_id: 'ASSETTYPES', event_id: 'Eve006', text: 'Delete: Asset Type Deleted' },
  { app_id: 'ASSETS', event_id: 'Eve005', text: 'Create: Asset Created' },
  { app_id: 'ASSETS', event_id: 'Eve008', text: 'Update: Asset Updated' },
  { app_id: 'ASSETS', event_id: 'Eve006', text: 'Delete: Asset Deleted' },
  { app_id: 'BULKUPLOAD', event_id: 'Eve005', text: 'Create: Bulk Upload Completed' },
  { app_id: 'BULKUPLOAD', event_id: 'Eve007', text: 'Download: Sample CSV Downloaded' },
  { app_id: 'VENDORS', event_id: 'Eve005', text: 'Create: Vendor Created' },
  { app_id: 'VENDORS', event_id: 'Eve008', text: 'Update: Vendor Updated' },
  { app_id: 'USERS', event_id: 'Eve005', text: 'Create: User Created' },
  { app_id: 'USERS', event_id: 'Eve008', text: 'Update: User Updated' },
  { app_id: 'EMPLOYEES', event_id: 'Eve005', text: 'Create: Employee Created' },
  { app_id: 'EMPLOYEES', event_id: 'Eve008', text: 'Update: Employee Updated' },
  { app_id: 'BRANCHES', event_id: 'Eve005', text: 'Create: Branch Created' },
  { app_id: 'DEPARTMENTS', event_id: 'Eve005', text: 'Create: Department Created' },
  { app_id: 'DEPTASSIGNMENT', event_id: 'Eve012', text: 'Assign: Asset Assigned to Department' },
  { app_id: 'DEPTASSIGNMENT', event_id: 'Eve013', text: 'Unassign: Asset Unassigned from Department' },
  { app_id: 'MAINTENANCESCHEDULE', event_id: 'Eve005', text: 'Create: Maintenance Schedule Created' },
  { app_id: 'MAINTENANCEAPPROVAL', event_id: 'Eve008', text: 'Update: Maintenance Approved' },
  { app_id: 'REPORTBREAKDOWN', event_id: 'Eve005', text: 'Create: Breakdown Reported' },
  { app_id: 'AUDITLOGS', event_id: 'Eve004', text: 'History: Audit Logs Viewed' },
  { app_id: 'AUDITLOGCONFIG', event_id: 'Eve008', text: 'Update: Audit Log Config Updated' },
  { app_id: 'ORGANIZATIONS', event_id: 'Eve008', text: 'Update: Organization Updated' },
  { app_id: 'PRODSERV', event_id: 'Eve005', text: 'Create: Product/Service Created' },
  { app_id: 'WORKORDERMANAGEMENT', event_id: 'Eve005', text: 'Create: Work Order Created' },
  { app_id: 'WORKORDERMANAGEMENT', event_id: 'Eve008', text: 'Update: Work Order Updated' },
];

function nextAlId(n) {
  return `AL${String(n).padStart(n > 999 ? 4 : 3, '0')}`;
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const users = await client.query(`
      SELECT user_id FROM "tblUsers" WHERE int_status = 1 ORDER BY user_id
    `);
    if (!users.rows.length) {
      throw new Error('No active users found');
    }

    const apps = await client.query(`SELECT app_id FROM "tblApps"`);
    const events = await client.query(`SELECT event_id FROM "tblEvents"`);
    const appSet = new Set(apps.rows.map((r) => r.app_id));
    const eventSet = new Set(events.rows.map((r) => r.event_id));

    const scenarios = SCENARIOS.filter(
      (s) => appSet.has(s.app_id) && eventSet.has(s.event_id)
    );
    if (!scenarios.length) {
      throw new Error('No valid app/event scenarios after filtering against DB');
    }
    console.log(`Using ${scenarios.length} scenarios, ${users.rows.length} users`);

    const orgRes = await client.query(`
      SELECT org_id FROM "tblOrgs" WHERE org_id = 'ORG001'
      UNION ALL
      SELECT org_id FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1
    `);
    const orgId = orgRes.rows[0]?.org_id;
    if (!orgId) throw new Error('No org_id found');

    const maxRes = await client.query(`
      SELECT COALESCE(MAX(
        CASE
          WHEN al_id ~ '^AL[0-9]+$' THEN CAST(SUBSTRING(al_id FROM 3) AS INTEGER)
          ELSE 0
        END
      ), 0)::int AS max_n
      FROM "tblAuditLogs"
    `);
    let nextNum = maxRes.rows[0].max_n + 1;
    const before = await client.query('SELECT COUNT(*)::int AS n FROM "tblAuditLogs"');
    console.log(`Existing logs: ${before.rows[0].n}, starting at ${nextAlId(nextNum)}`);

    const now = Date.now();
    const BATCH = 200;
    let inserted = 0;

    await client.query('BEGIN');

    for (let i = 0; i < TARGET_COUNT; i += BATCH) {
      const batchSize = Math.min(BATCH, TARGET_COUNT - i);
      const values = [];
      const params = [];
      let p = 1;

      for (let j = 0; j < batchSize; j++) {
        const scenario = scenarios[(i + j) % scenarios.length];
        const user = users.rows[(i + j) % users.rows.length];
        const alId = nextAlId(nextNum++);
        // Spread over last ~90 days
        const createdOn = new Date(now - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000));
        const text = scenario.text.length > 100
          ? `${scenario.text.slice(0, 97)}...`
          : scenario.text;

        values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(
          alId,
          user.user_id,
          scenario.app_id,
          scenario.event_id,
          text,
          createdOn.toISOString(),
          orgId
        );
      }

      await client.query(
        `
        INSERT INTO "tblAuditLogs" (
          al_id, user_id, app_id, event_id, text, created_on, org_id
        ) VALUES ${values.join(',')}
        `,
        params
      );
      inserted += batchSize;
      if (inserted % 400 === 0 || inserted === TARGET_COUNT) {
        console.log(`Inserted ${inserted}/${TARGET_COUNT}`);
      }
    }

    await client.query('COMMIT');

    const after = await client.query('SELECT COUNT(*)::int AS n FROM "tblAuditLogs"');
    console.log(`Done. Total audit logs now: ${after.rows[0].n} (added ${after.rows[0].n - before.rows[0].n})`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
