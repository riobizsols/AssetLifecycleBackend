const db = require('../config/db');

/**
 * Migration: Rename all inspection table columns to lowercase
 * Fixes column naming convention for all inspection-related tables
 */

const fixInspectionTableColumns = async () => {
  const client = await db.connect();
  
  try {
    console.log('\n=== FIXING INSPECTION TABLE COLUMN NAMES ===\n');
    console.log('Converting all column names to lowercase...\n');

    await client.query('BEGIN');

    // 1. Fix tblInspCheckList
    console.log('1️⃣ Fixing tblInspCheckList...');
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Insp_Check_id" TO insp_check_id;
    `);
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Inspection_text" TO inspection_text;
    `);
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Response_Type" TO response_type;
    `);
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Expected_Value" TO expected_value;
    `);
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Min_Range" TO min_range;
    `);
    await client.query(`
      ALTER TABLE "tblInspCheckList" 
        RENAME COLUMN "Max_range" TO max_range;
    `);
    console.log('   ✅ tblInspCheckList fixed (6 columns)');

    // 2. Fix tblAATInspCheckList
    console.log('\n2️⃣ Fixing tblAATInspCheckList...');
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "AATIC_id" TO aatic_id;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "AT_id" TO at_id;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "Asset_id" TO asset_id;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "Insp_check_id" TO insp_check_id;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "Expected_Value" TO expected_value;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "Min_Range" TO min_range;
    `);
    await client.query(`
      ALTER TABLE "tblAATInspCheckList" 
        RENAME COLUMN "Max_range" TO max_range;
    `);
    console.log('   ✅ tblAATInspCheckList fixed (7 columns)');

    // 3. Fix tblAAT_Insp_Freq
    console.log('\n3️⃣ Fixing tblAAT_Insp_Freq...');
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "AATIF_id" TO aatif_id;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "AAtIc_id" TO aatic_id;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "Freq" TO freq;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "UOM" TO uom;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "Text" TO text;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "Is_recurring" TO is_recurring;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Freq" 
        RENAME COLUMN "Hours_required" TO hours_required;
    `);
    console.log('   ✅ tblAAT_Insp_Freq fixed (7 columns)');

    // 4. Fix tblWFATInspSeqs
    console.log('\n4️⃣ Fixing tblWFATInspSeqs...');
    await client.query(`
      ALTER TABLE "tblWFATInspSeqs" 
        RENAME COLUMN "WFATIS_id" TO wfatis_id;
    `);
    await client.query(`
      ALTER TABLE "tblWFATInspSeqs" 
        RENAME COLUMN "At_id" TO at_id;
    `);
    await client.query(`
      ALTER TABLE "tblWFATInspSeqs" 
        RENAME COLUMN "WF_steps_id" TO wf_steps_id;
    `);
    await client.query(`
      ALTER TABLE "tblWFATInspSeqs" 
        RENAME COLUMN "Seqs_no" TO seqs_no;
    `);
    console.log('   ✅ tblWFATInspSeqs fixed (4 columns)');

    // 5. Fix tblAAT_Insp_Rec
    console.log('\n5️⃣ Fixing tblAAT_Insp_Rec...');
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Rec" 
        RENAME COLUMN "ATTIRec_Id" TO attirec_id;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Rec" 
        RENAME COLUMN "AATISch_Id" TO aatisch_id;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Rec" 
        RENAME COLUMN "Insp_Check_Id" TO insp_check_id;
    `);
    await client.query(`
      ALTER TABLE "tblAAT_Insp_Rec" 
        RENAME COLUMN "Recorded_Value" TO recorded_value;
    `);
    console.log('   ✅ tblAAT_Insp_Rec fixed (4 columns)');

    // 6. Fix tblInspResTypeDet
    console.log('\n6️⃣ Fixing tblInspResTypeDet...');
    await client.query(`
      ALTER TABLE "tblInspResTypeDet" 
        RENAME COLUMN "IRTD_Id" TO irtd_id;
    `);
    await client.query(`
      ALTER TABLE "tblInspResTypeDet" 
        RENAME COLUMN "Name" TO name;
    `);
    await client.query(`
      ALTER TABLE "tblInspResTypeDet" 
        RENAME COLUMN "Expected_Value" TO expected_value;
    `);
    await client.query(`
      ALTER TABLE "tblInspResTypeDet" 
        RENAME COLUMN "Option" TO option;
    `);
    console.log('   ✅ tblInspResTypeDet fixed (4 columns)');

    // 7. Fix tblATInspCerts
    console.log('\n7️⃣ Fixing tblATInspCerts...');
    await client.query(`
      ALTER TABLE "tblATInspCerts" 
        RENAME COLUMN "ATIC_id" TO atic_id;
    `);
    await client.query(`
      ALTER TABLE "tblATInspCerts" 
        RENAME COLUMN "AAtIc_id" TO aatic_id;
    `);
    await client.query(`
      ALTER TABLE "tblATInspCerts" 
        RENAME COLUMN "TC_id" TO tc_id;
    `);
    console.log('   ✅ tblATInspCerts fixed (3 columns)');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - tblInspCheckList: 6 columns renamed');
    console.log('   - tblAATInspCheckList: 7 columns renamed');
    console.log('   - tblAAT_Insp_Freq: 7 columns renamed');
    console.log('   - tblWFATInspSeqs: 4 columns renamed');
    console.log('   - tblAAT_Insp_Rec: 4 columns renamed');
    console.log('   - tblInspResTypeDet: 4 columns renamed');
    console.log('   - tblATInspCerts: 3 columns renamed');
    console.log('   Total: 35 columns renamed to lowercase');
    console.log('\n💡 All foreign key relationships and indexes remain intact.');
    console.log('   PostgreSQL automatically updates references when columns are renamed.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
};

// Run migration
fixInspectionTableColumns()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
