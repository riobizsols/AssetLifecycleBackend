#!/usr/bin/env node

/**
 * Seed on-demand maintenance frequencies for Bannari org asset types.
 *
 * Breakdown Selection loads asset types from GET /asset-types/maint-required,
 * which only returns types with rows in tblATMaintFreq. The EAM import created
 * asset types and assets but not maintenance configuration.
 *
 * Usage:
 *   node scripts/seed-bannari-maintenance-frequencies.js
 *   node scripts/seed-bannari-maintenance-frequencies.js --dry-run
 */

require('dotenv').config();

const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const BANNARI_ORG_PREFIX = 'BAN';
const DEFAULT_MAINT_TYPE_ID = 'MT004'; // Break Down
const MAINTAINED_BY = 'Vendor';

const isDryRun = process.argv.includes('--dry-run');

function databaseNameFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '').split('?')[0] || null;
  } catch {
    return null;
  }
}

async function getNextAtMainFreqId(client) {
  const result = await client.query(`
    SELECT at_main_freq_id
      FROM "tblATMaintFreq"
     WHERE at_main_freq_id ~ '^ATMF[0-9]+$'
     ORDER BY CAST(SUBSTRING(at_main_freq_id FROM 5) AS INTEGER) DESC
     LIMIT 1
  `);
  if (!result.rows.length) return 'ATMF001';
  const last = parseInt(result.rows[0].at_main_freq_id.slice(4), 10);
  return `ATMF${String(last + 1).padStart(3, '0')}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const dbName = databaseNameFromUrl(connectionString);
  if (dbName !== TARGET_DATABASE) {
    throw new Error(
      `Refusing to run: expected database ${TARGET_DATABASE}, got ${dbName || 'unknown'}`,
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const maintTypeCheck = await client.query(
      `SELECT 1 FROM "tblMaintTypes" WHERE maint_type_id = $1 LIMIT 1`,
      [DEFAULT_MAINT_TYPE_ID],
    );
    if (!maintTypeCheck.rows.length) {
      throw new Error(`Maintenance type ${DEFAULT_MAINT_TYPE_ID} not found in tblMaintTypes`);
    }

    const assetTypes = await client.query(
      `
        SELECT at.org_id, at.asset_type_id, at.text
          FROM "tblAssetTypes" at
         WHERE at.org_id LIKE $1
           AND at.int_status = 1
           AND NOT EXISTS (
             SELECT 1
               FROM "tblATMaintFreq" mf
              WHERE mf.asset_type_id = at.asset_type_id
                AND mf.org_id = at.org_id
           )
         ORDER BY at.org_id, at.text
      `,
      [`${BANNARI_ORG_PREFIX}%`],
    );

    if (!assetTypes.rows.length) {
      console.log('No Bannari asset types need maintenance frequency seeding.');
      return;
    }

    console.log(
      `${isDryRun ? '[dry-run] Would seed' : 'Seeding'} ${assetTypes.rows.length} maintenance frequency row(s)...`,
    );

    if (isDryRun) {
      for (const row of assetTypes.rows) {
        console.log(`  ${row.org_id} / ${row.asset_type_id} — ${row.text}`);
      }
      return;
    }

    await client.query('BEGIN');
    let nextId = await getNextAtMainFreqId(client);
    let inserted = 0;

    for (const row of assetTypes.rows) {
      await client.query(
        `
          INSERT INTO "tblATMaintFreq" (
            at_main_freq_id,
            asset_type_id,
            frequency,
            uom,
            text,
            maintained_by,
            maint_type_id,
            int_status,
            org_id,
            is_recurring,
            emp_int_id
          ) VALUES ($1, $2, NULL, NULL, $3, $4, $5, 1, $6, false, NULL)
        `,
        [
          nextId,
          row.asset_type_id,
          'On Demand',
          MAINTAINED_BY,
          DEFAULT_MAINT_TYPE_ID,
          row.org_id,
        ],
      );
      inserted += 1;
      const numeric = parseInt(nextId.slice(4), 10) + 1;
      nextId = `ATMF${String(numeric).padStart(3, '0')}`;
    }

    await client.query('COMMIT');
    console.log(`Inserted ${inserted} maintenance frequency row(s) for Bannari orgs.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
