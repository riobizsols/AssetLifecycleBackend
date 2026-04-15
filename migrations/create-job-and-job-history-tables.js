/**
 * Migration: Create tblJobs and tblJobHistory
 *
 * Run:
 *   node migrations/create-job-and-job-history-tables.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating tblJobs (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblJobs" (
        job_id         VARCHAR(50) PRIMARY KEY,
        job_name       VARCHAR(255) NOT NULL,
        frequency      VARCHAR(100),
        status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        file_path      TEXT,
        created_on     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by     VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
        changed_on     TIMESTAMPTZ,
        changed_by     VARCHAR(100)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblJobs_status
      ON "tblJobs" (status);
    `);

    console.log('Creating tblJobHistory (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblJobHistory" (
        jh_id                 VARCHAR(50) PRIMARY KEY,
        job_id                VARCHAR(50) NOT NULL,
        execution_timestamp   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        executed_by           VARCHAR(100) NOT NULL,
        duration_ms           BIGINT NOT NULL DEFAULT 0,
        is_error              BOOLEAN NOT NULL DEFAULT FALSE,
        output_json           JSONB,
        CONSTRAINT fk_tblJobHistory_job_id
          FOREIGN KEY (job_id)
          REFERENCES "tblJobs" (job_id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblJobHistory_job_id
      ON "tblJobHistory" (job_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblJobHistory_execution_timestamp
      ON "tblJobHistory" (execution_timestamp DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblJobHistory_is_error
      ON "tblJobHistory" (is_error);
    `);

    await client.query('COMMIT');
    console.log('✅ tblJobs and tblJobHistory created/verified successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
