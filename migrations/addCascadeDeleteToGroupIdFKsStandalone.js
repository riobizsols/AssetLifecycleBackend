/**
 * Standalone migration:
 * Adds CASCADE ON DELETE (SET NULL) to foreign key constraints for:
 * - tblWFAssetMaintSch_H.group_id -> tblAssetGroup_H.assetgroup_h_id
 * - tblAssets.group_id -> tblAssetGroup_H.assetgroup_h_id
 *
 * This ensures that when a group is deleted from tblAssetGroup_H,
 * the group_id columns in these tables are automatically set to NULL.
 *
 * Run:
 *   node migrations/addCascadeDeleteToGroupIdFKsStandalone.js
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
    console.log("🔄 Adding CASCADE ON DELETE to group_id foreign keys...");

    await pool.query('BEGIN');

    // Find constraint names for tblWFAssetMaintSch_H.group_id
    const maintSchConstraint = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'tblWFAssetMaintSch_H'
        AND kcu.column_name = 'group_id'
        AND ccu.table_name = 'tblAssetGroup_H'
    `);

    // Find constraint names for tblAssets.group_id
    const assetsConstraint = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'tblAssets'
        AND kcu.column_name = 'group_id'
        AND ccu.table_name = 'tblAssetGroup_H'
    `);

    // Check if columns are nullable to determine if we should use SET NULL or CASCADE
    const maintSchNullable = await pool.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblWFAssetMaintSch_H'
        AND column_name = 'group_id'
    `);

    const assetsNullable = await pool.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblAssets'
        AND column_name = 'group_id'
    `);

    // Process tblWFAssetMaintSch_H.group_id constraint
    if (maintSchConstraint.rows.length > 0) {
      const constraint = maintSchConstraint.rows[0];
      const constraintName = constraint.constraint_name;
      const currentDeleteRule = constraint.delete_rule;
      const isNullable = maintSchNullable.rows[0]?.is_nullable === 'YES';

      console.log(`📋 Found constraint: ${constraintName} on tblWFAssetMaintSch_H.group_id`);
      console.log(`   Current delete rule: ${currentDeleteRule}`);
      console.log(`   Column nullable: ${isNullable}`);

      if (currentDeleteRule !== 'SET NULL' && currentDeleteRule !== 'CASCADE') {
        const deleteAction = isNullable ? 'SET NULL' : 'CASCADE';
        console.log(`🔄 Dropping constraint ${constraintName}...`);
        await pool.query(`
          ALTER TABLE "tblWFAssetMaintSch_H"
          DROP CONSTRAINT "${constraintName}"
        `);

        console.log(`🔄 Recreating constraint with ON DELETE ${deleteAction}...`);
        await pool.query(`
          ALTER TABLE "tblWFAssetMaintSch_H"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY (group_id)
          REFERENCES "tblAssetGroup_H"(assetgroup_h_id)
          ON DELETE ${deleteAction}
        `);
        console.log(`✅ Updated constraint ${constraintName} with ON DELETE ${deleteAction}`);
      } else {
        console.log(`✅ Constraint ${constraintName} already has ON DELETE ${currentDeleteRule}`);
      }
    } else {
      console.log("⚠️  No foreign key constraint found for tblWFAssetMaintSch_H.group_id");
    }

    // Process tblAssets.group_id constraint
    if (assetsConstraint.rows.length > 0) {
      const constraint = assetsConstraint.rows[0];
      const constraintName = constraint.constraint_name;
      const currentDeleteRule = constraint.delete_rule;
      const isNullable = assetsNullable.rows[0]?.is_nullable === 'YES';

      console.log(`📋 Found constraint: ${constraintName} on tblAssets.group_id`);
      console.log(`   Current delete rule: ${currentDeleteRule}`);
      console.log(`   Column nullable: ${isNullable}`);

      if (currentDeleteRule !== 'SET NULL' && currentDeleteRule !== 'CASCADE') {
        const deleteAction = isNullable ? 'SET NULL' : 'CASCADE';
        console.log(`🔄 Dropping constraint ${constraintName}...`);
        await pool.query(`
          ALTER TABLE "tblAssets"
          DROP CONSTRAINT "${constraintName}"
        `);

        console.log(`🔄 Recreating constraint with ON DELETE ${deleteAction}...`);
        await pool.query(`
          ALTER TABLE "tblAssets"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY (group_id)
          REFERENCES "tblAssetGroup_H"(assetgroup_h_id)
          ON DELETE ${deleteAction}
        `);
        console.log(`✅ Updated constraint ${constraintName} with ON DELETE ${deleteAction}`);
      } else {
        console.log(`✅ Constraint ${constraintName} already has ON DELETE ${currentDeleteRule}`);
      }
    } else {
      console.log("⚠️  No foreign key constraint found for tblAssets.group_id");
    }

    await pool.query('COMMIT');

    console.log("✅ Migration complete.");
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
