/**
 * Script: Move Admin Settings Screens to Top Level
 * 
 * This script moves the three admin settings screens out of the ADMINSETTINGS dropdown
 * to be top-level items in the sidebar:
 * - MAINTENANCECONFIG
 * - PROPERTIES
 * - BREAKDOWNREASONCODES
 */

const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

const moveToTopLevel = async () => {
  const dbPool = getDb();
  
  try {
    console.log('🚀 Moving admin settings screens to top level...\n');
    
    const screens = ['MAINTENANCECONFIG', 'PROPERTIES', 'BREAKDOWNREASONCODES'];
    
    for (const appId of screens) {
      console.log(`📋 Processing ${appId}...`);
      
      // Get all navigation entries for this app_id
      const entries = await dbPool.query(
        `SELECT job_role_nav_id, job_role_id, parent_id, sequence 
         FROM "tblJobRoleNav" 
         WHERE app_id = $1 AND int_status = 1`,
        [appId]
      );
      
      console.log(`   Found ${entries.rows.length} entries`);
      
      let updated = 0;
      for (const entry of entries.rows) {
        if (entry.parent_id) {
          // Get the max sequence for top-level items in this job role
          const maxSeqResult = await dbPool.query(
            `SELECT COALESCE(MAX(sequence), 0) as max_seq 
             FROM "tblJobRoleNav" 
             WHERE job_role_id = $1 AND parent_id IS NULL AND int_status = 1`,
            [entry.job_role_id]
          );
          const nextSeq = (maxSeqResult.rows[0]?.max_seq || 0) + 1;
          
          // Update to remove parent (make it top-level)
          await dbPool.query(
            `UPDATE "tblJobRoleNav" 
             SET parent_id = NULL, sequence = $1
             WHERE job_role_nav_id = $2`,
            [nextSeq, entry.job_role_nav_id]
          );
          
          updated++;
          console.log(`   ✅ Updated ${entry.job_role_nav_id} (job role: ${entry.job_role_id}) - moved to top level with sequence ${nextSeq}`);
        } else {
          console.log(`   ℹ️  ${entry.job_role_nav_id} is already top-level`);
        }
      }
      
      console.log(`   📊 Updated ${updated} entries for ${appId}\n`);
    }
    
    console.log('✅ Script completed successfully!');
    console.log('📝 Note: The screens will now appear as top-level items in the sidebar');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
};

// Run script if called directly
if (require.main === module) {
  moveToTopLevel()
    .then(() => {
      console.log('\n✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = moveToTopLevel;

