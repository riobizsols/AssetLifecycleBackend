require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.GENERIC_URL,
});

async function checkBranchRelatedTables() {
  const client = await pool.connect();
  
  try {
    console.log("Checking for tables that have branch_id column...\n");
    
    // Query to find all tables with branch_id column
    const query = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type
      FROM information_schema.tables t
      INNER JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.column_name = 'branch_id'
      ORDER BY t.table_name;
    `;
    
    const result = await client.query(query);
    
    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} tables with branch_id column:\n`);
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name} (${row.column_name}: ${row.data_type})`);
      });
      console.log("\n");
      
      // Check if any of these tables have asset_id
      console.log("Checking which tables have both asset_id AND branch_id...\n");
      
      const assetRelatedQuery = `
        SELECT 
          t.table_name,
          c1.column_name as col1,
          c2.column_name as col2
        FROM information_schema.tables t
        INNER JOIN information_schema.columns c1 
          ON t.table_name = c1.table_name 
          AND c1.column_name = 'asset_id'
        INNER JOIN information_schema.columns c2 
          ON t.table_name = c2.table_name 
          AND c2.column_name = 'branch_id'
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      `;
      
      const assetResult = await client.query(assetRelatedQuery);
      
      if (assetResult.rows.length > 0) {
        console.log(`Found ${assetResult.rows.length} tables with BOTH asset_id AND branch_id:\n`);
        assetResult.rows.forEach(row => {
          console.log(`  ⚠️  ${row.table_name} - This table may need updates during branch transfer`);
        });
      } else {
        console.log("✅ No tables found with both asset_id and branch_id");
        console.log("   Only tblAssets needs to be updated during branch transfer");
      }
    } else {
      console.log("No tables found with branch_id column");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkBranchRelatedTables();
