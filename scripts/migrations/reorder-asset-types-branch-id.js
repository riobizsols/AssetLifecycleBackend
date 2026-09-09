/**
 * Place branch_id physically between org_id and asset_type_id on tblAssetTypes.
 * Run: node scripts/migrations/reorder-asset-types-branch-id.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.GENERIC_URL;

async function reorder(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');

    // Ensure column exists first
    await client.query(`
      ALTER TABLE "tblAssetTypes"
      ADD COLUMN IF NOT EXISTS branch_id character varying(10)
    `);

    const pos = await client.query(`
      SELECT column_name, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblAssetTypes'
      ORDER BY ordinal_position
    `);
    const names = pos.rows.map((r) => r.column_name);
    const orgIdx = names.indexOf('org_id');
    const branchIdx = names.indexOf('branch_id');
    const atIdx = names.indexOf('asset_type_id');

    if (orgIdx >= 0 && branchIdx === orgIdx + 1 && atIdx === orgIdx + 2) {
      console.log('Already ordered: org_id, branch_id, asset_type_id');
      await client.query('COMMIT');
      return;
    }

    // Build target column order: org_id, branch_id, asset_type_id, then the rest (excluding branch_id)
    const rest = names.filter((n) => n !== 'org_id' && n !== 'branch_id' && n !== 'asset_type_id');
    const ordered = ['org_id', 'branch_id', 'asset_type_id', ...rest];

    // Capture column defs
    const cols = await client.query(`
      SELECT a.attname AS column_name,
             pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
             a.attnotnull AS not_null,
             pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relname = 'tblAssetTypes'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `);
    const defByName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r]));

    const colSql = ordered
      .map((name) => {
        const d = defByName[name];
        if (!d) throw new Error(`Missing column def for ${name}`);
        let sql = `"${name}" ${d.data_type}`;
        if (d.not_null) sql += ' NOT NULL';
        if (d.default_expr) sql += ` DEFAULT ${d.default_expr}`;
        return sql;
      })
      .join(',\n      ');

    // Drop FK constraint we may have added on branch_id (recreated later)
    await client.query(`
      ALTER TABLE "tblAssetTypes" DROP CONSTRAINT IF EXISTS "fk_tblassettypes_branch_id"
    `);

    // Find inbound FKs referencing tblAssetTypes
    const inbound = await client.query(`
      SELECT con.conname,
             quote_ident(n.nspname) AS schema_name,
             quote_ident(rel.relname) AS table_name,
             pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      JOIN pg_class ref ON ref.oid = con.confrelid
      JOIN pg_namespace rn ON rn.oid = ref.relnamespace
      WHERE con.contype = 'f'
        AND rn.nspname = 'public'
        AND ref.relname = 'tblAssetTypes'
    `);

    for (const fk of inbound.rows) {
      await client.query(
        `ALTER TABLE ${fk.schema_name}.${fk.table_name} DROP CONSTRAINT IF EXISTS "${fk.conname}"`
      );
    }

    // Capture outbound FKs / checks / uniques / PK from tblAssetTypes (except system)
    const localCons = await client.query(`
      SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'tblAssetTypes'
        AND con.contype IN ('p', 'u', 'c', 'f')
    `);

    for (const c of localCons.rows) {
      await client.query(`ALTER TABLE "tblAssetTypes" DROP CONSTRAINT IF EXISTS "${c.conname}"`);
    }

    await client.query(`DROP TABLE IF EXISTS "tblAssetTypes__reorder"`);
    await client.query(`
      CREATE TABLE "tblAssetTypes__reorder" (
        ${colSql}
      )
    `);

    const selectList = ordered.map((n) => `"${n}"`).join(', ');
    await client.query(`
      INSERT INTO "tblAssetTypes__reorder" (${selectList})
      SELECT ${selectList} FROM "tblAssetTypes"
    `);

    await client.query(`DROP TABLE "tblAssetTypes"`);
    await client.query(`ALTER TABLE "tblAssetTypes__reorder" RENAME TO "tblAssetTypes"`);

    // Recreate local constraints (PK/unique/check/FK)
    for (const c of localCons.rows) {
      try {
        await client.query(
          `ALTER TABLE "tblAssetTypes" ADD CONSTRAINT "${c.conname}" ${c.def}`
        );
      } catch (err) {
        console.warn(`Could not recreate ${c.conname}:`, err.message);
      }
    }

    // Recreate inbound FKs
    for (const fk of inbound.rows) {
      try {
        await client.query(
          `ALTER TABLE ${fk.schema_name}.${fk.table_name} ADD CONSTRAINT "${fk.conname}" ${fk.def}`
        );
      } catch (err) {
        console.warn(`Could not recreate inbound ${fk.conname}:`, err.message);
      }
    }

    // Ensure branch FK
    try {
      await client.query(`
        ALTER TABLE "tblAssetTypes"
          ADD CONSTRAINT "fk_tblassettypes_branch_id"
          FOREIGN KEY (branch_id)
          REFERENCES "tblBranches" (branch_id)
          ON UPDATE CASCADE
          ON DELETE SET NULL
      `);
    } catch (err) {
      // may already exist from localCons recreate
      if (!/already exists/i.test(err.message)) {
        console.warn('branch FK:', err.message);
      }
    }

    await client.query('COMMIT');

    const after = await client.query(`
      SELECT column_name, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tblAssetTypes'
      ORDER BY ordinal_position
      LIMIT 5
    `);
    console.log(
      'OK reorder on',
      connectionString.replace(/:[^:@/]+@/, ':***@'),
      '\n',
      after.rows.map((r) => `${r.ordinal_position}: ${r.column_name}`).join(', ')
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

(async () => {
  if (!DATABASE_URL) {
    console.error('No DATABASE_URL / GENERIC_URL set');
    process.exit(1);
  }
  await reorder(DATABASE_URL);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
