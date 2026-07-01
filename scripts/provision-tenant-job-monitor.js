#!/usr/bin/env node
/**
 * Create tblJobs / tblJobHistory on a tenant database and seed default jobs.
 * Usage: node scripts/provision-tenant-job-monitor.js [database_name]
 * Default database: skasc_db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const dbName = process.argv[2] || 'skasc_db';
const base = process.env.TENANT_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
const pool = new Pool({ connectionString: base, ssl: false });

const DEFAULT_JOBS = [
  ['JOB001', 'maintenance trigger', '0 0 * * *', 'DISABLED', 'services/cronService.triggerMaintenanceGeneration'],
  ['JOB002', 'Inspection', '0 1 * * *', 'DISABLED', 'services/cronService.triggerInspection'],
  ['JOB003', 'Vendor contract renewal', '0 8 * * *', 'DISABLED', 'cron/vendorContractRenewalCron'],
  ['JOB004', 'scrap seq setting', 'manual', 'DISABLED', 'cron/wfScrapSeqBackfillCron'],
  ['JOB005', 'maint seq setting', 'manual', 'DISABLED', 'cron/wfAtSeqBackfillCron'],
  ['JOB006', 'warranty notification trigger', '0 7 * * *', 'DISABLED', 'cron/warrantyNotificationTrigger'],
  ['JOB007', 'asset expiry notification trigger', '0 7 * * *', 'DISABLED', 'cron/assetExpiryNotificationTrigger'],
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblJobs" (
        job_id VARCHAR(50) PRIMARY KEY,
        job_name VARCHAR(255) NOT NULL,
        frequency VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
        file_path TEXT,
        created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
        changed_on TIMESTAMPTZ,
        changed_by VARCHAR(100)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblJobHistory" (
        jh_id VARCHAR(50) PRIMARY KEY,
        job_id VARCHAR(50) NOT NULL REFERENCES "tblJobs"(job_id) ON UPDATE CASCADE ON DELETE CASCADE,
        execution_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        executed_by VARCHAR(100) NOT NULL,
        duration_ms BIGINT NOT NULL DEFAULT 0,
        is_error BOOLEAN NOT NULL DEFAULT FALSE,
        output_json JSONB
      );
    `);
    for (const row of DEFAULT_JOBS) {
      await client.query(
        `INSERT INTO "tblJobs" (job_id, job_name, frequency, status, file_path, created_by)
         VALUES ($1, $2, $3, $4, $5, 'SYSTEM')
         ON CONFLICT (job_id) DO NOTHING`,
        row
      );
    }
    await client.query('COMMIT');
    const { rows } = await client.query('SELECT COUNT(*)::int AS c FROM "tblJobs"');
    console.log(`Provisioned job monitor on ${dbName}: ${rows[0].c} jobs`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
