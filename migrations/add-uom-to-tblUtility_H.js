/**
 * Migration: Add uom_id to tblUtility_H and seed utility UOMs into tblUom.
 *
 * When a utility is created, its unit of measure is set via tblUom (uom_id FK).
 *
 * Run:
 *   node migrations/add-uom-to-tblUtility_H.js
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
    console.log('Ensuring tblUtility_H.uom_id + utility UOMs in tblUom...');
    await ensureUtilityHSchema(client);
    await client.query('COMMIT');

    const cols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblUtility_H'
      ORDER BY ordinal_position
    `);
    console.log('✅ tblUtility_H columns:', cols.rows.map((r) => r.column_name).join(', '));

    const uoms = await client.query(`
      SELECT uom_id, uom FROM "tblUom"
      WHERE uom_id >= 'UOM007'
      ORDER BY uom_id
    `);
    console.log('✅ Utility UOMs:');
    uoms.rows.forEach((r) => console.log(`   - ${r.uom_id} → ${r.uom}`));
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
