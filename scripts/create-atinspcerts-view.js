#!/usr/bin/env node

/**
 * Create a compatibility view `tblATInspCerts` pointing to `tblATInspCert`.
 *
 * This is needed because:
 * - Some code reads from "tblATInspCerts"
 * - Other code (techCertModel, migrations) uses "tblATInspCert"
 *
 * Running this script on the hospitality database (DATABASE_URL) will:
 * - Confirm that "tblATInspCert" exists
 * - Create or replace the view "tblATInspCerts" as SELECT * FROM "tblATInspCert"
 *
 * Usage:
 *   node scripts/create-atinspcerts-view.js
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
    console.log('🔍 Checking for base table "tblATInspCert"...');
    const checkBase = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'tblATInspCert'
      );
    `);

    if (!checkBase.rows[0].exists) {
      console.error('❌ Base table "tblATInspCert" does not exist in this database.');
      process.exit(1);
    }

    console.log('✅ Base table "tblATInspCert" exists.');

    console.log('📝 Creating compatibility view "tblATInspCerts"...');
    await client.query(`
      DROP VIEW IF EXISTS "tblATInspCerts";
      CREATE VIEW "tblATInspCerts" AS
      SELECT * FROM "tblATInspCert";
    `);

    console.log('✅ View "tblATInspCerts" created successfully (SELECT * FROM "tblATInspCert").');
  } catch (err) {
    console.error('❌ Failed to create view "tblATInspCerts":', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

