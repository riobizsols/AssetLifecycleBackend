require('dotenv').config();
const { Pool } = require('pg');

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.GENERIC_URL,
  });

  try {
    console.log('=== Checking tblAssets columns ===');
    const assetsSchema = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'tblAssets'
      ORDER BY ordinal_position
    `);
    console.log('tblAssets columns:');
    assetsSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n=== Checking tblBranches columns ===');
    const branchesSchema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tblBranches'
      ORDER BY ordinal_position
    `);
    console.log('tblBranches columns:');
    branchesSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n=== Checking tblBranchCostCenter ===');
    const costCenterExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tblBranchCostCenter'
      )
    `);
    
    if (costCenterExists.rows[0].exists) {
      const costCenterSchema = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'tblBranchCostCenter'
        ORDER BY ordinal_position
      `);
      console.log('tblBranchCostCenter columns:');
      costCenterSchema.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('⚠️  tblBranchCostCenter does NOT exist');
    }

    console.log('\n=== Checking tblAssetTypes columns ===');
    const assetTypesSchema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'tblAssetTypes'
      ORDER BY ordinal_position
    `);
    console.log('tblAssetTypes columns:');
    assetTypesSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
