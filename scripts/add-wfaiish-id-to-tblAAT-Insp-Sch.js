#!/usr/bin/env node

/**
 * Hospitality DB fix:
 * tblAAT_Insp_Sch historically used `wfaiis_id` (older name) instead of `wfaiish_id`.
 * The approval flow inserts `wfaiish_id`, so we add the column and backfill from `wfaiis_id`.
 *
 * Uses DATABASE_URL from .env.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set in .env.');
  process.exit(1);
}

async function columnExists(client, columnName) {
  const res = await client.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblAAT_Insp_Sch'
      AND column_name = $1
    LIMIT 1
    `,
    [columnName]
  );
  return res.rows.length > 0;
}

async function main() {
  const pool = new Pool({ connectionString, ssl: false });
  const client = await pool.connect();
  try {
    const hasNew = await columnExists(client, 'wfaiish_id');
    if (!hasNew) {
      console.log('📝 Adding column wfaiish_id VARCHAR(20) to tblAAT_Insp_Sch...');
      await client.query(`
        ALTER TABLE "tblAAT_Insp_Sch"
        ADD COLUMN wfaiish_id VARCHAR(20)
      `);
      console.log('✅ Column wfaiish_id added.');
    } else {
      console.log('✅ Column wfaiish_id already exists.');
    }

    const hasOld = await columnExists(client, 'wfaiis_id');
    if (hasOld) {
      console.log('🔄 Backfilling wfaiish_id from wfaiis_id where missing...');
      const upd = await client.query(`
        UPDATE "tblAAT_Insp_Sch"
        SET wfaiish_id = wfaiis_id
        WHERE (wfaiish_id IS NULL OR wfaiish_id = '')
          AND (wfaiis_id IS NOT NULL AND wfaiis_id <> '')
      `);
      console.log(`✅ Backfilled ${upd.rowCount} rows.`);
    } else {
      console.log('ℹ️ No wfaiis_id column found; skipping backfill.');
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

