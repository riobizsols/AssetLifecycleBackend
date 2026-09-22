/**
 * Migration: Create tblUtilFreq (Utility measurement frequency)
 *
 * System lookup — no UI. Fixed presets; OnActualUsage (uf005) means
 * the user enters usage when recording (not a schedule interval).
 *
 * Run:
 *   node migrations/create-tblUtilFreq.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { ensureUtilityHSchema } = require('../utils/ensureUtilityHSchema');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Ensuring "tblUtilFreq"...');
    await ensureUtilityHSchema(client);
    await client.query('COMMIT');

    const rows = await client.query(`
      SELECT utfq_id, freq, description
      FROM "tblUtilFreq"
      ORDER BY utfq_id
    `);
    console.log('✅ tblUtilFreq ready:');
    rows.rows.forEach((r) => {
      console.log(`   - ${r.utfq_id}  freq=${r.freq}  ${r.description}`);
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
