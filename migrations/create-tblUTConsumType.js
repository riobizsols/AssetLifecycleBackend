/**
 * Migration: Create tblUTConsumType (Utility Consumption Type)
 *
 * System lookup — no UI.
 *   UTCTP001 = meter     (readings: Electricity, Water, Oxygen)
 *   UTCTP002 = quantity  (measurable: Diesel, Cylinders)
 *
 * Run:
 *   node migrations/create-tblUTConsumType.js
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
    console.log('Ensuring "tblUTConsumType" (and tblUtility_H if needed)...');
    await ensureUtilityHSchema(client);
    await client.query('COMMIT');

    const rows = await client.query(`
      SELECT utctp_id, consumption_type
      FROM "tblUTConsumType"
      ORDER BY utctp_id
    `);
    console.log('✅ tblUTConsumType ready:');
    rows.rows.forEach((r) => console.log(`   - ${r.utctp_id} → ${r.consumption_type}`));
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
