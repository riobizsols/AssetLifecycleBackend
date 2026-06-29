require('dotenv').config();
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const postgresUrl = databaseUrl.replace(/\/[^/]+$/, '/postgres');

async function tryConnect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function main() {
  let client;
  for (const cs of [databaseUrl, postgresUrl]) {
    const db = cs.split('/').pop();
    try {
      console.log(`Trying to connect to database: ${db}`);
      client = await tryConnect(cs);
      console.log(`Connected to: ${db}`);
      break;
    } catch (err) {
      console.log(`  failed: ${err.message}`);
    }
  }

  if (!client) {
    console.log('\nCould not connect. Server is full. Wait 5-10 min or ask server admin to restart PostgreSQL.');
    process.exit(1);
  }

  const stats = await client.query(`
    SELECT datname, state, COUNT(*)::int AS count
    FROM pg_stat_activity
    WHERE datname IS NOT NULL
    GROUP BY datname, state
    ORDER BY datname, state
  `);
  console.log('\nConnection usage by database:');
  console.table(stats.rows);

  const terminated = await client.query(`
    SELECT pg_terminate_backend(pid) AS terminated, pid, datname, usename, application_name, state
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND datname IN ('sample', 'assetLifecycle', 'postgres')
      AND state = 'idle'
  `);
  console.log(`\nTerminated ${terminated.rowCount} idle connection(s):`);
  console.table(terminated.rows);

  const test = await client.query('SELECT current_database() AS db');
  console.log('\nStill connected to:', test.rows[0].db);
  await client.end();
  console.log('\nDone. Try DBeaver again now.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
