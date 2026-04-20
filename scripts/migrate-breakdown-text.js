const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runMigration() {
  const migrations = [
    `ALTER TABLE "tblAssetBRDet" ALTER COLUMN description TYPE TEXT;`,
    `ALTER TABLE "tblAssetBRDet" ALTER COLUMN reopen_notes TYPE TEXT;`
  ];
  
  console.log('--- Running Additional Schema Migrations (Breakdown) ---');
  
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
