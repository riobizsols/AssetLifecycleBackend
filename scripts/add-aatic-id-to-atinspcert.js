#!/usr/bin/env node

/**
 * Ensure hospitality DB tblATInspCert has aatic_id column
 * so queries on tblATInspCerts. aatic_id work.
 *
 * Uses DATABASE_URL (hospitality) from .env.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set in .env (expected hospitality DB).');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString, ssl: false });
  const client = await pool.connect();
  try {
    console.log('🔍 Checking for aatic_id on tblATInspCert...');
    const res = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblATInspCert'
        AND column_name = 'aatic_id'
      `
    );

    if (res.rows.length) {
      console.log('✅ Column aatic_id already exists on tblATInspCert.');
      return;
    }

    console.log('📝 Adding column aatic_id VARCHAR(20) to tblATInspCert...');
    await client.query(`ALTER TABLE "tblATInspCert" ADD COLUMN aatic_id VARCHAR(20);`);
    console.log('✅ Column aatic_id added successfully.');
  } catch (err) {
    console.error('❌ Failed to add aatic_id to tblATInspCert:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

