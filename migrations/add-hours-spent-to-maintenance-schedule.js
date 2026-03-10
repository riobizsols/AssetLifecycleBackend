/**
 * Migration: Add hours_spent and maint_notes to tblAssetMaintSch if missing.
 * Required for updateMaintenanceSchedule (supervisor approval / time tracking).
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
    console.log('Adding missing columns to tblAssetMaintSch (if not present)...');

    await client.query(`
      ALTER TABLE "tblAssetMaintSch" 
      ADD COLUMN IF NOT EXISTS "hours_spent" DECIMAL(10,2);
    `);
    console.log('✅ hours_spent: added or already exists');

    await client.query(`
      ALTER TABLE "tblAssetMaintSch" 
      ADD COLUMN IF NOT EXISTS "maint_notes" TEXT;
    `);
    console.log('✅ maint_notes: added or already exists');

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
