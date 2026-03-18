#!/usr/bin/env node

/**
 * Add emp_int_id column to tblAssetMaintSch if missing (hospitality DB).
 * Required for maintenance approval flow (createMaintenanceRecord).
 *
 * Uses DATABASE_URL from .env.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set in .env.');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString, ssl: false });
  const client = await pool.connect();
  try {
    const check = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblAssetMaintSch'
        AND column_name = 'emp_int_id'
    `);

    if (check.rows.length) {
      console.log('✅ Column emp_int_id already exists on tblAssetMaintSch.');
      return;
    }

    console.log('📝 Adding column emp_int_id VARCHAR(20) to tblAssetMaintSch...');
    await client.query(`
      ALTER TABLE "tblAssetMaintSch"
      ADD COLUMN emp_int_id VARCHAR(20)
    `);
    console.log('✅ Column emp_int_id added successfully.');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
