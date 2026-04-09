require('dotenv').config();
const db = require('../config/db');

async function run() {
  try {
    console.log('Starting migration: make tblWFAssetMaintSch_H.asset_id nullable...');

    await db.query('BEGIN');

    await db.query(`
      ALTER TABLE "tblWFAssetMaintSch_H"
      ALTER COLUMN asset_id DROP NOT NULL
    `);
    console.log('Updated: tblWFAssetMaintSch_H.asset_id is now nullable');

    await db.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (db && typeof db.end === 'function') {
      await db.end();
    }
  }
}

run();
