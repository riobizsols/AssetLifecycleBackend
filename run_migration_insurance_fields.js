const fs = require('fs');
const path = require('path');
const db = require('./config/db');

(async () => {
  const filePath = path.join(__dirname, 'migrations', '011_add_insurance_fields_to_tblAssets.sql');
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    if (!sql || !sql.trim()) {
      console.error('Migration file is empty:', filePath);
      process.exit(1);
    }
    console.log('Running migration:', filePath);
    await db.query('BEGIN');
    await db.query(sql);
    await db.query('COMMIT');
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
