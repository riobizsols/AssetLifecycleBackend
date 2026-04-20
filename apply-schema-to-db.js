/**
 * Apply full schema to manufacturing database
 */

require('dotenv').config();
const { Pool } = require('pg');
const setupWizardService = require('./services/setupWizardService');

async function applySchema() {
  console.log('🚀 Starting schema application to DATABASE_URL...');
  console.log(`📌 Target Database: ${process.env.DATABASE_URL}`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis:10000,
  });

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const testClient = await pool.connect();
    console.log('✅ Connection successful');
    testClient.release();

    // Get schema SQL (dynamically generated from GENERIC_URL)
    console.log('\n📋 Generating schema from GENERIC_URL...');
    const schemaResult = await setupWizardService.getSchemaSql(false, true); // forceRegenerate = true
    
    const schemaSql = typeof schemaResult === 'string' ? schemaResult : schemaResult.schema;
    const foreignKeysSql = typeof schemaResult === 'object' ? schemaResult.foreignKeys : '';
    
    console.log(`✅ Schema generated: ${schemaSql.length} characters`);
    if (foreignKeysSql && foreignKeysSql.length > 0) {
      console.log(`✅ Foreign keys generated: ${foreignKeysSql.length} characters`);
    }

    // Apply schema WITHOUT foreign keys first
    console.log('\n🏗️  Creating tables and constraints (without foreign keys)...');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Apply schema
      await client.query(schemaSql);
      console.log('✅ Schema applied successfully');
      
      // Apply foreign keys if present
      if (foreignKeysSql && foreignKeysSql.length > 0) {
        console.log('\n🔗 Applying foreign key constraints...');
        await client.query(foreignKeysSql);
        console.log('✅ Foreign keys applied successfully');
      }
      
      await client.query('COMMIT');
      console.log('\n✅ Transaction committed successfully');
      
      // Verify tables were created
      console.log('\n🔍 Verifying tables...');
      const result = await client.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log(`✅ Total tables in database: ${result.rows[0].table_count}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during schema application:', error.message);
      throw error;
    } finally {
      client.release();
    }
    
    console.log('\n🎉 Schema application completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed');
  }
}

// Run the script
applySchema();
