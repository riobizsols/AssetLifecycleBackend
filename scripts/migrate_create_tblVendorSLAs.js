/**
 * Creates "tblVendorSLAs" — one row per vendor, SLA-1 … SLA-10 columns.
 * Safe to run multiple times (IF NOT EXISTS).
 *
 * Usage: node scripts/migrate_create_tblVendorSLAs.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/db');

async function run() {
  let createdOk = false;
  try {
    console.log('Starting migration: create tblVendorSLAs...');

    await db.query('BEGIN');

    await db.query(`
      CREATE TABLE IF NOT EXISTS "tblVendorSLAs" (
        vsla_id VARCHAR(50) NOT NULL,
        vendor_id VARCHAR(50) NOT NULL,
        "SLA-1" TEXT,
        "SLA-2" TEXT,
        "SLA-3" TEXT,
        "SLA-4" TEXT,
        "SLA-5" TEXT,
        "SLA-6" TEXT,
        "SLA-7" TEXT,
        "SLA-8" TEXT,
        "SLA-9" TEXT,
        "SLA-10" TEXT,
        created_by VARCHAR(50),
        created_on TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP WITHOUT TIME ZONE,
        int_status INTEGER DEFAULT 1,
        CONSTRAINT tblVendorSLAs_pkey PRIMARY KEY (vsla_id),
        CONSTRAINT tblVendorSLAs_vendor_id_key UNIQUE (vendor_id)
      )
    `);
    console.log('Table tblVendorSLAs ensured.');

    await db.query('COMMIT');
    createdOk = true;
    console.log('Migration completed successfully.');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  }

  if (createdOk) {
    try {
      await db.query(`
        ALTER TABLE "tblVendorSLAs"
          ADD CONSTRAINT tblVendorSLAs_vendor_id_fkey
          FOREIGN KEY (vendor_id) REFERENCES "tblVendors"(vendor_id)
          ON DELETE CASCADE
      `);
      console.log('FK tblVendorSLAs.vendor_id -> tblVendors added.');
    } catch (e) {
      if (e.code === '42710' || (e.message && e.message.includes('already exists'))) {
        console.log('FK tblVendorSLAs -> tblVendors already present.');
      } else {
        console.warn('Optional FK not added (table still usable):', e.message);
      }
    }
  }

  if (db && typeof db.end === 'function') {
    await db.end();
  }
}

run();
