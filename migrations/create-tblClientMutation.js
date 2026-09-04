/**
 * Migration: Create tblClientMutation for offline idempotent mutation replay.
 *
 * Run:
 *   node migrations/create-tblClientMutation.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureClientMutationSchema } = require('../utils/ensureClientMutationSchema');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  try {
    console.log('Creating tblClientMutation (if not present)...');
    await ensureClientMutationSchema(pool);
    console.log('✅ tblClientMutation created/verified successfully.');
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
