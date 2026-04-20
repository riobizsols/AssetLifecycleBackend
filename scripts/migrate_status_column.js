const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function migrateStatus() {
  try {
    console.log('Altering tblAssetBRDet status column...');
    await pool.query(`ALTER TABLE "tblAssetBRDet" ALTER COLUMN status TYPE varchar(20)`);
    console.log('✅ Successfully altered status column to varchar(20)');
  } catch (err) {
    console.error('Error during migration:', err.message);
  } finally {
    await pool.end();
  }
}

migrateStatus();
