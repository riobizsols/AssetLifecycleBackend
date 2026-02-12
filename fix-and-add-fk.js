require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.GENERIC_URL,
});

async function fixDataAndAddFK() {
  const client = await pool.connect();
  
  try {
    console.log("Step 1: Finding and fixing invalid cost_center_code references...\n");
    
    // First, find the invalid references
    const findInvalidQuery = `
      SELECT 
        asset_id,
        description,
        cost_center_code
      FROM "tblAssets"
      WHERE cost_center_code IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 
          FROM "tblCostCenter" 
          WHERE cc_id = "tblAssets".cost_center_code
        )
      ORDER BY cost_center_code, asset_id;
    `;
    
    const invalidResult = await client.query(findInvalidQuery);
    
    if (invalidResult.rows.length > 0) {
      console.log(`Found ${invalidResult.rows.length} assets with invalid cost_center_code:\n`);
      invalidResult.rows.forEach(row => {
        console.log(`  - ${row.asset_id}: ${row.description} (cost_center_code: ${row.cost_center_code})`);
      });
      console.log("");
      
      // Fix the invalid references
      const fixQuery = `
        UPDATE "tblAssets"
        SET cost_center_code = NULL,
            changed_on = CURRENT_TIMESTAMP
        WHERE cost_center_code IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 
            FROM "tblCostCenter" 
            WHERE cc_id = "tblAssets".cost_center_code
          );
      `;
      
      const fixResult = await client.query(fixQuery);
      console.log(`✓ Set cost_center_code to NULL for ${fixResult.rowCount} assets\n`);
    } else {
      console.log("✓ No invalid cost_center_code references found\n");
    }
    
    console.log("Step 2: Adding foreign key constraint...\n");
    
    // Drop the constraint if it exists
    await client.query(`
      ALTER TABLE "tblAssets" 
      DROP CONSTRAINT IF EXISTS fk_assets_cost_center;
    `);
    
    // Add the foreign key constraint
    await client.query(`
      ALTER TABLE "tblAssets"
      ADD CONSTRAINT fk_assets_cost_center
      FOREIGN KEY (cost_center_code)
      REFERENCES "tblCostCenter" (cc_id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
    `);
    
    console.log("✓ Foreign key constraint added successfully!\n");
    
    // Verify the constraint
    const verifyQuery = `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'tblAssets'
        AND tc.constraint_name = 'fk_assets_cost_center';
    `;
    
    const verifyResult = await client.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      const fk = verifyResult.rows[0];
      console.log("Constraint Details:");
      console.log(`  Constraint Name: ${fk.constraint_name}`);
      console.log(`  Table: ${fk.table_name}`);
      console.log(`  Column: ${fk.column_name}`);
      console.log(`  References: ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      console.log(`  On Update: ${fk.update_rule}`);
      console.log(`  On Delete: ${fk.delete_rule}`);
      console.log("\n✅ All done! Data cleaned and foreign key constraint added successfully.");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixDataAndAddFK();
