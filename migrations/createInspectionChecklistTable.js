const { getDb } = require('../utils/dbContext');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
  const dbPool = getDb();
  
  try {
    console.log('🔄 Creating Inspection Checklist tables...');
    
    // Read and execute SQL
    const sqlFile = path.join(__dirname, 'createInspectionChecklistTable.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    await dbPool.query(sql);
    
    console.log('✅ Inspection Checklist tables created successfully');
    
    // Verify tables exist
    const result = await dbPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('tblInspectionChecklist')
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified tables:');
      result.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    }
    
    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nTo fix this:');
    console.log('1. Ensure PostgreSQL is running');
    console.log('2. Check DATABASE_URL in .env');
    console.log('3. Run: node migrations/createInspectionChecklistTable.js');
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
