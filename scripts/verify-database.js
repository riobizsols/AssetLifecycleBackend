/**
 * Verify Database Duplication
 * 
 * Usage: node scripts/verify-database.js <database_name>
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

async function verifyDatabase() {
  const dbName = process.argv[2] || 'hospitality';
  const config = parseDatabaseUrl(process.env.DATABASE_URL);
  
  const client = new Client({
    connectionString: `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${dbName}`,
  });

  try {
    await client.connect();
    console.log(`\n✅ Connected to database '${dbName}'\n`);

    // Count tables
    const tables = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    console.log(`📊 Tables: ${tables.rows[0].count}`);

    // Count primary keys
    const pks = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public'
    `);
    console.log(`🔑 Primary Keys: ${pks.rows[0].count}`);

    // Count foreign keys
    const fks = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
    `);
    console.log(`🔗 Foreign Keys: ${fks.rows[0].count}`);

    // Count unique constraints
    const uniques = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'UNIQUE' AND table_schema = 'public'
    `);
    console.log(`✨ Unique Constraints: ${uniques.rows[0].count}`);

    // Count indexes
    const indexes = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    console.log(`📇 Indexes: ${indexes.rows[0].count}`);

    // Count sequences
    const sequences = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_sequences
      WHERE schemaname = 'public'
    `);
    console.log(`🔢 Sequences: ${sequences.rows[0].count}`);

    // Sample data count
    const sampleData = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM "tblOrgs") as orgs,
        (SELECT COUNT(*) FROM "tblUsers") as users,
        (SELECT COUNT(*) FROM "tblAssets") as assets,
        (SELECT COUNT(*) FROM "tblBranches") as branches,
        (SELECT COUNT(*) FROM "tblDepartments") as departments
    `);
    console.log(`\n📦 Sample Data:`);
    console.log(`   Organizations: ${sampleData.rows[0].orgs}`);
    console.log(`   Users: ${sampleData.rows[0].users}`);
    console.log(`   Assets: ${sampleData.rows[0].assets}`);
    console.log(`   Branches: ${sampleData.rows[0].branches}`);
    console.log(`   Departments: ${sampleData.rows[0].departments}`);

    console.log(`\n✅ Database '${dbName}' verification complete!\n`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();

