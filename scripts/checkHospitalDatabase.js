/**
 * Check Hospital Database
 * 
 * Lists all tables in the hospital database and checks if tblUsers and tblEmployees have data
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
  
  // Connect to hospital database
  const hospitalClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: 'hospital',
  });

  try {
    console.log('🔌 Connecting to hospital database...');
    await hospitalClient.connect();
    console.log('✅ Connected successfully\n');

    // List all tables
    const tablesResult = await hospitalClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`📋 Found ${tablesResult.rows.length} tables in hospital database:\n`);
    
    // Check tblUsers
    const usersCheck = await hospitalClient.query(`
      SELECT COUNT(*) as count FROM "tblUsers"
    `).catch(() => ({ rows: [{ count: '0 (table does not exist)' }] }));
    
    // Check tblEmployees
    const employeesCheck = await hospitalClient.query(`
      SELECT COUNT(*) as count FROM "tblEmployees"
    `).catch(() => ({ rows: [{ count: '0 (table does not exist)' }] }));

    console.log('📊 Key Tables Status:');
    console.log(`   - tblUsers: ${usersCheck.rows[0].count} rows`);
    console.log(`   - tblEmployees: ${employeesCheck.rows[0].count} rows\n`);

    // List first 10 tables
    console.log('📋 First 10 tables:');
    tablesResult.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.table_name}`);
    });
    
    if (tablesResult.rows.length > 10) {
      console.log(`   ... and ${tablesResult.rows.length - 10} more tables\n`);
    }

    // Check if important tables exist
    const importantTables = ['tblUsers', 'tblEmployees', 'tblOrgs', 'tblAssets', 'tblVendors'];
    console.log('🔍 Checking important tables:');
    for (const tableName of importantTables) {
      const exists = tablesResult.rows.some(row => row.table_name === tableName);
      const status = exists ? '✅' : '❌';
      console.log(`   ${status} ${tableName}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\n💡 The hospital database does not exist. Run:');
      console.log('   node scripts/cloneDatabaseForHospital.js hospital');
    }
    throw error;
  } finally {
    await hospitalClient.end();
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

