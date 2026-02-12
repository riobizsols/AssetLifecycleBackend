require('dotenv').config();
const { Pool } = require('pg');

async function checkInvalidCostCenters() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('=== Checking for Invalid Cost Center References ===\n');

    // Find assets with cost_center_code that don't exist in tblCostCenter
    const invalidRefs = await pool.query(`
      SELECT 
        a.asset_id,
        a.description,
        a.cost_center_code,
        COUNT(*) OVER() as total_invalid
      FROM "tblAssets" a
      WHERE a.cost_center_code IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblCostCenter" cc 
          WHERE cc.cc_id = a.cost_center_code
        )
      LIMIT 10
    `);

    if (invalidRefs.rows.length === 0) {
      console.log('✅ No invalid cost center references found!');
      return;
    }

    console.log(`❌ Found ${invalidRefs.rows[0].total_invalid} assets with invalid cost_center_code:\n`);
    
    invalidRefs.rows.forEach((row, index) => {
      console.log(`${index + 1}. Asset: ${row.asset_id} - ${row.description}`);
      console.log(`   Invalid cost_center_code: ${row.cost_center_code}\n`);
    });

    // Get unique invalid cost center codes
    const uniqueInvalid = await pool.query(`
      SELECT DISTINCT a.cost_center_code, COUNT(*) as asset_count
      FROM "tblAssets" a
      WHERE a.cost_center_code IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblCostCenter" cc 
          WHERE cc.cc_id = a.cost_center_code
        )
      GROUP BY a.cost_center_code
      ORDER BY asset_count DESC
    `);

    console.log('\n=== Invalid Cost Center Codes Summary ===\n');
    uniqueInvalid.rows.forEach(row => {
      console.log(`  ${row.cost_center_code}: ${row.asset_count} asset(s)`);
    });

    console.log('\n=== Recommendation ===');
    console.log('You have two options:');
    console.log('1. Set invalid cost_center_code to NULL');
    console.log('2. Create missing cost centers in tblCostCenter');
    console.log('\nWould you like to set them to NULL? Run: node fix-invalid-cost-centers.js');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkInvalidCostCenters();
