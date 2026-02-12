const { getDbFromContext } = require('../utils/dbContext');
const fs = require('fs');
const path = require('path');

const getDb = () => getDbFromContext();

async function runMigration() {
  try {
    console.log('Altering tblScrapAssetHist.action column to VARCHAR(50)...');
    
    const sqlFile = path.join(__dirname, '../migrations/alter_scrap_asset_history_action_column.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    const db = getDb();
    await db.query(sql);
    
    console.log('✓ Migration completed successfully');
    console.log('✓ Column tblScrapAssetHist.action now supports longer action codes');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
