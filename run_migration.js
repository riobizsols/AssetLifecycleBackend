const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Add last_gen_seq_no column to tblAssetTypes...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'add_last_gen_seq_no.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📝 Added last_gen_seq_no column to tblAssetTypes table');
    console.log('📊 All existing asset types now have last_gen_seq_no = 0');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
