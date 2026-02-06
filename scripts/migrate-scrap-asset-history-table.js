const { getDbFromContext } = require('../utils/dbContext');
const fs = require('fs');
const path = require('path');

const getDb = () => getDbFromContext();

async function runMigration() {
  try {
    console.log('Starting migration: Create tblScrapAssetHist table...');
    
    const sqlFile = path.join(__dirname, '../migrations/create_scrap_asset_history_table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    const db = getDb();
    await db.query(sql);
    
    console.log('✓ Migration completed successfully');
    console.log('✓ Table tblScrapAssetHist created with indexes');
    console.log('✓ This table will store history for both Scrap Asset and Scrap Sales operations');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
