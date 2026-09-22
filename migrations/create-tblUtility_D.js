/**
 * Migration: Create tblUtility_D (Utility Details)
 *
 * Differentiates measurement modes under one utility header
 * (e.g. LPG Kitchen quantity vs LPG tank meter) and maps frequency + UOM.
 * meter_max (999|9999) drives dial rollover when recording meter readings.
 *
 * Run:
 *   node migrations/create-tblUtility_D.js
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
    console.log('Ensuring "tblUtility_D"...');
    await ensureUtilityHSchema(client);

    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblUtility_D'
      ORDER BY ordinal_position
    `);
    console.log('✅ tblUtility_D ready. Columns:');
    cols.rows.forEach((r) => {
      console.log(`   - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`);
    });

    const { calculateMeterConsumption } = require('../utils/utilityConsumptionLogic');
    const samples = [
      { prev: 900, curr: 250, max: 999, expect: 349 },
      { prev: 600, curr: 100, max: 999, expect: 499 },
      { prev: 950, curr: 250, max: 999, expect: 299 },
      { prev: 100, curr: 500, max: 999, expect: 400 },
      { prev: 9800, curr: 30, max: 9999, expect: 229 },
    ];
    console.log('✅ Rollover logic checks:');
    for (const s of samples) {
      const { quantityConsumed, rolledOver } = calculateMeterConsumption({
        previousReading: s.prev,
        currentReading: s.curr,
        meterMax: s.max,
      });
      const ok = quantityConsumed === s.expect;
      console.log(
        `   ${ok ? 'PASS' : 'FAIL'} prev=${s.prev} curr=${s.curr} max=${s.max} → ${quantityConsumed}` +
          `${rolledOver ? ' (rollover)' : ''} (expected ${s.expect})`,
      );
      if (!ok) process.exitCode = 1;
    }
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
