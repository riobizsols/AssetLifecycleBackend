/**
 * Migration: Add trigger_maintenance column to tblAAT_Insp_Sch
 * This allows marking an entire inspection as requiring maintenance
 */

require('dotenv').config();
const { Pool } = require('pg');

async function addTriggerMaintenanceColumn() {
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting migration: Add trigger_maintenance to tblAAT_Insp_Sch...');

    // Check if column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tblAAT_Insp_Sch' 
        AND column_name = 'trigger_maintenance'
    `;
    
    const columnExists = await dbPool.query(checkColumnQuery);
    
    if (columnExists.rows.length > 0) {
      console.log('ℹ️  trigger_maintenance column already exists in tblAAT_Insp_Sch');
      return;
    }

    // Add the trigger_maintenance column
    await dbPool.query(`
      ALTER TABLE "tblAAT_Insp_Sch" 
      ADD COLUMN trigger_maintenance BOOLEAN DEFAULT false
    `);

    console.log('✅ Added trigger_maintenance column to tblAAT_Insp_Sch');

    // Create index for better query performance
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_trigger_maintenance 
      ON "tblAAT_Insp_Sch" (trigger_maintenance)
    `);

    console.log('✅ Created index on trigger_maintenance column');
    
    console.log('📊 Summary: trigger_maintenance column added to tblAAT_Insp_Sch with index');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await dbPool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  addTriggerMaintenanceColumn()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addTriggerMaintenanceColumn };