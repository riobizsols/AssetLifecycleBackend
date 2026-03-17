#!/usr/bin/env node

/**
 * Compare inspection-related tables between assetLifecycle and hospitality databases.
 *
 * Reads connection strings from:
 * - GENERIC_URL  → assetLifecycle DB
 * - DATABASE_URL → hospitality DB
 *
 * For each DB, fetches:
 * - Tables: names in INSPECTION_SCHEDULING_TABLES.md plus %Insp% workflow tables
 * - Columns: name, data_type, is_nullable, character_maximum_length
 * - Constraints: primary keys and foreign keys
 *
 * Prints a diff showing:
 * - Tables missing in hospitality
 * - Columns missing or with different types
 * - PK/FK constraints missing in hospitality
 *
 * Usage:
 *   node scripts/compare-inspection-schemas.js
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const assetLifecycleUrl = process.env.GENERIC_URL;
const hospitalityUrl = process.env.DATABASE_URL;

if (!assetLifecycleUrl || !hospitalityUrl) {
  console.error('❌ GENERIC_URL or DATABASE_URL not set in .env');
  process.exit(1);
}

const TABLES_OF_INTEREST = [
  'tblassettypes',
  'tblaat_insp_freq',
  'tblaatinspchecklist',
  'tbluom',
  'tblassets',
  'tblwfatinspseqs',
  'tblwfinspjobrole',
  'tblwfaatinspsch_h',
  'tblwfaatinspsch_d',
  'tblaat_insp_sch',
  // history / extra tables if present
  'tblwfaatinsphist',
  'tblaat_insp_rec'
];

async function getSchemaSnapshot(pool, label) {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (
          LOWER(table_name) = ANY($1)
          OR LOWER(table_name) LIKE '%insp%'
        )
      ORDER BY table_name
      `,
      [TABLES_OF_INTEREST]
    );

    const tables = tablesRes.rows.map(r => r.table_name);

    const columnsRes = await client.query(
      `
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position
      `,
      [tables]
    );

    const constraintsRes = await client.query(
      `
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      LEFT JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      LEFT JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
        AND rc.unique_constraint_schema = ccu.constraint_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = ANY($1)
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
      `,
      [tables]
    );

    return { label, tables, columns: columnsRes.rows, constraints: constraintsRes.rows };
  } finally {
    client.release();
  }
}

function indexColumns(rows) {
  const byTable = {};
  for (const r of rows) {
    const t = r.table_name;
    if (!byTable[t]) byTable[t] = {};
    byTable[t][r.column_name] = {
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      character_maximum_length: r.character_maximum_length
    };
  }
  return byTable;
}

function indexConstraints(rows) {
  const byTable = {};
  for (const r of rows) {
    const t = r.table_name;
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push(r);
  }
  return byTable;
}

function compareSchemas(assetSchema, hospSchema) {
  const assetCols = indexColumns(assetSchema.columns);
  const hospCols = indexColumns(hospSchema.columns);
  const assetCons = indexConstraints(assetSchema.constraints);
  const hospCons = indexConstraints(hospSchema.constraints);

  const allTables = new Set([...assetSchema.tables, ...hospSchema.tables]);

  const report = [];

  for (const table of Array.from(allTables).sort()) {
    const inAsset = assetSchema.tables.includes(table);
    const inHosp = hospSchema.tables.includes(table);

    if (inAsset && !inHosp) {
      report.push(`TABLE MISSING in hospitality: ${table}`);
      continue;
    }
    if (!inAsset && inHosp) {
      report.push(`TABLE ONLY in hospitality (not in assetLifecycle): ${table}`);
      continue;
    }

    // Compare columns
    const aCols = assetCols[table] || {};
    const hCols = hospCols[table] || {};
    const colNames = new Set([...Object.keys(aCols), ...Object.keys(hCols)]);
    for (const col of Array.from(colNames).sort()) {
      const a = aCols[col];
      const h = hCols[col];
      if (a && !h) {
        report.push(`COLUMN MISSING in hospitality: ${table}.${col} (${a.data_type}${a.character_maximum_length ? `(${a.character_maximum_length})` : ''}, nullable=${a.is_nullable})`);
      } else if (!a && h) {
        report.push(`COLUMN ONLY in hospitality (not in assetLifecycle): ${table}.${col} (${h.data_type}${h.character_maximum_length ? `(${h.character_maximum_length})` : ''}, nullable=${h.is_nullable})`);
      } else if (a && h) {
        const typeDiff =
          a.data_type !== h.data_type ||
          String(a.character_maximum_length || '') !== String(h.character_maximum_length || '') ||
          a.is_nullable !== h.is_nullable;
        if (typeDiff) {
          report.push(
            `COLUMN TYPE DIFF ${table}.${col}:\n` +
            `  assetLifecycle: ${a.data_type}${a.character_maximum_length ? `(${a.character_maximum_length})` : ''}, nullable=${a.is_nullable}\n` +
            `  hospitality : ${h.data_type}${h.character_maximum_length ? `(${h.character_maximum_length})` : ''}, nullable=${h.is_nullable}`
          );
        }
      }
    }

    // Compare constraints (simplified: by name + type + columns)
    const aCons = (assetCons[table] || []).map(c => ({
      key: `${c.constraint_type}|${c.constraint_name}|${c.column_name || ''}|${c.foreign_table_name || ''}|${c.foreign_column_name || ''}`,
      raw: c
    }));
    const hCons = (hospCons[table] || []).map(c => ({
      key: `${c.constraint_type}|${c.constraint_name}|${c.column_name || ''}|${c.foreign_table_name || ''}|${c.foreign_column_name || ''}`,
      raw: c
    }));

    const aSet = new Set(aCons.map(c => c.key));
    const hSet = new Set(hCons.map(c => c.key));

    for (const c of aCons) {
      if (!hSet.has(c.key)) {
        report.push(`CONSTRAINT MISSING in hospitality (table ${table}): ${c.key}`);
      }
    }
    for (const c of hCons) {
      if (!aSet.has(c.key)) {
        report.push(`CONSTRAINT ONLY in hospitality (table ${table}): ${c.key}`);
      }
    }
  }

  return report;
}

async function main() {
  console.log('🔍 Comparing inspection-related schemas between assetLifecycle and hospitality...\n');
  const assetPool = new Pool({ connectionString: assetLifecycleUrl, ssl: false });
  const hospPool = new Pool({ connectionString: hospitalityUrl, ssl: false });

  try {
    const [assetSchema, hospSchema] = await Promise.all([
      getSchemaSnapshot(assetPool, 'assetLifecycle'),
      getSchemaSnapshot(hospPool, 'hospitality')
    ]);

    console.log('assetLifecycle tables:', assetSchema.tables);
    console.log('hospitality  tables:', hospSchema.tables);
    console.log('\n=== DIFF (what hospitality is missing / different) ===\n');

    const report = compareSchemas(assetSchema, hospSchema);
    if (!report.length) {
      console.log('✅ No differences found for inspection-related tables.');
    } else {
      for (const line of report) {
        console.log(line);
      }
    }
  } catch (err) {
    console.error('❌ Error comparing schemas:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await assetPool.end();
    await hospPool.end();
  }
}

main();

