/**
 * Migration: Create tblUtilConsumption (utility usage records)
 *
 * Technician / person-in-charge records meter readings or direct quantities.
 * Meter quantity is derived via utils/utilityConsumptionLogic.js (999 / 9999 rollover).
 *
 * Run:
 *   node migrations/create-tblUtilConsumption.js
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
    console.log('Ensuring "tblUtilConsumption"...');
    await ensureUtilityHSchema(client);

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblUtilConsumption'
      ORDER BY ordinal_position
    `);
    console.log('✅ tblUtilConsumption ready. Columns:');
    cols.rows.forEach((r) => {
      console.log(`   - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`);
    });
  } catch (err) {
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
