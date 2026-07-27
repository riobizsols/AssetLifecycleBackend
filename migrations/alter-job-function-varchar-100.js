/**
 * Migration: Increase tblJobRoles.job_function from varchar(50) to varchar(100)
 *
 * Run:
 *   node migrations/alter-job-function-varchar-100.js
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

    console.log('Altering tblJobRoles.job_function to character varying(100)...');
    await client.query(`
      ALTER TABLE "tblJobRoles"
      ALTER COLUMN job_function TYPE character varying(100);
    `);

    await client.query('COMMIT');
    console.log('✅ tblJobRoles.job_function updated to varchar(100) successfully.');
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
