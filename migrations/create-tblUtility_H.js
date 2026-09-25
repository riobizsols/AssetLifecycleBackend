/**
 * Migration: Create tblUtility_H (Utility Header)
 *
 * Master list of utilities consumed by assets.
 * Includes uom_id → tblUom for unit of measure.
 *
 * Run:
 *   node migrations/create-tblUtility_H.js
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
    console.log('Ensuring "tblUtility_H" (with uom_id)...');
    await ensureUtilityHSchema(client);
    await client.query('COMMIT');

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblUtility_H'
      ORDER BY ordinal_position
    `);
    console.log('✅ tblUtility_H ready. Columns:');
    cols.rows.forEach((r) => {
      console.log(`   - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`);
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
