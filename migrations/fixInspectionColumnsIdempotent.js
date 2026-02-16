const db = require('../config/db');

/**
 * Migration: Rename all inspection table columns to lowercase (IDEMPOTENT)
 * Checks if columns exist before attempting to rename
 */

const renameColumnIfExists = async (client, tableName, oldName, newName) => {
  try {
    // Check if old column exists
    const checkOld = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    `, [tableName, oldName]);
    
    if (checkOld.rows.length > 0) {
      await client.query(`
        ALTER TABLE "${tableName}" 
          RENAME COLUMN "${oldName}" TO ${newName};
      `);
      console.log(`      ✅ ${oldName} → ${newName}`);
      return true;
    } else {
      console.log(`      ⏭️  ${oldName} already renamed (or doesn't exist)`);
      return false;
    }
  } catch (error) {
    console.log(`      ❌ Failed to rename ${oldName}: ${error.message}`);
    throw error;
  }
};

const fixInspectionTableColumns = async () => {
  const client = await db.connect();
  
  try {
    console.log('\n=== FIXING INSPECTION TABLE COLUMN NAMES (IDEMPOTENT) ===\n');
    console.log('Converting all column names to lowercase...\n');

    await client.query('BEGIN');

    // 1. Fix tblInspCheckList
    console.log('1️⃣ Fixing tblInspCheckList...');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Insp_Check_id', 'insp_check_id');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Inspection_text', 'inspection_text');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Response_Type', 'response_type');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Expected_Value', 'expected_value');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Min_Range', 'min_range');
    await renameColumnIfExists(client, 'tblInspCheckList', 'Max_range', 'max_range');

    // 2. Fix tblAATInspCheckList
    console.log('\n2️⃣ Fixing tblAATInspCheckList...');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'AATIC_id', 'aatic_id');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'AT_id', 'at_id');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'Asset_id', 'asset_id');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'Insp_check_id', 'insp_check_id');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'Expected_Value', 'expected_value');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'Min_Range', 'min_range');
    await renameColumnIfExists(client, 'tblAATInspCheckList', 'Max_range', 'max_range');

    // 3. Fix tblAAT_Insp_Freq
    console.log('\n3️⃣ Fixing tblAAT_Insp_Freq...');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'AATIF_id', 'aatif_id');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'AAtIc_id', 'aatic_id');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'Freq', 'freq');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'UOM', 'uom');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'Text', 'text');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'Is_recurring', 'is_recurring');
    await renameColumnIfExists(client, 'tblAAT_Insp_Freq', 'Hours_required', 'hours_required');

    // 4. Fix tblWFATInspSeqs
    console.log('\n4️⃣ Fixing tblWFATInspSeqs...');
    await renameColumnIfExists(client, 'tblWFATInspSeqs', 'WFATIS_id', 'wfatis_id');
    await renameColumnIfExists(client, 'tblWFATInspSeqs', 'At_id', 'at_id');
    await renameColumnIfExists(client, 'tblWFATInspSeqs', 'WF_steps_id', 'wf_steps_id');
    await renameColumnIfExists(client, 'tblWFATInspSeqs', 'Seqs_no', 'seqs_no');

    // 5. Fix tblAAT_Insp_Rec
    console.log('\n5️⃣ Fixing tblAAT_Insp_Rec...');
    await renameColumnIfExists(client, 'tblAAT_Insp_Rec', 'ATTIRec_Id', 'attirec_id');
    await renameColumnIfExists(client, 'tblAAT_Insp_Rec', 'AATISch_Id', 'aatisch_id');
    await renameColumnIfExists(client, 'tblAAT_Insp_Rec', 'Insp_Check_Id', 'insp_check_id');
    await renameColumnIfExists(client, 'tblAAT_Insp_Rec', 'Recorded_Value', 'recorded_value');

    // 6. Fix tblInspResTypeDet
    console.log('\n6️⃣ Fixing tblInspResTypeDet...');
    await renameColumnIfExists(client, 'tblInspResTypeDet', 'IRTD_Id', 'irtd_id');
    await renameColumnIfExists(client, 'tblInspResTypeDet', 'Name', 'name');
    await renameColumnIfExists(client, 'tblInspResTypeDet', 'Expected_Value', 'expected_value');
    await renameColumnIfExists(client, 'tblInspResTypeDet', 'Option', 'option');

    // 7. Fix tblATInspCerts
    console.log('\n7️⃣ Fixing tblATInspCerts...');
    await renameColumnIfExists(client, 'tblATInspCerts', 'ATIC_id', 'atic_id');
    await renameColumnIfExists(client, 'tblATInspCerts', 'AAtIc_id', 'aatic_id');
    await renameColumnIfExists(client, 'tblATInspCerts', 'TC_id', 'tc_id');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n💡 All inspection table columns renamed to lowercase.');
    console.log('   Foreign key relationships and indexes remain intact.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
};

// Run migration
fixInspectionTableColumns()
  .then(() => {
    console.log('Migration process completed');
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
