require('dotenv').config();
const { Pool } = require('pg');

async function addForeignKeyConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('=== Adding Foreign Key Constraint ===');
    console.log('Adding FK: tblAssets.cost_center_code -> tblCostCenter.cc_id\n');

    // Check if constraint already exists
    const checkConstraint = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'tblAssets' 
        AND constraint_name = 'fk_assets_cost_center'
    `);

    if (checkConstraint.rows.length > 0) {
      console.log('⚠️  Foreign key constraint already exists!');
      return;
    }

    // Add the foreign key constraint
    await pool.query(`
      ALTER TABLE "tblAssets"
      ADD CONSTRAINT fk_assets_cost_center
      FOREIGN KEY (cost_center_code)
      REFERENCES "tblCostCenter" (cc_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
    `);

    console.log('✅ Foreign key constraint added successfully!');
    console.log('   Constraint: fk_assets_cost_center');
    console.log('   From: tblAssets.cost_center_code');
    console.log('   To: tblCostCenter.cc_id');
    console.log('   ON UPDATE: CASCADE');
    console.log('   ON DELETE: SET NULL');

  } catch (error) {
    console.error('❌ Error adding foreign key constraint:', error.message);
    console.error('Details:', error);
  } finally {
    await pool.end();
  }
}

addForeignKeyConstraint();
