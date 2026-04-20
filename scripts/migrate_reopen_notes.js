const { getDb } = require('../utils/dbContext');

async function migrate() {
  try {
    await getDb().query('ALTER TABLE "tblAssetBRDet" ADD COLUMN IF NOT EXISTS reopen_notes TEXT');
    await getDb().query('ALTER TABLE "tblAssetBRDet" ADD COLUMN IF NOT EXISTS changed_on TIMESTAMP WITHOUT TIME ZONE');
    console.log('Column reopen_notes added successfully');
    console.log('Column changed_on added successfully');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
