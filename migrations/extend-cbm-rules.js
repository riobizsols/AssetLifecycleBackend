/**
 * Migration: extend tblCbm with rule definition and evaluation state.
 *
 *   operator, value1, value2   - condition (value2 used by BETWEEN / OUTSIDE)
 *   action_type                - MAINT (CBM Maintenance) or INSP (Inspection)
 *   last_value, last_evaluated_on, is_met,
 *   last_triggered_on, last_trigger_ref (ams_id / ais_id created)
 *
 * Idempotent. Run:
 *   node migrations/extend-cbm-rules.js
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

const COLUMNS = [
  'operator VARCHAR(20)',
  'value1 VARCHAR(100)',
  'value2 VARCHAR(100)',
  'action_type VARCHAR(10)',
  'last_value VARCHAR(100)',
  'last_evaluated_on TIMESTAMP',
  'is_met BOOLEAN DEFAULT false',
  'last_triggered_on TIMESTAMP',
  'last_trigger_ref VARCHAR(30)',
];

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const col of COLUMNS) {
      await client.query(`ALTER TABLE "tblCbm" ADD COLUMN IF NOT EXISTS ${col}`);
    }
    await client.query('COMMIT');
    console.log('✅ tblCbm columns ensured:', COLUMNS.map((c) => c.split(' ')[0]).join(', '));
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
