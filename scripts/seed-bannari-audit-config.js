#!/usr/bin/env node
/**
 * Copy audit log config from BAN002 to all other Bannari orgs.
 * Usage: node scripts/seed-bannari-audit-config.js
 */
require('dotenv').config();
const { Client } = require('pg');

const SOURCE_ORG = 'BAN002';
const TARGET_ORGS = ['BAN001', 'BAN003', 'BAN004', 'BAN005'];

async function nextAlcId(client) {
  const { rows } = await client.query(`
    SELECT alc_id FROM "tblAuditLogConfig"
    WHERE alc_id ~ '^ALC[0-9]+$'
    ORDER BY CAST(SUBSTRING(alc_id FROM 4) AS INTEGER) DESC
    LIMIT 1
  `);
  const n = rows.length ? parseInt(rows[0].alc_id.slice(3), 10) + 1 : 1;
  return `ALC${String(n).padStart(3, '0')}`;
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const source = await client.query(
    `SELECT app_id, event_id, enabled, reporting_required, reporting_email, description
     FROM "tblAuditLogConfig" WHERE org_id = $1 ORDER BY app_id, event_id`,
    [SOURCE_ORG],
  );
  if (!source.rows.length) {
    console.error(`No audit config found for ${SOURCE_ORG}`);
    process.exit(1);
  }

  for (const orgId of TARGET_ORGS) {
    const existing = await client.query(
      `SELECT COUNT(*)::int AS c FROM "tblAuditLogConfig" WHERE org_id = $1`,
      [orgId],
    );
    if (existing.rows[0].c > 0) {
      console.log(`${orgId}: already has ${existing.rows[0].c} config rows — skipped`);
      continue;
    }

    let inserted = 0;
    for (const row of source.rows) {
      const alcId = await nextAlcId(client);
      await client.query(
        `INSERT INTO "tblAuditLogConfig"
          (alc_id, app_id, event_id, enabled, reporting_required, reporting_email, description, org_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          alcId,
          row.app_id,
          row.event_id,
          row.enabled,
          row.reporting_required,
          row.reporting_email,
          row.description,
          orgId,
        ],
      );
      inserted += 1;
    }
    console.log(`${orgId}: inserted ${inserted} audit config rows`);
  }

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
