/**
 * Migration: Add ais_id to tblAAT_Insp_Rec for schedule-scoped answer upserts.
 *
 * Why: aatisch_id has FK → tblAAT_Insp_Freq.aatif_id, so answers cannot be keyed
 * solely by schedule id in that column. Nullable ais_id enables (ais_id, insp_check_id)
 * uniqueness without breaking the existing FK or online clients.
 *
 * Run:
 *   node migrations/add-ais-id-to-tblAAT_Insp_Rec.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureInspRecAisIdSchema } = require('../utils/ensureInspRecAisIdSchema');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    console.log('Ensuring tblAAT_Insp_Rec.ais_id...');
    const result = await ensureInspRecAisIdSchema(pool);
    console.log('✅ Result:', result);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
