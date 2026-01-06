/**
 * Validate and Apply Primary Key and Foreign Key Constraints
 * 
 * This script:
 * 1. Validates that data won't violate constraints before applying them
 * 2. Applies missing primary keys and foreign keys safely
 * 3. Reports any issues that need manual intervention
 */

const db = require('../config/db');
const fs = require('fs');
const path = require('path');

async function validatePrimaryKey(tableName, columnName) {
  // Check if column exists
  const colCheck = await db.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
  `, [tableName, columnName]);

  if (colCheck.rows.length === 0) {
    return { valid: false, error: `Column ${columnName} does not exist` };
  }

  const column = colCheck.rows[0];
  
  // Check for NULL values
  const nullCheck = await db.query(`
    SELECT COUNT(*) as null_count
    FROM "${tableName}"
    WHERE "${columnName}" IS NULL
  `);

  if (parseInt(nullCheck.rows[0].null_count) > 0) {
    return { valid: false, error: `Column ${columnName} contains ${nullCheck.rows[0].null_count} NULL values` };
  }

  // Check for duplicate values
  const duplicateCheck = await db.query(`
    SELECT "${columnName}", COUNT(*) as count
    FROM "${tableName}"
    GROUP BY "${columnName}"
    HAVING COUNT(*) > 1
    LIMIT 10
  `);

  if (duplicateCheck.rows.length > 0) {
    const duplicates = duplicateCheck.rows.map(r => `${r[columnName]}: ${r.count} occurrences`).join(', ');
    return { valid: false, error: `Column ${columnName} contains duplicate values: ${duplicates}` };
  }

  return { valid: true };
}

async function validateForeignKey(tableName, columnName, refTable, refColumn) {
  // Check if referenced table exists
  const tableCheck = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    )
  `, [refTable]);

  if (!tableCheck.rows[0].exists) {
    return { valid: false, error: `Referenced table ${refTable} does not exist` };
  }

  // Check if referenced column exists
  const refColCheck = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
  `, [refTable, refColumn]);

  if (refColCheck.rows.length === 0) {
    return { valid: false, error: `Referenced column ${refColumn} does not exist in ${refTable}` };
  }

  // Check for orphaned foreign key values (values that don't exist in referenced table)
  // Only check non-NULL values
  const orphanCheck = await db.query(`
    SELECT COUNT(DISTINCT t."${columnName}") as orphan_count
    FROM "${tableName}" t
    WHERE t."${columnName}" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "${refTable}" r
        WHERE r."${refColumn}" = t."${columnName}"
      )
    LIMIT 100
  `);

  const orphanCount = parseInt(orphanCheck.rows[0].orphan_count);
  if (orphanCount > 0) {
    // Get sample orphaned values
    const sampleOrphans = await db.query(`
      SELECT DISTINCT t."${columnName}" as orphan_value
      FROM "${tableName}" t
      WHERE t."${columnName}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "${refTable}" r
          WHERE r."${refColumn}" = t."${columnName}"
        )
      LIMIT 10
    `);

    const samples = sampleOrphans.rows.map(r => r.orphan_value).join(', ');
    return { 
      valid: false, 
      error: `${orphanCount} orphaned values found (sample: ${samples})`,
      orphanCount 
    };
  }

  return { valid: true };
}

async function applyPrimaryKey(tableName, columnName) {
  const constraintName = `pk_${tableName.toLowerCase()}`;
  
  try {
    await db.query(`
      ALTER TABLE "${tableName}"
      ADD CONSTRAINT "${constraintName}" PRIMARY KEY ("${columnName}")
    `);
    return { success: true, constraintName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function applyForeignKey(tableName, columnName, refTable, refColumn, onDelete = 'SET NULL', onUpdate = 'CASCADE') {
  const constraintName = `fk_${tableName.toLowerCase()}_${columnName.toLowerCase()}`;
  
  try {
    await db.query(`
      ALTER TABLE "${tableName}"
      ADD CONSTRAINT "${constraintName}"
      FOREIGN KEY ("${columnName}")
      REFERENCES "${refTable}" ("${refColumn}")
      ON DELETE ${onDelete}
      ON UPDATE ${onUpdate}
    `);
    return { success: true, constraintName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function readSQLFile() {
  const sqlPath = path.join(__dirname, '..', 'migrations', 'add_missing_keys.sql');
  
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}. Please run analyze_and_fix_keys.js first.`);
  }

  const content = fs.readFileSync(sqlPath, 'utf8');
  
  // Parse SQL file - normalize line breaks
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Parse Primary Keys
  const pkPattern = /ALTER TABLE "([^"]+)"\s+ADD CONSTRAINT "([^"]+)" PRIMARY KEY \("([^"]+)"\)/gi;
  const constraints = {
    primaryKeys: [],
    foreignKeys: []
  };

  let match;
  while ((match = pkPattern.exec(normalizedContent)) !== null) {
    constraints.primaryKeys.push({
      table: match[1],
      constraintName: match[2],
      column: match[3]
    });
  }

  // Parse Foreign Keys - handle multiline SQL
  // The format is:
  // ALTER TABLE "table"
  //   ADD CONSTRAINT "constraint_name"
  //   FOREIGN KEY ("column")
  //   REFERENCES "ref_table" ("ref_column")
  //   ON DELETE action
  //   ON UPDATE action;
  
  const lines = normalizedContent.split('\n');
  let currentFK = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('--') || line === '') continue;
    
    // Check if line starts ALTER TABLE (may be split across lines)
    if (line.match(/^ALTER TABLE "([^"]+)"$/i)) {
      const alterMatch = line.match(/^ALTER TABLE "([^"]+)"$/i);
      currentFK = {
        table: alterMatch[1],
        constraintName: null,
        column: null,
        refTable: null,
        refColumn: null,
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      };
      continue;
    }
    
    // Check if ADD CONSTRAINT is on same line or next line
    if (currentFK && currentFK.constraintName === null) {
      const constraintMatch = line.match(/ADD CONSTRAINT "([^"]+)"$/i);
      if (constraintMatch) {
        currentFK.constraintName = constraintMatch[1];
        continue;
      }
    }
    
    // FOREIGN KEY line
    if (currentFK && currentFK.constraintName) {
      const fkMatch = line.match(/^FOREIGN KEY \("([^"]+)"\)$/i);
      if (fkMatch) {
        currentFK.column = fkMatch[1];
        continue;
      }
      
      // REFERENCES line
      const refMatch = line.match(/^REFERENCES "([^"]+)" \("([^"]+)"\)$/i);
      if (refMatch) {
        currentFK.refTable = refMatch[1];
        currentFK.refColumn = refMatch[2];
        continue;
      }
      
      // ON DELETE line
      const delMatch = line.match(/^ON DELETE (\w+)$/i);
      if (delMatch) {
        currentFK.onDelete = delMatch[1];
        continue;
      }
      
      // ON UPDATE line (with semicolon at end)
      const updMatch = line.match(/^ON UPDATE (\w+);?$/i);
      if (updMatch) {
        currentFK.onUpdate = updMatch[1];
        // Complete FK constraint - save it
        if (currentFK.column && currentFK.refTable && currentFK.refColumn && currentFK.constraintName) {
          constraints.foreignKeys.push({
            table: currentFK.table,
            constraintName: currentFK.constraintName,
            column: currentFK.column,
            refTable: currentFK.refTable,
            refColumn: currentFK.refColumn,
            onDelete: currentFK.onDelete,
            onUpdate: currentFK.onUpdate
          });
        }
        currentFK = null;
        continue;
      }
    }
  }

  return constraints;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');

  if (!dryRun && !apply) {
    console.log('Usage: node validate_and_apply_keys.js [--dry-run|--apply]');
    console.log('');
    console.log('  --dry-run  : Validate constraints without applying (default)');
    console.log('  --apply    : Apply valid constraints to database');
    console.log('');
    process.exit(1);
  }

  try {
    console.log('📋 Reading constraints from SQL file...\n');
    const constraints = await readSQLFile();
    
    console.log(`Found ${constraints.primaryKeys.length} primary key constraints`);
    console.log(`Found ${constraints.foreignKeys.length} foreign key constraints\n`);

    const results = {
      primaryKeys: { valid: [], invalid: [] },
      foreignKeys: { valid: [], invalid: [] }
    };

    // Validate Primary Keys
    console.log('='.repeat(80));
    console.log('VALIDATING PRIMARY KEYS');
    console.log('='.repeat(80));
    console.log('');

    for (const pk of constraints.primaryKeys) {
      console.log(`Validating PK: ${pk.table}.${pk.column}...`);
      const validation = await validatePrimaryKey(pk.table, pk.column);
      
      if (validation.valid) {
        console.log(`  ✅ Valid - can be applied`);
        results.primaryKeys.valid.push(pk);
      } else {
        console.log(`  ❌ Invalid: ${validation.error}`);
        results.primaryKeys.invalid.push({ ...pk, error: validation.error });
      }
      console.log('');
    }

    // Validate Foreign Keys
    console.log('='.repeat(80));
    console.log('VALIDATING FOREIGN KEYS');
    console.log('='.repeat(80));
    console.log('');

    for (const fk of constraints.foreignKeys) {
      console.log(`Validating FK: ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}...`);
      const validation = await validateForeignKey(fk.table, fk.column, fk.refTable, fk.refColumn);
      
      if (validation.valid) {
        console.log(`  ✅ Valid - can be applied`);
        results.foreignKeys.valid.push(fk);
      } else {
        console.log(`  ❌ Invalid: ${validation.error}`);
        results.foreignKeys.invalid.push({ ...fk, error: validation.error });
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Primary Keys - Valid: ${results.primaryKeys.valid.length}, Invalid: ${results.primaryKeys.invalid.length}`);
    console.log(`Foreign Keys - Valid: ${results.foreignKeys.valid.length}, Invalid: ${results.foreignKeys.invalid.length}`);
    console.log('='.repeat(80));
    console.log('');

    // Save validation report
    const reportPath = path.join(__dirname, '..', 'migrations', 'constraints_validation_report.txt');
    const report = [
      '='.repeat(80),
      'CONSTRAINTS VALIDATION REPORT',
      'Generated: ' + new Date().toISOString(),
      '='.repeat(80),
      '',
      'PRIMARY KEYS:',
      `  Valid: ${results.primaryKeys.valid.length}`,
      `  Invalid: ${results.primaryKeys.invalid.length}`,
      '',
      ...results.primaryKeys.invalid.map(pk => `  ❌ ${pk.table}.${pk.column}: ${pk.error}`),
      '',
      'FOREIGN KEYS:',
      `  Valid: ${results.foreignKeys.valid.length}`,
      `  Invalid: ${results.foreignKeys.invalid.length}`,
      '',
      ...results.foreignKeys.invalid.map(fk => `  ❌ ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}: ${fk.error}`),
      ''
    ].join('\n');

    fs.writeFileSync(reportPath, report);
    console.log(`📄 Validation report saved to: ${reportPath}\n`);

    // Apply constraints if requested
    if (apply) {
      console.log('='.repeat(80));
      console.log('APPLYING VALID CONSTRAINTS');
      console.log('='.repeat(80));
      console.log('');

      // Apply Primary Keys
      for (const pk of results.primaryKeys.valid) {
        console.log(`Applying PK: ${pk.table}.${pk.column}...`);
        const result = await applyPrimaryKey(pk.table, pk.column);
        if (result.success) {
          console.log(`  ✅ Applied successfully: ${result.constraintName}`);
        } else {
          console.log(`  ❌ Failed: ${result.error}`);
        }
        console.log('');
      }

      // Apply Foreign Keys
      for (const fk of results.foreignKeys.valid) {
        console.log(`Applying FK: ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}...`);
        const result = await applyForeignKey(fk.table, fk.column, fk.refTable, fk.refColumn, fk.onDelete, fk.onUpdate);
        if (result.success) {
          console.log(`  ✅ Applied successfully: ${result.constraintName}`);
        } else {
          console.log(`  ❌ Failed: ${result.error}`);
        }
        console.log('');
      }

      console.log('✅ Constraint application completed!');
    } else {
      console.log('💡 To apply valid constraints, run:');
      console.log('   node validate_and_apply_keys.js --apply');
      console.log('');
      console.log('⚠️  Review the validation report first to fix invalid constraints!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validatePrimaryKey, validateForeignKey, applyPrimaryKey, applyForeignKey };

