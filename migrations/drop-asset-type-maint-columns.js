/**
 * Migration: Remove maint_required and maint_type_id from tblAssetTypes
 *
 * Maintenance configuration now lives in tblATMaintFreq per asset type + maint type.
 *
 * Run:
 *   node migrations/drop-asset-type-maint-columns.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Dropping tblAssetTypes.maint_required (if exists)...');
    await client.query(`
      ALTER TABLE "tblAssetTypes"
      DROP COLUMN IF EXISTS maint_required
    `);

    console.log('Dropping tblAssetTypes.maint_type_id (if exists)...');
    await client.query(`
      ALTER TABLE "tblAssetTypes"
      DROP COLUMN IF EXISTS maint_type_id
    `);

    await client.query('COMMIT');
    console.log('✅ Migration complete: maint_required and maint_type_id removed from tblAssetTypes');
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
