require('dotenv').config();
const { Pool } = require('pg');

async function fixInvalidCostCenters() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('=== Fixing Invalid Cost Center References ===\n');

    // Count invalid references
    const countResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM "tblAssets" a
      WHERE a.cost_center_code IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblCostCenter" cc 
          WHERE cc.cc_id = a.cost_center_code
        )
    `);

    const invalidCount = parseInt(countResult.rows[0].count);

    if (invalidCount === 0) {
      console.log('✅ No invalid cost center references found!');
      return;
    }

    console.log(`Found ${invalidCount} asset(s) with invalid cost_center_code`);
    console.log('Setting them to NULL...\n');

    // Update invalid references to NULL
    const updateResult = await pool.query(`
      UPDATE "tblAssets"
      SET cost_center_code = NULL,
          changed_on = NOW()
      WHERE cost_center_code IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblCostCenter" cc 
          WHERE cc.cc_id = cost_center_code
        )
      RETURNING asset_id, description
    `);

    console.log(`✅ Updated ${updateResult.rows.length} asset(s)\n`);

    if (updateResult.rows.length <= 10) {
      console.log('Updated assets:');
      updateResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.asset_id} - ${row.description}`);
      });
    }

    console.log('\n✅ Done! Now you can run: node add-cost-center-fk.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixInvalidCostCenters();
