/**
 * Standalone migration:
 * Ungroups all assets by:
 * 1. Setting group_id = NULL for all assets in tblAssets
 * 2. Setting group_id = NULL in tblWFAssetMaintSch_H (to clear foreign key references)
 * 3. Deleting all records from tblAssetGroup_D
 * 4. Deleting all records from tblAssetGroup_H
 *
 * Run:
 *   node migrations/ungroupAllAssetsStandalone.js
 */
const { Pool } = require("pg");
require("dotenv").config();

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("🔄 Ungrouping all assets and cleaning up groups...");

    await pool.query('BEGIN');

    // Step 1: Count assets that will be ungrouped
    const countResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "tblAssets" 
      WHERE group_id IS NOT NULL
    `);
    const assetsToUngroup = countResult.rows[0].count;
    console.log(`📊 Found ${assetsToUngroup} assets to ungroup`);

    // Step 2: Count maintenance schedules that reference groups
    const maintCountResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "tblWFAssetMaintSch_H" 
      WHERE group_id IS NOT NULL
    `);
    const maintSchedulesToUpdate = maintCountResult.rows[0].count;
    console.log(`📊 Found ${maintSchedulesToUpdate} maintenance schedules referencing groups`);

    // Step 3: Count groups that will be deleted
    const groupCountResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "tblAssetGroup_H"
    `);
    const groupsToDelete = groupCountResult.rows[0].count;
    console.log(`📊 Found ${groupsToDelete} asset groups to delete`);

    // Step 4: Set group_id = NULL for all assets
    console.log("🔄 Setting group_id = NULL for all assets...");
    const ungroupResult = await pool.query(`
      UPDATE "tblAssets"
      SET group_id = NULL,
          changed_on = CURRENT_TIMESTAMP
      WHERE group_id IS NOT NULL
    `);
    console.log(`✅ Ungrouped ${ungroupResult.rowCount} assets`);

    // Step 5: Clear group_id from maintenance schedules (to remove foreign key references)
    if (maintSchedulesToUpdate > 0) {
      console.log("🔄 Clearing group_id from maintenance schedules...");
      const maintUpdateResult = await pool.query(`
        UPDATE "tblWFAssetMaintSch_H"
        SET group_id = NULL,
            changed_on = CURRENT_TIMESTAMP
        WHERE group_id IS NOT NULL
      `);
      console.log(`✅ Cleared group_id from ${maintUpdateResult.rowCount} maintenance schedules`);
    }

    // Step 6: Delete all group details
    console.log("🔄 Deleting all group details...");
    const deleteDetailsResult = await pool.query(`
      DELETE FROM "tblAssetGroup_D"
    `);
    console.log(`✅ Deleted ${deleteDetailsResult.rowCount} group detail records`);

    // Step 7: Delete all group headers (now safe since FK references are cleared)
    console.log("🔄 Deleting all group headers...");
    const deleteHeadersResult = await pool.query(`
      DELETE FROM "tblAssetGroup_H"
    `);
    console.log(`✅ Deleted ${deleteHeadersResult.rowCount} group headers`);

    await pool.query('COMMIT');

    // Verify all assets are now ungrouped
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM "tblAssets" 
      WHERE group_id IS NOT NULL
    `);
    const remainingGrouped = verifyResult.rows[0].count;

    console.log("✅ Migration complete.");
    console.log(`📊 Summary:`);
    console.log(`   - Ungrouped ${ungroupResult.rowCount} assets`);
    console.log(`   - Cleared group_id from ${maintSchedulesToUpdate} maintenance schedules`);
    console.log(`   - Deleted ${deleteDetailsResult.rowCount} group detail records`);
    console.log(`   - Deleted ${deleteHeadersResult.rowCount} group headers`);
    console.log(`   - Remaining grouped assets: ${remainingGrouped}`);
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error("❌ Migration failed:", e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
