/**
 * Migration: Add esc_no_days (Number of Escalation Days) to tblWFSteps.
 * Defines the maximum number of days within which approval must be completed at each workflow step.
 * If exceeded, the system auto-escalates to the next approver per tblWFATSeqs and notifies job roles in tblWFJobRole.
 */
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Adding esc_no_days to tblWFSteps (if not present)...');

    await client.query(`
      ALTER TABLE "tblWFSteps"
      ADD COLUMN IF NOT EXISTS "esc_no_days" INTEGER NULL;
    `);
    console.log('✅ esc_no_days: added or already exists');

    await client.query(`
      COMMENT ON COLUMN "tblWFSteps".esc_no_days IS
      'Maximum number of days within which approval must be completed at this workflow step. If exceeded, workflow is escalated to next approver (tblWFATSeqs) and notification sent to job roles in tblWFJobRole.';
    `).catch(() => {});
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
