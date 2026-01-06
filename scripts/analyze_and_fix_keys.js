/**
 * Database Primary Key and Foreign Key Analysis and Setup Tool
 * 
 * This script:
 * 1. Analyzes all tables in the database
 * 2. Identifies existing primary keys and foreign keys
 * 3. Suggests missing primary keys based on naming conventions
 * 4. Suggests missing foreign keys based on column naming patterns
 * 5. Generates SQL to add missing constraints
 * 6. Can optionally apply the changes (with confirmation)
 */

const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// Common foreign key patterns
const FK_PATTERNS = {
  // org_id references tblOrgs.org_id
  'org_id': 'tblOrgs',
  // _id references tblXxxs.xxx_id
  'asset_type_id': 'tblAssetTypes',
  'asset_id': 'tblAssets',
  'dept_id': 'tblDepartments',
  'branch_id': 'tblBranches',
  'emp_int_id': 'tblEmployees',
  'employee_int_id': 'tblEmployees',
  'user_id': 'tblUsers',
  'job_role_id': 'tblJobRoles',
  'vendor_id': 'tblVendors',
  'maint_type_id': 'tblMaintTypes',
  'maint_status_id': 'tblMaintStatus',
  'prop_id': 'tblProps',
  'app_id': 'tblApps',
  'event_id': 'tblEvents',
  'wfamsh_id': 'tblWFAssetMaintSch_H',
  'dto_id': 'tblDocTypeObjects',
  'parent_asset_type_id': 'tblAssetTypes',
  'parent_id': null, // Self-referencing - handled separately
};

// Tables that should have primary keys (common patterns)
const PK_PATTERNS = [
  /^.*_id$/,           // columns ending in _id
  /^.*_code$/,         // columns ending in _code
  /^id$/,              // column named 'id'
];

async function getAllTables() {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name LIKE 'tbl%'
    ORDER BY table_name;
  `;
  const result = await db.query(query);
  return result.rows.map(r => r.table_name);
}

async function getTableColumns(tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const result = await db.query(query, [tableName]);
  return result.rows;
}

async function getPrimaryKeys(tableName) {
  const query = `
    SELECT 
      kcu.column_name,
      kcu.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY kcu.ordinal_position;
  `;
  const result = await db.query(query, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function getForeignKeys(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
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
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1;
  `;
  const result = await db.query(query, [tableName]);
  return result.rows;
}

async function tableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    );
  `;
  const result = await db.query(query, [tableName]);
  return result.rows[0].exists;
}

function suggestPrimaryKey(columns, tableName) {
  // Common primary key patterns by table prefix
  const tablePrefix = tableName.toLowerCase().replace('tbl', '').replace(/s$/, '');
  const commonPKPatterns = {
    'asset': 'asset_id',
    'employee': 'emp_int_id',
    'user': 'user_id',
    'department': 'dept_id',
    'branch': 'branch_id',
    'org': 'org_id',
    'vendor': 'vendor_id',
    'jobrole': 'job_role_id',
    'mainttype': 'maint_type_id',
    'maintstatus': 'maint_status_id',
    'app': 'app_id',
    'event': 'event_id',
  };

  // Check if table name matches a known pattern
  for (const [prefix, pkColumn] of Object.entries(commonPKPatterns)) {
    if (tablePrefix.includes(prefix)) {
      const found = columns.find(col => col.column_name.toLowerCase() === pkColumn.toLowerCase());
      if (found) {
        return found.column_name;
      }
    }
  }

  // Fallback: Look for common primary key patterns
  const candidates = columns.filter(col => {
    const name = col.column_name.toLowerCase();
    
    // Exact matches like asset_id, user_id, dept_id, etc.
    if (name.match(/^(asset|user|dept|branch|org|vendor|emp_int|job_role|maint_type|maint_status|app|event)_id$/)) {
      return true;
    }
    
    // Pattern: table_name_id (e.g., asset_assign_id)
    const tableBase = tableName.toLowerCase().replace(/^tbl/, '').replace(/s$/, '');
    if (name === `${tableBase}_id` || name === `${tableBase.substring(0, tableBase.length - 1)}_id`) {
      return true;
    }
    
    // Columns ending in _id (but exclude type/status variations)
    if (name.endsWith('_id') && !name.includes('_type_id') && !name.includes('_status_id') && !name.includes('parent_')) {
      return true;
    }
    
    if (name === 'id') return true;
    return false;
  });

  // Prefer columns that:
  // 1. Match exact patterns (asset_id, user_id, etc.)
  // 2. Are NOT NULL
  // 3. Don't have defaults (auto-generated)
  
  const sorted = candidates.sort((a, b) => {
    const aName = a.column_name.toLowerCase();
    const bName = b.column_name.toLowerCase();
    
    // Prefer exact matches like asset_id, user_id, etc.
    if (aName.match(/^(asset|user|dept|branch|org|vendor|emp_int|job_role)_id$/)) return -1;
    if (bName.match(/^(asset|user|dept|branch|org|vendor|emp_int|job_role)_id$/)) return 1;
    
    // Prefer NOT NULL
    if (a.is_nullable === 'NO' && b.is_nullable === 'YES') return -1;
    if (a.is_nullable === 'YES' && b.is_nullable === 'NO') return 1;
    
    return 0;
  });

  return sorted.length > 0 ? sorted[0].column_name : null;
}

function suggestForeignKeys(columns, tableName) {
  const suggestions = [];

  for (const col of columns) {
    const colName = col.column_name.toLowerCase();
    
    // Check if this column matches a known FK pattern
    if (FK_PATTERNS[colName]) {
      const refTable = FK_PATTERNS[colName];
      suggestions.push({
        column: col.column_name,
        referencedTable: refTable,
        referencedColumn: getReferencedColumn(refTable, colName),
        reason: `Matches pattern: ${colName}`
      });
    }
    // Check for _id suffix patterns
    else if (colName.endsWith('_id') && !colName.includes('_type_id') && !colName.includes('_status_id')) {
      // Try to infer table name from column
      // e.g., asset_id -> tblAssets, vendor_id -> tblVendors
      const baseName = colName.replace('_id', '');
      const pluralName = baseName.endsWith('y') 
        ? baseName.slice(0, -1) + 'ies' 
        : baseName + 's';
      const possibleTable = `tbl${pluralName.charAt(0).toUpperCase()}${pluralName.slice(1)}`;
      
      suggestions.push({
        column: col.column_name,
        referencedTable: possibleTable,
        referencedColumn: colName,
        reason: `Inferred from column name pattern`,
        needsVerification: true
      });
    }
    // Check for self-referencing patterns
    else if (colName.includes('parent_') && colName.endsWith('_id')) {
      suggestions.push({
        column: col.column_name,
        referencedTable: tableName,
        referencedColumn: colName.replace('parent_', ''),
        reason: `Self-referencing parent relationship`,
        needsVerification: true
      });
    }
  }

  return suggestions;
}

function getReferencedColumn(tableName, columnName) {
  // Map common patterns
  const mapping = {
    'org_id': 'org_id',
    'asset_type_id': 'asset_type_id',
    'asset_id': 'asset_id',
    'dept_id': 'dept_id',
    'branch_id': 'branch_id',
    'emp_int_id': 'emp_int_id',
    'employee_int_id': 'emp_int_id',
    'user_id': 'user_id',
    'job_role_id': 'job_role_id',
    'vendor_id': 'vendor_id',
    'maint_type_id': 'maint_type_id',
    'maint_status_id': 'maint_status_id',
    'prop_id': 'prop_id',
    'app_id': 'app_id',
    'event_id': 'event_id',
    'wfamsh_id': 'wfamsh_id',
    'dto_id': 'dto_id',
    'parent_asset_type_id': 'asset_type_id',
  };
  
  return mapping[columnName] || columnName;
}

async function analyzeDatabase() {
  console.log('🔍 Starting Database Key Analysis...\n');
  
  const tables = await getAllTables();
  console.log(`Found ${tables.length} tables to analyze\n`);
  
  const analysis = {
    tables: [],
    summary: {
      totalTables: tables.length,
      tablesWithPK: 0,
      tablesWithoutPK: 0,
      totalFKs: 0,
      suggestedPKs: 0,
      suggestedFKs: 0
    }
  };

  for (const tableName of tables) {
    console.log(`Analyzing: ${tableName}...`);
    
    const columns = await getTableColumns(tableName);
    const existingPKs = await getPrimaryKeys(tableName);
    const existingFKs = await getForeignKeys(tableName);
    
    const suggestedPK = existingPKs.length === 0 ? suggestPrimaryKey(columns, tableName) : null;
    const suggestedFKs = suggestForeignKeys(columns, tableName);
    
    // Filter out FK suggestions that already exist
    const newFKs = suggestedFKs.filter(suggested => {
      return !existingFKs.some(existing => 
        existing.column_name === suggested.column &&
        existing.foreign_table_name === suggested.referencedTable
      );
    });

    // Verify referenced tables exist
    const verifiedFKs = [];
    for (const fk of newFKs) {
      const exists = await tableExists(fk.referencedTable);
      if (exists || !fk.needsVerification) {
        verifiedFKs.push({
          ...fk,
          tableExists: exists
        });
      }
    }

    const tableInfo = {
      tableName,
      columns: columns.length,
      existingPKs,
      existingFKs: existingFKs.length,
      suggestedPK,
      suggestedFKs: verifiedFKs.filter(fk => fk.tableExists !== false),
      issues: []
    };

    if (existingPKs.length === 0) {
      tableInfo.issues.push('Missing primary key');
      analysis.summary.tablesWithoutPK++;
      if (suggestedPK) analysis.summary.suggestedPKs++;
    } else {
      analysis.summary.tablesWithPK++;
    }

    analysis.summary.totalFKs += existingFKs.length;
    analysis.summary.suggestedFKs += verifiedFKs.filter(fk => fk.tableExists !== false).length;

    analysis.tables.push(tableInfo);
  }

  return analysis;
}

function generateSQL(analysis) {
  const sql = [];
  sql.push('-- =====================================================');
  sql.push('-- Database Primary Key and Foreign Key Setup Script');
  sql.push('-- Generated: ' + new Date().toISOString());
  sql.push('-- =====================================================\n');

  sql.push('-- NOTE: This script will attempt to add missing constraints.');
  sql.push('-- Some constraints may fail if data exists that violates referential integrity.');
  sql.push('-- Review and fix data issues before running this script.\n');

  // Generate PRIMARY KEY constraints
  sql.push('\n-- =====================================================');
  sql.push('-- PRIMARY KEY CONSTRAINTS');
  sql.push('-- =====================================================\n');

  for (const table of analysis.tables) {
    if (table.existingPKs.length === 0 && table.suggestedPK) {
      const constraintName = `pk_${table.tableName.toLowerCase()}`;
      sql.push(`-- Table: ${table.tableName}`);
      sql.push(`-- Suggested Primary Key: ${table.suggestedPK}`);
      sql.push(`ALTER TABLE "${table.tableName}"`);
      sql.push(`  ADD CONSTRAINT "${constraintName}" PRIMARY KEY ("${table.suggestedPK}");`);
      sql.push('');
    }
  }

  // Generate FOREIGN KEY constraints
  sql.push('\n-- =====================================================');
  sql.push('-- FOREIGN KEY CONSTRAINTS');
  sql.push('-- =====================================================\n');

  for (const table of analysis.tables) {
    if (table.suggestedFKs.length > 0) {
      sql.push(`-- Table: ${table.tableName}`);
      for (const fk of table.suggestedFKs) {
        if (fk.tableExists !== false) {
          const constraintName = `fk_${table.tableName.toLowerCase()}_${fk.column.toLowerCase()}`;
          sql.push(`-- ${fk.reason}`);
          sql.push(`ALTER TABLE "${table.tableName}"`);
          sql.push(`  ADD CONSTRAINT "${constraintName}"`);
          sql.push(`  FOREIGN KEY ("${fk.column}")`);
          sql.push(`  REFERENCES "${fk.referencedTable}" ("${fk.referencedColumn}")`);
          sql.push(`  ON DELETE SET NULL`);
          sql.push(`  ON UPDATE CASCADE;`);
          sql.push('');
        }
      }
    }
  }

  sql.push('\n-- =====================================================');
  sql.push('-- End of Script');
  sql.push('-- =====================================================');

  return sql.join('\n');
}

function generateReport(analysis) {
  const report = [];
  report.push('='.repeat(80));
  report.push('DATABASE KEY ANALYSIS REPORT');
  report.push('Generated: ' + new Date().toISOString());
  report.push('='.repeat(80));
  report.push('');

  // Summary
  report.push('SUMMARY:');
  report.push(`  Total Tables: ${analysis.summary.totalTables}`);
  report.push(`  Tables with PK: ${analysis.summary.tablesWithPK}`);
  report.push(`  Tables without PK: ${analysis.summary.tablesWithoutPK}`);
  report.push(`  Existing Foreign Keys: ${analysis.summary.totalFKs}`);
  report.push(`  Suggested Primary Keys: ${analysis.summary.suggestedPKs}`);
  report.push(`  Suggested Foreign Keys: ${analysis.summary.suggestedFKs}`);
  report.push('');

  // Detailed table information
  report.push('='.repeat(80));
  report.push('DETAILED TABLE ANALYSIS:');
  report.push('='.repeat(80));
  report.push('');

  for (const table of analysis.tables) {
    report.push(`Table: ${table.tableName}`);
    report.push(`  Columns: ${table.columns}`);
    report.push(`  Primary Keys: ${table.existingPKs.length > 0 ? table.existingPKs.join(', ') : 'NONE'}`);
    report.push(`  Foreign Keys: ${table.existingFKs}`);
    
    if (table.existingPKs.length === 0 && table.suggestedPK) {
      report.push(`  ⚠️  SUGGESTED PK: ${table.suggestedPK}`);
    }
    
    if (table.suggestedFKs.length > 0) {
      report.push(`  ⚠️  SUGGESTED FKs:`);
      for (const fk of table.suggestedFKs) {
        if (fk.tableExists !== false) {
          report.push(`      - ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn} (${fk.reason})`);
        }
      }
    }
    
    if (table.issues.length > 0) {
      report.push(`  ❌ Issues: ${table.issues.join(', ')}`);
    }
    
    report.push('');
  }

  return report.join('\n');
}

async function main() {
  try {
    console.log('🔍 Analyzing database schema...\n');
    
    const analysis = await analyzeDatabase();
    
    // Generate report
    const report = generateReport(analysis);
    const reportPath = path.join(__dirname, '..', 'migrations', 'database_keys_analysis_report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Analysis report saved to: ${reportPath}\n`);
    
    // Generate SQL
    const sql = generateSQL(analysis);
    const sqlPath = path.join(__dirname, '..', 'migrations', 'add_missing_keys.sql');
    fs.writeFileSync(sqlPath, sql);
    console.log(`✅ SQL script generated: ${sqlPath}\n`);
    
    // Print summary
    console.log('='.repeat(80));
    console.log('ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tables: ${analysis.summary.totalTables}`);
    console.log(`Tables with PK: ${analysis.summary.tablesWithPK}`);
    console.log(`Tables without PK: ${analysis.summary.tablesWithoutPK}`);
    console.log(`Existing Foreign Keys: ${analysis.summary.totalFKs}`);
    console.log(`Suggested Primary Keys: ${analysis.summary.suggestedPKs}`);
    console.log(`Suggested Foreign Keys: ${analysis.summary.suggestedFKs}`);
    console.log('='.repeat(80));
    
    console.log('\n📄 Review the generated files:');
    console.log(`   - Report: ${reportPath}`);
    console.log(`   - SQL: ${sqlPath}`);
    console.log('\n⚠️  IMPORTANT: Review the SQL script before running it!');
    console.log('   Some constraints may fail if data exists that violates referential integrity.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = { analyzeDatabase, generateSQL, generateReport };

