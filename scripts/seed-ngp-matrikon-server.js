#!/usr/bin/env node
/**
 * Seed the NGP (ORG003) Matrikon test server into tblOpcServers as OPS001.
 * Skips if the row already exists.
 *
 * Usage: node scripts/seed-ngp-matrikon-server.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const SERVER = {
  server_id: 'OPS001',
  server_name: 'NGP CSE Lab - Matrikon',
  endpoint_url: 'Matrikon.OPC.Simulation.1',
  security_mode: 'None',
  org_id: 'ORG003',
};

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const exists = await client.query(
      `SELECT server_id FROM "tblOpcServers" WHERE server_id = $1`,
      [SERVER.server_id]
    );
    if (exists.rows.length) {
      console.log(`= ${SERVER.server_id} already exists`);
    } else {
      await client.query(
        `INSERT INTO "tblOpcServers"
           (server_id, server_name, endpoint_url, security_mode, org_id, int_status, created_by, created_on, changed_by, changed_on)
         VALUES ($1, $2, $3, $4, $5, 1, 'USR001', NOW(), 'USR001', NOW())`,
        [SERVER.server_id, SERVER.server_name, SERVER.endpoint_url, SERVER.security_mode, SERVER.org_id]
      );
      console.log(`+ ${SERVER.server_id} ${SERVER.server_name}`);
    }

    await client.query(
      `UPDATE "tblIDSequences" SET last_number = GREATEST(last_number, 1) WHERE table_key = 'opc_server'`
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
