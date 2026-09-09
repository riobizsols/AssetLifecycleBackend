#!/usr/bin/env node
/**
 * Compare abcd_db (new tenant) against bannari_db (reference).
 * Usage: node scripts/compare-abcd-vs-bannari.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const REF_DB = process.argv[2] || 'bannari_db';
const TARGET_DB = process.argv[3] || 'abcd_db';

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?|$)/, `/${name}$2`);
}

async function listTables(pool) {
  const { rows } = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  return rows;
}

async function listColumns(pool) {
  const { rows } = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name,
           character_maximum_length, is_nullable, column_default,
           ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  return rows;
}

async function listConstraints(pool) {
  const { rows } = await pool.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
           string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `);
  return rows;
}

async function listIndexes(pool) {
  const { rows } = await pool.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);
  return rows;
}

function colKey(c) {
  return `${c.table_name}.${c.column_name}`;
}

function colSig(c) {
  return `${c.data_type}|${c.udt_name}|${c.character_maximum_length || ''}|${c.is_nullable}`;
}

function constraintKey(c) {
  return `${c.table_name}|${c.constraint_type}|${c.columns || ''}`;
}

async function main() {
  const refPool = new Pool({ connectionString: dbUrl(REF_DB), ssl: false, connectionTimeoutMillis: 20000 });
  const tgtPool = new Pool({ connectionString: dbUrl(TARGET_DB), ssl: false, connectionTimeoutMillis: 20000 });

  try {
    const [refTables, tgtTables, refCols, tgtCols, refCons, tgtCons, refIdx, tgtIdx] = await Promise.all([
      listTables(refPool),
      listTables(tgtPool),
      listColumns(refPool),
      listColumns(tgtPool),
      listConstraints(refPool),
      listConstraints(tgtPool),
      listIndexes(refPool),
      listIndexes(tgtPool),
    ]);

    const refTableNames = refTables.map((t) => t.table_name);
    const tgtTableNames = tgtTables.map((t) => t.table_name);
    const refTableSet = new Set(refTableNames);
    const tgtTableSet = new Set(tgtTableNames);

    const missingTables = refTableNames.filter((t) => !tgtTableSet.has(t));
    const extraTables = tgtTableNames.filter((t) => !refTableSet.has(t));

    const refColMap = new Map(refCols.map((c) => [colKey(c), c]));
    const tgtColMap = new Map(tgtCols.map((c) => [colKey(c), c]));

    const missingColumns = [];
    const typeMismatches = [];
    for (const [key, ref] of refColMap) {
      if (!tgtTableSet.has(ref.table_name)) continue; // whole table missing already reported
      const tgt = tgtColMap.get(key);
      if (!tgt) {
        missingColumns.push(ref);
      } else if (colSig(ref) !== colSig(tgt)) {
        typeMismatches.push({ table: ref.table_name, column: ref.column_name, ref: colSig(ref), target: colSig(tgt) });
      }
    }

    const extraColumns = [];
    for (const [key, tgt] of tgtColMap) {
      if (!refTableSet.has(tgt.table_name)) continue;
      if (!refColMap.has(key)) extraColumns.push(tgt);
    }

    const refConsSet = new Set(refCons.map(constraintKey));
    const tgtConsSet = new Set(tgtCons.map(constraintKey));
    const missingConstraints = refCons.filter((c) => tgtTableSet.has(c.table_name) && !tgtConsSet.has(constraintKey(c)));

    const refIdxNames = new Set(refIdx.map((i) => `${i.tablename}.${i.indexname}`));
    const tgtIdxNames = new Set(tgtIdx.map((i) => `${i.tablename}.${i.indexname}`));
    const missingIndexes = refIdx.filter(
      (i) => tgtTableSet.has(i.tablename) && !tgtIdxNames.has(`${i.tablename}.${i.indexname}`),
    );

    const sharedTables = refTableNames.filter((t) => tgtTableSet.has(t));

    console.log('══════════════════════════════════════════════════════');
    console.log(`Schema compare: ${TARGET_DB} vs reference ${REF_DB}`);
    console.log('══════════════════════════════════════════════════════');
    console.log(`Reference tables/views: ${refTables.length}`);
    console.log(`Target tables/views:    ${tgtTables.length}`);
    console.log(`Shared objects:         ${sharedTables.length}`);
    console.log(`Missing in ${TARGET_DB}:  ${missingTables.length} tables`);
    console.log(`Extra in ${TARGET_DB}:    ${extraTables.length} tables`);
    console.log(`Missing columns:        ${missingColumns.length}`);
    console.log(`Extra columns:          ${extraColumns.length}`);
    console.log(`Type mismatches:        ${typeMismatches.length}`);
    console.log(`Missing constraints:    ${missingConstraints.length}`);
    console.log(`Missing indexes:        ${missingIndexes.length}`);
    console.log('');

    if (missingTables.length) {
      console.log(`--- TABLES/VIEWS missing in ${TARGET_DB} (${missingTables.length}) ---`);
      for (const t of missingTables) {
        const meta = refTables.find((r) => r.table_name === t);
        console.log(`  [${meta?.table_type || '?'}] ${t}`);
      }
      console.log('');
    }

    if (extraTables.length) {
      console.log(`--- TABLES/VIEWS only in ${TARGET_DB} (${extraTables.length}) ---`);
      for (const t of extraTables) {
        const meta = tgtTables.find((r) => r.table_name === t);
        console.log(`  [${meta?.table_type || '?'}] ${t}`);
      }
      console.log('');
    }

    if (missingColumns.length) {
      console.log(`--- COLUMNS missing in ${TARGET_DB} (${missingColumns.length}) ---`);
      const byTable = {};
      for (const c of missingColumns) {
        (byTable[c.table_name] ||= []).push(c);
      }
      for (const [table, cols] of Object.entries(byTable).sort()) {
        console.log(`  ${table}:`);
        for (const c of cols) {
          const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
          console.log(`    - ${c.column_name} ${c.data_type}${len} nullable=${c.is_nullable}`);
        }
      }
      console.log('');
    }

    if (extraColumns.length) {
      console.log(`--- COLUMNS only in ${TARGET_DB} (${extraColumns.length}) ---`);
      const byTable = {};
      for (const c of extraColumns) {
        (byTable[c.table_name] ||= []).push(c);
      }
      for (const [table, cols] of Object.entries(byTable).sort()) {
        console.log(`  ${table}:`);
        for (const c of cols) {
          const len = c.character_maximum_length ? `(${c.character_maximum_length})` : '';
          console.log(`    + ${c.column_name} ${c.data_type}${len}`);
        }
      }
      console.log('');
    }

    if (typeMismatches.length) {
      console.log(`--- COLUMN TYPE / NULLABILITY mismatches (${typeMismatches.length}) ---`);
      for (const m of typeMismatches.slice(0, 100)) {
        console.log(`  ${m.table}.${m.column}`);
        console.log(`    ${REF_DB}: ${m.ref}`);
        console.log(`    ${TARGET_DB}: ${m.target}`);
      }
      if (typeMismatches.length > 100) console.log(`  ... and ${typeMismatches.length - 100} more`);
      console.log('');
    }

    if (missingConstraints.length) {
      console.log(`--- CONSTRAINTS missing in ${TARGET_DB} (sample, ${Math.min(50, missingConstraints.length)} of ${missingConstraints.length}) ---`);
      for (const c of missingConstraints.slice(0, 50)) {
        console.log(`  ${c.table_name}: ${c.constraint_type} (${c.columns || c.constraint_name})`);
      }
      console.log('');
    }

    if (missingIndexes.length) {
      console.log(`--- INDEXES missing in ${TARGET_DB} (sample, ${Math.min(40, missingIndexes.length)} of ${missingIndexes.length}) ---`);
      for (const i of missingIndexes.slice(0, 40)) {
        console.log(`  ${i.tablename}.${i.indexname}`);
      }
      console.log('');
    }

    if (
      !missingTables.length &&
      !missingColumns.length &&
      !typeMismatches.length
    ) {
      console.log(`✅ ${TARGET_DB} has all tables and columns from ${REF_DB} (types match).`);
    } else {
      console.log(`⚠️  ${TARGET_DB} is missing schema objects relative to ${REF_DB}. See above.`);
    }
  } finally {
    await refPool.end();
    await tgtPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
