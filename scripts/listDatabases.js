/**
 * List All Databases
 * 
 * This script lists all databases in the PostgreSQL server
 */

const { Client } = require('pg');
require('dotenv').config();

// Get source database URL from .env
const sourceDbUrl = process.env.DATABASE_URL;

if (!sourceDbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse source database URL
function parseDatabaseUrl(databaseUrl) {
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

async function main() {
  const sourceConfig = parseDatabaseUrl(sourceDbUrl);
  
  // Connect to postgres database to list all databases
  const adminClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: 'postgres', // Connect to postgres database
  });

  try {
    console.log('🔌 Connecting to PostgreSQL server...');
    await adminClient.connect();
    console.log('✅ Connected successfully\n');

    // List all databases
    const result = await adminClient.query(`
      SELECT 
        datname as database_name,
        pg_size_pretty(pg_database_size(datname)) as size,
        datcollate as collation,
        datctype as ctype
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);

    console.log('📋 All Databases:');
    console.log('─'.repeat(80));
    console.log(`${'Database Name'.padEnd(40)} ${'Size'.padEnd(15)} ${'Collation'}`);
    console.log('─'.repeat(80));
    
    result.rows.forEach((row, index) => {
      const name = row.database_name;
      const size = row.size || 'N/A';
      const collation = row.collation || 'N/A';
      console.log(`${(index + 1).toString().padStart(3)}. ${name.padEnd(37)} ${size.padEnd(15)} ${collation}`);
    });
    
    console.log('─'.repeat(80));
    console.log(`\nTotal: ${result.rows.length} databases\n`);

    // Check for hospital-related databases
    const hospitalDbs = result.rows.filter(row => 
      row.database_name.toLowerCase().includes('hospital') ||
      row.database_name.toLowerCase().includes('apollo') ||
      row.database_name.toLowerCase().includes('clinic')
    );

    if (hospitalDbs.length > 0) {
      console.log('🏥 Hospital-related databases found:');
      hospitalDbs.forEach(db => {
        console.log(`   - ${db.database_name} (${db.size})`);
      });
    } else {
      console.log('ℹ️  No hospital-related databases found.');
      console.log('   Run: node scripts/cloneDatabaseForHospital.js <hospital-name>');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await adminClient.end();
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

