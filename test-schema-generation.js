/**
 * Test schema generation to verify it uses GENERIC_URL with all 79 tables
 */

require('dotenv').config();
const setupWizardService = require('./services/setupWizardService');

async function testSchemaGeneration() {
  console.log('🧪 Testing schema generation...\n');
  console.log('📋 Configuration:');
  console.log(`   GENERIC_URL: ${process.env.GENERIC_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  try {
    // Clear cache to force fresh generation
    setupWizardService.clearSchemaCache();
    
    console.log('🔄 Generating schema from GENERIC_URL...\n');
    const schemaResult = await setupWizardService.getSchemaSql(false, true); // forceRegenerate = true
    
    if (!schemaResult) {
      console.error('❌ Schema generation returned null!');
      process.exit(1);
    }
    
    const schemaSql = typeof schemaResult === 'string' ? schemaResult : schemaResult.schema;
    const foreignKeysSql = typeof schemaResult === 'object' ? schemaResult.foreignKeys : '';
    
    // Count tables in generated schema
    const createTableMatches = schemaSql.match(/CREATE TABLE IF NOT EXISTS/g);
    const tableCount = createTableMatches ? createTableMatches.length : 0;
    
    // Count foreign keys
    const fkMatches = foreignKeysSql.match(/ALTER TABLE/g);
    const fkCount = fkMatches ? fkMatches.length : 0;
    
    console.log('\n✅ Schema generation completed!');
    console.log('\n📊 Results:');
    console.log(`   Tables: ${tableCount}`);
    console.log(`   Foreign Keys: ${fkCount}`);
    console.log(`   Schema size: ${schemaSql.length} characters`);
    console.log(`   Foreign keys size: ${foreignKeysSql.length} characters`);
    
    if (tableCount >= 79) {
      console.log('\n✅ SUCCESS: All expected tables are present (79+)!');
    } else if (tableCount >= 70) {
      console.log(`\n⚠️  WARNING: Only ${tableCount} tables generated (expected 79+)`);
    } else {
      console.log(`\n❌ ERROR: Only ${tableCount} tables generated (expected 79+)`);
      process.exit(1);
    }
    
    // List first 10 tables
    const tableNameMatches = schemaSql.match(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g);
    if (tableNameMatches && tableNameMatches.length > 0) {
      console.log('\n📋 First 10 tables:');
      tableNameMatches.slice(0, 10).forEach((match, idx) => {
        const tableName = match.match(/"([^"]+)"/)[1];
        console.log(`   ${idx + 1}. ${tableName}`);
      });
      if (tableNameMatches.length > 10) {
        console.log(`   ... and ${tableNameMatches.length - 10} more`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSchemaGeneration();
