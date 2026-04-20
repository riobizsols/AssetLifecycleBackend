/**
 * Migration: Update Direct Inspection table to use branch_code instead of branch_id
 * This ensures consistency with workflow inspections
 */

const db = require('../config/db');

const updateDirectInspectionToBranchCode = async () => {
  console.log('🔄 Starting migration: Update Direct Inspection to use branch_code...\n');
  
  try {
    // Step 1: Check if branch_code column already exists
    console.log('1️⃣ Checking current table structure...');
    const columnCheck = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tblAAT_Insp_Sch' 
      AND column_name IN ('branch_id', 'branch_code')
    `);
    
    console.log('   Current columns:', columnCheck.rows);
    
    const hasBranchId = columnCheck.rows.some(row => row.column_name === 'branch_id');
    const hasBranchCode = columnCheck.rows.some(row => row.column_name === 'branch_code');
    
    // Step 2: Add branch_code column if it doesn't exist
    if (!hasBranchCode) {
      console.log('2️⃣ Adding branch_code column...');
      await db.query(`
        ALTER TABLE "tblAAT_Insp_Sch" 
        ADD COLUMN branch_code VARCHAR(20)
      `);
      console.log('   ✅ Branch_code column added');
    } else {
      console.log('2️⃣ Branch_code column already exists');
    }
    
    // Step 3: Migrate data from branch_id to branch_code if branch_id exists
    if (hasBranchId) {
      console.log('3️⃣ Migrating data from branch_id to branch_code...');
      
      const migrationQuery = `
        UPDATE "tblAAT_Insp_Sch" 
        SET branch_code = b.branch_code
        FROM "tblBranches" b
        WHERE "tblAAT_Insp_Sch".branch_id = b.branch_id
        AND "tblAAT_Insp_Sch".branch_code IS NULL
      `;
      
      const result = await db.query(migrationQuery);
      console.log(`   ✅ Updated ${result.rowCount} inspection records`);
      
      // Step 4: Check for any records that couldn't be migrated
      const unmappedCheck = await db.query(`
        SELECT COUNT(*) as count 
        FROM "tblAAT_Insp_Sch" 
        WHERE branch_id IS NOT NULL AND branch_code IS NULL
      `);
      
      if (unmappedCheck.rows[0].count > 0) {
        console.log(`   ⚠️  Warning: ${unmappedCheck.rows[0].count} records could not be migrated (invalid branch_id)`);
      }
      
      // Step 5: Drop branch_id column after successful migration
      console.log('4️⃣ Removing old branch_id column...');
      await db.query(`
        ALTER TABLE "tblAAT_Insp_Sch" 
        DROP COLUMN IF EXISTS branch_id
      `);
      console.log('   ✅ Branch_id column removed');
    } else {
      console.log('3️⃣ No branch_id column found - migration not needed');
    }
    
    // Step 6: Verify final structure
    console.log('5️⃣ Verifying final table structure...');
    const finalCheck = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tblAAT_Insp_Sch' 
      AND column_name LIKE '%branch%'
      ORDER BY column_name
    `);
    
    console.log('   Final branch-related columns:');
    finalCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Direct inspections now store branch_code consistently with workflow inspections');
    console.log('   - Both inspection types can be fetched using branch_code like maintenance notifications');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

module.exports = { updateDirectInspectionToBranchCode };

// Run migration if called directly
if (require.main === module) {
  updateDirectInspectionToBranchCode()
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}