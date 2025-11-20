/**
 * Drop Database Script
 * 
 * Usage: node scripts/drop-database.js <database_name>
 */

require('dotenv').config();
const { Client } = require('pg');

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

async function dropDatabase() {
  const dbName = process.argv[2] || 'pospitality';
  const config = parseDatabaseUrl(process.env.DATABASE_URL);
  
  const client = new Client({
    connectionString: `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/postgres`,
  });

  try {
    await client.connect();
    console.log(`Dropping database '${dbName}'...`);
    
    // Terminate connections
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]).catch(() => {});
    
    // Drop database
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`✅ Database '${dbName}' dropped successfully`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

dropDatabase();

