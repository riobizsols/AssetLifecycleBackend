/**
 * Migration: Add emp_int_id column to maintenance and inspection tables
 * This enables employee tracking across maintenance frequencies and scheduled workflows
 */

const db = require('../config/db');

const addEmpIntIdColumns = async () => {
  console.log('🔄 Starting migration: Add emp_int_id columns to maintenance and inspection tables...\n');
  
  try {
    const tables = [
      'tblATMaintFreq',
      'tblAAT_Insp_Freq', 
      'tblAAT_Insp_Sch',
      'tblWFAATInspSch_H',
      'tblAssetMaintSch',
      'tblWFAssetMaintSch_H'
    ];

    for (const tableName of tables) {
      console.log(`🔍 Processing table: ${tableName}`);
      
      // Step 1: Check if column already exists
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'emp_int_id'
      `, [tableName]);
      
      if (columnCheck.rows.length > 0) {
        console.log(`   ℹ️  Column emp_int_id already exists in ${tableName}`);
        continue;
      }
      
      // Step 2: Add emp_int_id column
      console.log(`   ➕ Adding emp_int_id column to ${tableName}...`);
      
      await db.query(`
        ALTER TABLE "${tableName}" 
        ADD COLUMN emp_int_id VARCHAR(50)
      `);
      
      console.log(`   ✅ Successfully added emp_int_id column to ${tableName}`);
      
      // Step 3: Add comment for documentation
      await db.query(`
        COMMENT ON COLUMN "${tableName}".emp_int_id 
        IS 'Employee internal ID for tracking responsible employee'
      `);
      
      // Step 4: Check record count for information
      const countResult = await db.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      console.log(`   📊 Table ${tableName} has ${countResult.rows[0].count} existing records`);
      
      console.log('');
    }
    
    // Step 5: Verify all columns were added
    console.log('📋 Verification Summary:\n');
    
    for (const tableName of tables) {
      const columnCheck = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'emp_int_id'
      `, [tableName]);
      
      if (columnCheck.rows.length > 0) {
        const col = columnCheck.rows[0];
        console.log(`✅ ${tableName}.emp_int_id: ${col.data_type} (nullable: ${col.is_nullable})`);
      } else {
        console.log(`❌ ${tableName}.emp_int_id: NOT FOUND`);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Added emp_int_id VARCHAR(50) column to 6 tables');
    console.log('   - Column is nullable to support existing records');
    console.log('   - Ready for employee tracking in maintenance/inspection workflows');
    console.log('');
    console.log('💡 Usage Examples:');
    console.log('   - Track who created maintenance frequencies');
    console.log('   - Track responsible employee for inspection schedules'); 
    console.log('   - Associate workflows with specific employees');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

module.exports = { addEmpIntIdColumns };

// Run migration if called directly
if (require.main === module) {
  addEmpIntIdColumns()
    .then(() => {
      console.log('\nMigration script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}