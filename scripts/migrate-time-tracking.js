const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runMigration() {
  const migrations = [
    `ALTER TABLE "tblMaintTypes" ADD COLUMN IF NOT EXISTS "hours_required" DECIMAL(10,2);`,
    `ALTER TABLE "tblAssetMaintSch" ADD COLUMN IF NOT EXISTS "hours_spent" DECIMAL(10,2);`,
    `ALTER TABLE "tblAssetMaintSch" ADD COLUMN IF NOT EXISTS "maint_notes" TEXT;`
  ];
  
  console.log('--- Running Time Tracking & Variance Reporting Migrations ---');
  
  for (const sql of migrations) {
    try {
      console.log(`Executing: ${sql}`);
      await pool.query(sql);
      console.log('✅ Success');
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }
  
  await pool.end();
  console.log('\nMigration completed.');
}

runMigration();
