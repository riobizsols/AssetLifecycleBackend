/**
 * Migration: OPC / Condition Monitoring tables
 *
 *   tblAssetComponents  - components of an asset (CMP)
 *   tblOpcTags          - master list of tag types (TAG)
 *   tblOpcServers       - OPC UA server connection per tenant (OPS)
 *   tblCompTags         - OPC tag on a server mapped to a component + tag type (CT)
 *   tblCbm              - condition-based monitoring rule on a mapped tag (CBM)
 *
 * Idempotent: existing tables are left untouched; missing ones are created.
 *
 * Run:
 *   node migrations/create-opc-condition-monitoring-tables.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const STANDARD_COLUMNS = `
    org_id VARCHAR(20),
    int_status INTEGER DEFAULT 1,
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50),
    changed_on TIMESTAMP`;

const TABLES = [
  {
    name: 'tblAssetComponents',
    sql: `CREATE TABLE IF NOT EXISTS "tblAssetComponents" (
    comp_id VARCHAR(20) PRIMARY KEY,
    asset_id VARCHAR(20) NOT NULL,
    comp_name VARCHAR(100),${STANDARD_COLUMNS},
    CONSTRAINT fk_assetcomponents_asset FOREIGN KEY (asset_id) REFERENCES "tblAssets"(asset_id)
  )`,
  },
  {
    name: 'tblOpcTags',
    sql: `CREATE TABLE IF NOT EXISTS "tblOpcTags" (
    tag_id VARCHAR(20) PRIMARY KEY,
    tag_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(20),
    unit VARCHAR(20),
    tag_type VARCHAR(20),${STANDARD_COLUMNS}
  )`,
  },
  {
    name: 'tblOpcServers',
    sql: `CREATE TABLE IF NOT EXISTS "tblOpcServers" (
    server_id VARCHAR(20) PRIMARY KEY,
    server_name VARCHAR(100),
    endpoint_url VARCHAR(255),
    security_mode VARCHAR(30),
    username VARCHAR(100),
    password_enc TEXT,
    device_key_hash VARCHAR(255),
    last_seen TIMESTAMP,${STANDARD_COLUMNS}
  )`,
  },
  {
    name: 'tblCompTags',
    sql: `CREATE TABLE IF NOT EXISTS "tblCompTags" (
    ct_id VARCHAR(20) PRIMARY KEY,
    server_id VARCHAR(20) NOT NULL,
    comp_id VARCHAR(20) NOT NULL,
    tag_id VARCHAR(20) NOT NULL,
    tag_full_path VARCHAR(255) NOT NULL,${STANDARD_COLUMNS},
    CONSTRAINT fk_comptags_server FOREIGN KEY (server_id) REFERENCES "tblOpcServers"(server_id),
    CONSTRAINT fk_comptags_component FOREIGN KEY (comp_id) REFERENCES "tblAssetComponents"(comp_id),
    CONSTRAINT fk_comptags_tag FOREIGN KEY (tag_id) REFERENCES "tblOpcTags"(tag_id),
    CONSTRAINT uq_comptags_server_path UNIQUE (server_id, tag_full_path)
  )`,
  },
  {
    name: 'tblCbm',
    sql: `CREATE TABLE IF NOT EXISTS "tblCbm" (
    cbm_id VARCHAR(20) PRIMARY KEY,
    asset_id VARCHAR(20) NOT NULL,
    ct_id VARCHAR(20) NOT NULL,
    condition VARCHAR(100),
    check_frequency VARCHAR(30),${STANDARD_COLUMNS},
    CONSTRAINT fk_cbm_asset FOREIGN KEY (asset_id) REFERENCES "tblAssets"(asset_id),
    CONSTRAINT fk_cbm_comptag FOREIGN KEY (ct_id) REFERENCES "tblCompTags"(ct_id)
  )`,
  },
];

const SEQUENCES = [
  { table_key: 'asset_component', prefix: 'CMP' },
  { table_key: 'opc_tag', prefix: 'TAG' },
  { table_key: 'opc_server', prefix: 'OPS' },
  { table_key: 'comp_tag', prefix: 'CT' },
  { table_key: 'cbm', prefix: 'CBM' },
];

async function tableExists(client, name) {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name]
  );
  return res.rows.length > 0;
}

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const table of TABLES) {
      if (await tableExists(client, table.name)) {
        console.log(`• ${table.name} already exists — left unchanged`);
        continue;
      }
      await client.query(table.sql);
      console.log(`✅ Created ${table.name}`);
    }

    for (const seq of SEQUENCES) {
      await client.query(
        `INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
         SELECT $1::varchar, $2::varchar, 0
         WHERE NOT EXISTS (SELECT 1 FROM "tblIDSequences" WHERE table_key = $1::varchar)`,
        [seq.table_key, seq.prefix]
      );
    }
    console.log('✅ ID sequences ensured: CMP, TAG, OPS, CT, CBM');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
