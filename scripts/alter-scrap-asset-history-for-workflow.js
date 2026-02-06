const { getDbFromContext } = require('../utils/dbContext');
const fs = require('fs');
const path = require('path');

const getDb = () => getDbFromContext();

async function runMigration() {
  try {
    console.log('Altering tblScrapAssetHist to match workflow history structure...');
    
    const sqlFile = path.join(__dirname, '../migrations/alter_scrap_asset_history_for_workflow.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    const db = getDb();
    await db.query(sql);
    
    console.log('✓ Migration completed successfully');
    console.log('✓ Table tblScrapAssetHist now matches workflow history structure');
    console.log('✓ Added wfscrap_h_id and wfscrap_d_id columns');
    console.log('✓ Removed scrap_type and ssh_id columns');
    console.log('✓ Action codes now use short format (UA, UR, AP, IN, IP, CO, CA)');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
