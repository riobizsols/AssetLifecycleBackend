const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runMigration() {
  const migrations = [
    `ALTER TABLE "tblAssetMaintSch" ALTER COLUMN notes TYPE TEXT;`,
    `ALTER TABLE "tblWFAssetMaintSch_D" ALTER COLUMN notes TYPE TEXT;`,
    `ALTER TABLE "tblWFAssetMaintHist" ALTER COLUMN notes TYPE TEXT;`,
    `ALTER TABLE "tblAssets" ALTER COLUMN description TYPE TEXT;`,
    `ALTER TABLE "tblAssetScrapDet" ALTER COLUMN notes TYPE TEXT;`
  ];
  
  console.log('--- Running Schema Migrations ---');
  
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
