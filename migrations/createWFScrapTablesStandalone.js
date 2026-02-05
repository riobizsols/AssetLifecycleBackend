/**
 * Standalone migration script to create workflow scrap tables
 *
 * Creates:
 *  - tblWFScrapSeq
 *  - tblWFScrap_H
 *  - tblWFScrap_D
 *  - tblAssetScrap
 *
 * Run:
 *   node migrations/createWFScrapTablesStandalone.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const runMigration = async () => {
  console.log('Starting migration: Create scrap workflow tables');
  console.log('================================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Creating table: tblWFScrapSeq');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblWFScrapSeq" (
        id VARCHAR(50) PRIMARY KEY,
        asset_type_id VARCHAR(50) NOT NULL,
        wf_steps_id VARCHAR(50) NOT NULL,
        seq_no INTEGER NOT NULL,
        org_id VARCHAR(50) NOT NULL,
        CONSTRAINT fk_wf_scrap_seq_asset_type
          FOREIGN KEY (asset_type_id)
          REFERENCES "tblAssetTypes" (asset_type_id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_wf_scrap_seq_wf_step
          FOREIGN KEY (wf_steps_id)
          REFERENCES "tblWFSteps" (wf_steps_id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_wf_scrap_seq_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE RESTRICT
      );
    `);

    console.log('Creating table: tblWFScrap_H');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblWFScrap_H" (
        id_d VARCHAR(50) PRIMARY KEY,
        assetgroup_id VARCHAR(50) NOT NULL,
        wfscrapseq_id VARCHAR(50) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'IN' CHECK (status IN ('IN','IP','CO','CA','AP')),
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP,
        is_scrap_sales CHAR(1) NOT NULL DEFAULT 'N' CHECK (is_scrap_sales IN ('Y', 'N')),
        CONSTRAINT fk_wf_scrap_h_assetgroup
          FOREIGN KEY (assetgroup_id)
          REFERENCES "tblAssetGroup_H" (assetgroup_h_id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_wf_scrap_h_seq
          FOREIGN KEY (wfscrapseq_id)
          REFERENCES "tblWFScrapSeq" (id)
          ON DELETE RESTRICT
      );
    `);

    console.log('Creating table: tblWFScrap_D');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblWFScrap_D" (
        id VARCHAR(50) PRIMARY KEY,
        wfscrap_h_id VARCHAR(50) NOT NULL,
        job_role_id VARCHAR(50) NOT NULL,
        dept_id VARCHAR(50) NOT NULL,
        seq INTEGER NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'IN' CHECK (status IN ('IN','AP','UA','UR')),
        notes TEXT,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP,
        CONSTRAINT fk_wf_scrap_d_header
          FOREIGN KEY (wfscrap_h_id)
          REFERENCES "tblWFScrap_H" (id_d)
          ON DELETE CASCADE,
        CONSTRAINT fk_wf_scrap_d_job_role
          FOREIGN KEY (job_role_id)
          REFERENCES "tblJobRoles" (job_role_id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_wf_scrap_d_dept
          FOREIGN KEY (dept_id)
          REFERENCES "tblDepartments" (dept_id)
          ON DELETE RESTRICT
      );
    `);

    console.log('Creating table: tblAssetScrap');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblAssetScrap" (
        id VARCHAR(50) PRIMARY KEY,
        asset_group_id VARCHAR(50) NOT NULL,
        asset_id VARCHAR(50) NOT NULL,
        scrap_gen_by VARCHAR(50),
        scrap_gen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        CONSTRAINT fk_asset_scrap_group
          FOREIGN KEY (asset_group_id)
          REFERENCES "tblAssetGroup_H" (assetgroup_h_id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_asset_scrap_asset
          FOREIGN KEY (asset_id)
          REFERENCES "tblAssets" (asset_id)
          ON DELETE RESTRICT
      );
    `);

    // If the tables were created earlier with INTEGER status columns, convert them now.
    // This keeps the script idempotent across environments.
    console.log('Ensuring status columns are VARCHAR(10) with correct defaults...');
    const getColumnUdt = async (tableName, columnName) => {
      const r = await pool.query(
        `
          SELECT udt_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        `,
        [tableName, columnName]
      );
      return r.rows[0]?.udt_name || null;
    };

    const ensureStatusVarchar = async (tableName, columnName, allowed, defaultValue) => {
      const udt = await getColumnUdt(tableName, columnName);
      if (!udt) return;

      // int4/int8 = integer/bigint
      if (udt === 'int4' || udt === 'int8') {
        await pool.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE VARCHAR(10) USING "${columnName}"::text;`);
      }

      // Ensure default + NOT NULL + check constraint (best-effort; ignore if already exists)
      await pool.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT '${defaultValue}';`);
      await pool.query(`UPDATE "${tableName}" SET "${columnName}" = COALESCE("${columnName}", '${defaultValue}') WHERE "${columnName}" IS NULL;`);
      await pool.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET NOT NULL;`);

      // Drop any existing check constraint on this column (unknown name), then add ours.
      // We do this defensively so environments don't diverge.
      const existingChecks = await pool.query(
        `
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = 'public'
            AND rel.relname = $1
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%' || $2 || '%'
        `,
        [tableName, columnName]
      );
      for (const row of existingChecks.rows) {
        // eslint-disable-next-line no-await-in-loop
        await pool.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${row.conname}";`);
      }

      const constraintName = `chk_${tableName.toLowerCase()}_${columnName.toLowerCase()}_status`;
      const allowedList = allowed.map((v) => `'${v}'`).join(',');
      await pool.query(
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" CHECK ("${columnName}" IN (${allowedList}));`
      );
    };

    await ensureStatusVarchar('tblWFScrap_H', 'status', ['IN', 'IP', 'CO', 'CA', 'AP'], 'IN');
    await ensureStatusVarchar('tblWFScrap_D', 'status', ['IN', 'AP', 'UA', 'UR'], 'IN');

    console.log('Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_seq_asset_type ON "tblWFScrapSeq"(asset_type_id, org_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_seq_wf_steps ON "tblWFScrapSeq"(wf_steps_id, org_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_h_assetgroup ON "tblWFScrap_H"(assetgroup_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_h_seq ON "tblWFScrap_H"(wfscrapseq_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_d_header ON "tblWFScrap_D"(wfscrap_h_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_d_job_role ON "tblWFScrap_D"(job_role_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wf_scrap_d_dept ON "tblWFScrap_D"(dept_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_asset_scrap_group ON "tblAssetScrap"(asset_group_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_asset_scrap_asset ON "tblAssetScrap"(asset_id);`);

    console.log('Verifying tables...');
    const verify = async (tableName) => {
      const r = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
        [tableName]
      );
      return r.rows[0]?.exists === true;
    };

    const tables = ['tblWFScrapSeq', 'tblWFScrap_H', 'tblWFScrap_D', 'tblAssetScrap'];
    for (const t of tables) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await verify(t);
      console.log(ok ? `✅ Verified: ${t}` : `❌ Missing: ${t}`);
    }

    console.log('================================================');
    console.log('✅ Migration completed successfully!');
    console.log('================================================\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);

    if (error.code === '23503') {
      console.error('\nForeign key constraint error. Make sure these tables exist with the expected PK columns:');
      console.error('  - tblAssetTypes(asset_type_id)');
      console.error('  - tblWFSteps(wf_steps_id)');
      console.error('  - tblOrgs(org_id)');
      console.error('  - tblAssetGroup_H(assetgroup_h_id)');
      console.error('  - tblJobRoles(job_role_id)');
      console.error('  - tblDepartments(dept_id)');
      console.error('  - tblAssets(asset_id)');
    }

    await pool.end();
    process.exit(1);
  }
};

runMigration();

