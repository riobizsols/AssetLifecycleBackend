/**
 * Migration: tblCbmReadingLog - one row per condition rule check (at the rule's check frequency),
 * kept for 3 days. Rows older than that are pruned by the CBM evaluator.
 *
 * Idempotent. Run:
 *   node migrations/create-cbm-reading-log.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const { STATEMENTS } = require('../models/cbmReadingLogSchema');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of STATEMENTS) await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ tblCbmReadingLog ensured');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
