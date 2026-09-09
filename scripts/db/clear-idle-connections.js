#!/usr/bin/env node
/**
 * Clear idle PostgreSQL client connections.
 *
 * Usage:
 *   node scripts/db/clear-idle-connections.js
 *   IDLE_MINUTES=30 node scripts/db/clear-idle-connections.js
 *   DRY_RUN=1 node scripts/db/clear-idle-connections.js
 *
 * Env:
 *   DATABASE_URL or GENERIC_URL  — connection string (superuser recommended)
 *   IDLE_MINUTES                 — only kill idle longer than this (default 15)
 *   DRY_RUN                      — if 1, only list targets
 */
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const connectionString =
  process.env.DATABASE_URL ||
  process.env.GENERIC_URL ||
  process.env.TENANT_DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL / GENERIC_URL');
  process.exit(1);
}

const idleMinutes = Math.max(1, parseInt(process.env.IDLE_MINUTES || '15', 10) || 15);
const dryRun = String(process.env.DRY_RUN || '').trim() === '1';

async function main() {
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: false,
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  try {
    const statsBefore = await client.query(`
      SELECT
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'superuser_reserved_connections') AS reserved,
        (SELECT COUNT(*)::int FROM pg_stat_activity) AS used_total,
        (SELECT COUNT(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend') AS clients,
        (SELECT COUNT(*)::int FROM pg_stat_activity
           WHERE backend_type = 'client backend' AND state = 'idle') AS idle_clients
    `);
    const s = statsBefore.rows[0];
    const free = Math.max(0, s.max_connections - s.reserved - s.used_total);
    console.log(
      `[idle-cleanup] max=${s.max_connections} used=${s.used_total} clients=${s.clients} idle=${s.idle_clients} free≈${free}`
    );

    const targets = await client.query(
      `
      SELECT
        pid,
        datname,
        usename,
        client_addr::text AS client_addr,
        application_name,
        state,
        NOW() - state_change AS idle_for,
        LEFT(COALESCE(query, ''), 80) AS last_query
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND backend_type = 'client backend'
        AND state = 'idle'
        AND state_change < NOW() - ($1::text || ' minutes')::interval
      ORDER BY state_change ASC
      `,
      [String(idleMinutes)]
    );

    if (!targets.rows.length) {
      console.log(`[idle-cleanup] No idle clients older than ${idleMinutes}m`);
      return;
    }

    console.log(`[idle-cleanup] Targets (${targets.rows.length}), idle > ${idleMinutes}m:`);
    for (const row of targets.rows) {
      console.log(
        `  pid=${row.pid} db=${row.datname} user=${row.usename} addr=${row.client_addr || '-'} idle_for=${row.idle_for}`
      );
    }

    if (dryRun) {
      console.log('[idle-cleanup] DRY_RUN=1 — nothing terminated');
      return;
    }

    const killed = await client.query(
      `
      SELECT pid, pg_terminate_backend(pid) AS ok
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND backend_type = 'client backend'
        AND state = 'idle'
        AND state_change < NOW() - ($1::text || ' minutes')::interval
      `,
      [String(idleMinutes)]
    );

    const okCount = killed.rows.filter((r) => r.ok).length;
    console.log(`[idle-cleanup] Terminated ${okCount}/${killed.rows.length}`);

    const statsAfter = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM pg_stat_activity) AS used_total,
        (SELECT COUNT(*)::int FROM pg_stat_activity WHERE backend_type = 'client backend' AND state = 'idle') AS idle_clients
    `);
    console.log(
      `[idle-cleanup] After: used=${statsAfter.rows[0].used_total} idle=${statsAfter.rows[0].idle_clients}`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[idle-cleanup] Failed:', err.message || err);
  process.exit(1);
});
