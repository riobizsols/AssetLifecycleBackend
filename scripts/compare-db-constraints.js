#!/usr/bin/env node
/**
 * Compare primary keys and foreign keys between tenant DB and hospitality reference.
 * Usage: node scripts/compare-db-constraints.js [tenant_db_name]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');

const tenantDb = (process.argv[2] || 'kia_db').toLowerCase();

function refUrl() {
  return process.env.TENANT_SCHEMA_REFERENCE_URL || process.env.DATABASE_URL;
}

function tenUrl(name) {
  return (process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL).replace(
    /\/([^/?]+)(\?.*)?$/i,
    `/${name}$2`,
  );
}

function clientOpts(url) {
  return buildPoolConfig(url, { connectionTimeoutMillis: 20000 });
}

async function listPrimaryKeys(c) {
  const { rows } = await c.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.table_name, tc.constraint_name
    ORDER BY tc.table_name
  `);
  return rows;
}

async function listForeignKeys(c) {
  const { rows } = await c.query(`
    SELECT
      con.conname AS constraint_name,
      rel.relname AS table_name,
      frel.relname AS foreign_table_name,
      string_agg(sa.attname, ', ' ORDER BY u.ordinality) AS source_columns,
      string_agg(fa.attname, ', ' ORDER BY u.ordinality) AS target_columns,
      CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS update_rule,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS delete_rule
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ordinality)
    JOIN pg_attribute sa ON sa.attnum = u.attnum AND sa.attrelid = con.conrelid
    CROSS JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS uf(attnum, ordinality)
    JOIN pg_attribute fa ON fa.attnum = uf.attnum AND fa.attrelid = con.confrelid
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND u.ordinality = uf.ordinality
    GROUP BY con.conname, rel.relname, frel.relname, con.confupdtype, con.confdeltype
    ORDER BY rel.relname, con.conname
  `);
  return rows;
}

function pkSignature(row) {
  return `${row.table_name}|${row.columns}`;
}

function fkSignature(row) {
  return `${row.table_name}|${row.source_columns}|${row.foreign_table_name}|${row.target_columns}|${row.update_rule}|${row.delete_rule}`;
}

function diffSets(refRows, tenRows, signatureFn) {
  const refMap = new Map(refRows.map((r) => [signatureFn(r), r]));
  const tenMap = new Map(tenRows.map((r) => [signatureFn(r), r]));

  const missingInTenant = [];
  for (const [sig, row] of refMap) {
    if (!tenMap.has(sig)) missingInTenant.push(row);
  }

  const extraInTenant = [];
  for (const [sig, row] of tenMap) {
    if (!refMap.has(sig)) extraInTenant.push(row);
  }

  return { missingInTenant, extraInTenant, matched: refMap.size - missingInTenant.length };
}

async function checkFkViolations(c) {
  const { rows: fks } = await c.query(`
    SELECT
      con.conname AS constraint_name,
      rel.relname AS table_name,
      frel.relname AS foreign_table_name,
      string_agg(sa.attname, ', ' ORDER BY u.ordinality) AS source_columns,
      string_agg(fa.attname, ', ' ORDER BY u.ordinality) AS target_columns
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ordinality)
    JOIN pg_attribute sa ON sa.attnum = u.attnum AND sa.attrelid = con.conrelid
    CROSS JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS uf(attnum, ordinality)
    JOIN pg_attribute fa ON fa.attnum = uf.attnum AND fa.attrelid = con.confrelid
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND u.ordinality = uf.ordinality
    GROUP BY con.conname, rel.relname, frel.relname
    ORDER BY rel.relname, con.conname
  `);

  const violations = [];
  for (const fk of fks) {
    const srcCols = fk.source_columns.split(', ').map((c) => `"${c}"`).join(', ');
    const tgtCols = fk.target_columns.split(', ').map((c) => `"${c}"`).join(', ');
    const sql = `
      SELECT COUNT(*)::int AS orphan_count
      FROM "${fk.table_name}" src
      LEFT JOIN "${fk.foreign_table_name}" tgt
        ON (${fk.source_columns.split(', ').map((c, i) => `src."${c}" = tgt."${fk.target_columns.split(', ')[i]}"`).join(' AND ')})
      WHERE (${srcCols}) IS NOT NULL
        AND (${tgtCols}) IS NULL
    `;
    try {
      const { rows } = await c.query(sql);
      if (rows[0].orphan_count > 0) {
        violations.push({
          constraint: fk.constraint_name,
          table: fk.table_name,
          references: fk.foreign_table_name,
          orphanCount: rows[0].orphan_count,
        });
      }
    } catch (err) {
      violations.push({
        constraint: fk.constraint_name,
        table: fk.table_name,
        references: fk.foreign_table_name,
        error: err.message,
      });
    }
  }
  return violations;
}

async function main() {
  const ref = new Client(clientOpts(refUrl()));
  const ten = new Client(clientOpts(tenUrl(tenantDb)));

  await ref.connect();
  await ten.connect();

  const refDb = (await ref.query('SELECT current_database() AS db')).rows[0].db;
  const tenDb = (await ten.query('SELECT current_database() AS db')).rows[0].db;

  const [refPk, tenPk, refFk, tenFk] = await Promise.all([
    listPrimaryKeys(ref),
    listPrimaryKeys(ten),
    listForeignKeys(ref),
    listForeignKeys(ten),
  ]);

  const pkDiff = diffSets(refPk, tenPk, pkSignature);
  const fkDiff = diffSets(refFk, tenFk, fkSignature);

  const [refFkViolations, tenFkViolations] = await Promise.all([
    checkFkViolations(ref),
    checkFkViolations(ten),
  ]);

  const report = {
    tenantDb: tenDb,
    referenceDb: refDb,
    generatedAt: new Date().toISOString(),
    primaryKeys: {
      referenceCount: refPk.length,
      tenantCount: tenPk.length,
      matched: pkDiff.matched,
      missingInTenant: pkDiff.missingInTenant,
      extraInTenant: pkDiff.extraInTenant,
    },
    foreignKeys: {
      referenceCount: refFk.length,
      tenantCount: tenFk.length,
      matched: fkDiff.matched,
      missingInTenant: fkDiff.missingInTenant,
      extraInTenant: fkDiff.extraInTenant,
    },
    dataIntegrity: {
      referenceFkViolations: refFkViolations,
      tenantFkViolations: tenFkViolations,
    },
  };

  report.healthy =
    pkDiff.missingInTenant.length === 0 &&
    fkDiff.missingInTenant.length === 0 &&
    tenFkViolations.length === 0;

  console.log(JSON.stringify(report, null, 2));

  console.log('\n========== CONSTRAINT COMPARISON ==========');
  console.log(`Tenant: ${tenDb} vs Reference: ${refDb}`);
  console.log(`Primary keys  — ref: ${refPk.length}, tenant: ${tenPk.length}, matched: ${pkDiff.matched}`);
  console.log(`Foreign keys  — ref: ${refFk.length}, tenant: ${tenFk.length}, matched: ${fkDiff.matched}`);

  if (pkDiff.missingInTenant.length) {
    console.log(`\n❌ Missing PKs in tenant (${pkDiff.missingInTenant.length}):`);
    pkDiff.missingInTenant.slice(0, 15).forEach((r) => {
      console.log(`  - ${r.table_name} (${r.columns})`);
    });
  }

  if (fkDiff.missingInTenant.length) {
    console.log(`\n❌ Missing FKs in tenant (${fkDiff.missingInTenant.length}):`);
    fkDiff.missingInTenant.slice(0, 15).forEach((r) => {
      console.log(`  - ${r.table_name}.${r.source_columns} -> ${r.foreign_table_name}.${r.target_columns}`);
    });
  }

  if (pkDiff.extraInTenant.length) {
    console.log(`\n⚠️ Extra PKs in tenant (${pkDiff.extraInTenant.length}):`);
    pkDiff.extraInTenant.slice(0, 10).forEach((r) => {
      console.log(`  - ${r.table_name} (${r.columns})`);
    });
  }

  if (fkDiff.extraInTenant.length) {
    console.log(`\n⚠️ Extra FKs in tenant (${fkDiff.extraInTenant.length}):`);
    fkDiff.extraInTenant.slice(0, 10).forEach((r) => {
      console.log(`  - ${r.table_name}.${r.source_columns} -> ${r.foreign_table_name}.${r.target_columns}`);
    });
  }

  if (tenFkViolations.length) {
    console.log(`\n❌ FK data violations in tenant (${tenFkViolations.length}):`);
    tenFkViolations.slice(0, 15).forEach((v) => {
      console.log(`  - ${v.constraint || v.table}: ${JSON.stringify(v)}`);
    });
  } else {
    console.log('\n✅ No FK orphan rows in tenant database');
  }

  if (report.healthy) {
    console.log('\n✅ Tenant PK/FK structure matches hospitality and data integrity checks passed.');
  } else {
    process.exit(1);
  }

  await ref.end();
  await ten.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
