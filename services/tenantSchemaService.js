const db = require("../config/db");

/**
 * Tenant Schema Service
 * This service generates database schema for multi-tenant setup
 * It excludes tblRioAdmin which is only for main organization setup
 */

/**
 * Generate schema SQL for tenant databases
 * Excludes tblRioAdmin and RioAdmin-specific data
 * Always generates from the DATABASE_URL to get latest schema
 */
const generateTenantSchemaSql = async () => {
  try {
    console.log('[TenantSchema] 🔄 Generating tenant schema from DATABASE_URL (excluding tblRioAdmin)...');
    
    const schemaParts = [];
    const foreignKeyStatements = []; // Collect FK constraints to add at the end
    
    // List of tables to exclude from tenant databases
    const EXCLUDED_TABLES = ['tblRioAdmin'];
    
    // Get sequences FIRST (before tables, since tables may reference them in DEFAULT values)
    const sequencesResult = await db.query(`
      SELECT 
        sequence_name,
        data_type,
        start_value,
        minimum_value,
        maximum_value,
        increment,
        cycle_option
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name
    `);
    
    console.log(`[TenantSchema] 📊 Found ${sequencesResult.rows.length} sequences`);
    for (const seq of sequencesResult.rows) {
      schemaParts.push(
        `CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}" ` +
        `AS ${seq.data_type} ` +
        `START WITH ${seq.start_value} ` +
        `INCREMENT BY ${seq.increment} ` +
        `MINVALUE ${seq.minimum_value} ` +
        `MAXVALUE ${seq.maximum_value};\n`
      );
    }
    
    // Get all tables in public schema (excluding tblRioAdmin)
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN (${EXCLUDED_TABLES.map((_, i) => `$${i + 1}`).join(', ')})
      ORDER BY table_name
    `, EXCLUDED_TABLES);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    if (tables.length === 0) {
      throw new Error('No tables found in database for tenant schema generation');
    }
    
    console.log(`[TenantSchema] 📋 Found ${tables.length} tables to process (excluding ${EXCLUDED_TABLES.join(', ')})`);
    console.log(`[TenantSchema] 📋 Table list: ${tables.join(', ')}`);
    
    for (const tableName of tables) {
      console.log(`[TenantSchema] 🔨 Processing table: ${tableName}`);
      
      // Get column information
      const columnsResult = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const columns = columnsResult.rows;
      
      if (columns.length === 0) {
        console.warn(`[TenantSchema] ⚠️ No columns found for table ${tableName}, skipping...`);
        continue;
      }
      
      // Start CREATE TABLE statement
      let createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      
      // Add column definitions
      const columnDefs = columns.map(col => {
        let colDef = `  "${col.column_name}" `;
        
        // Map data types
        let dataType = col.data_type;
        
        // Handle character types
        if (dataType === 'character varying') {
          if (col.character_maximum_length) {
            dataType = `character varying(${col.character_maximum_length})`;
          } else {
            dataType = 'text';
          }
        } else if (dataType === 'character') {
          if (col.character_maximum_length) {
            dataType = `character(${col.character_maximum_length})`;
          } else {
            dataType = 'text';
          }
        } else if (dataType === 'numeric' && col.numeric_precision) {
          if (col.numeric_scale) {
            dataType = `numeric(${col.numeric_precision}, ${col.numeric_scale})`;
          } else {
            dataType = `numeric(${col.numeric_precision})`;
          }
        } else if (dataType === 'timestamp without time zone') {
          dataType = 'timestamp';
        } else if (dataType === 'timestamp with time zone') {
          dataType = 'timestamp with time zone';
        } else if (dataType === 'time without time zone') {
          dataType = 'time';
        } else if (dataType === 'ARRAY') {
          dataType = col.udt_name === '_text' ? 'text[]' : 
                    col.udt_name === '_int4' ? 'integer[]' :
                    col.udt_name === '_float8' ? 'double precision[]' :
                    col.udt_name;
        } else if (dataType === 'USER-DEFINED') {
          dataType = col.udt_name;
        }
        
        colDef += dataType;
        
        // Add NOT NULL constraint
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        // Add DEFAULT value if exists
        if (col.column_default) {
          let defaultValue = col.column_default;
          
          // Clean up default values - remove type casts
          defaultValue = defaultValue.replace(/::[a-zA-Z_ ]+(\[\])?/g, '');
          
          colDef += ` DEFAULT ${defaultValue}`;
        }
        
        return colDef;
      });
      
      createTableSql += columnDefs.join(',\n');
      
      // Get primary key
      const pkResult = await db.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass
          AND i.indisprimary
        ORDER BY array_position(i.indkey, a.attnum)
      `, [`"${tableName}"`]);
      
      if (pkResult.rows.length > 0) {
        const pkColumns = pkResult.rows.map(r => `"${r.attname}"`).join(', ');
        createTableSql += `,\n  PRIMARY KEY (${pkColumns})`;
      }
      
      // Get unique constraints
      const uniqueResult = await db.query(`
        SELECT 
          tc.constraint_name,
          array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'UNIQUE'
        GROUP BY tc.constraint_name
      `, [tableName]);
      
      for (const constraint of uniqueResult.rows) {
        // Handle cases where columns might not be an array
        if (!constraint.columns || !Array.isArray(constraint.columns) || constraint.columns.length === 0) {
          console.warn(`[TenantSchema] Skipping invalid unique constraint: ${constraint.constraint_name}`);
          continue;
        }
        const columns = constraint.columns.map(c => `"${c}"`).join(', ');
        createTableSql += `,\n  CONSTRAINT "${constraint.constraint_name}" UNIQUE (${columns})`;
      }
      
      // Get check constraints
      const checkResult = await db.query(`
        SELECT 
          con.conname as constraint_name,
          pg_get_constraintdef(con.oid) as definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = $1
          AND con.contype = 'c'
      `, [tableName]);
      
      for (const constraint of checkResult.rows) {
        createTableSql += `,\n  CONSTRAINT "${constraint.constraint_name}" ${constraint.definition}`;
      }
      
      createTableSql += '\n);\n\n';
      schemaParts.push(createTableSql);
    }
    
    // Add indexes
    console.log(`[TenantSchema] 📑 Processing indexes...`);
    const indexesResult = await db.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename NOT IN (${EXCLUDED_TABLES.map((_, i) => `$${i + 1}`).join(', ')})
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `, EXCLUDED_TABLES);
    
    for (const idx of indexesResult.rows) {
      // Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS
      let indexDef = idx.indexdef.replace(/^CREATE INDEX/, 'CREATE INDEX IF NOT EXISTS');
      schemaParts.push(indexDef + ';\n');
    }
    
    // Add foreign keys (at the end, after all tables are created)
    console.log(`[TenantSchema] 🔗 Processing foreign keys...`);
    const fkResult = await db.query(`
      SELECT DISTINCT
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as source_columns,
        ccu.table_name AS foreign_table_name,
        string_agg(ccu.column_name, ', ' ORDER BY ccu.ordinal_position) as target_columns,
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
        AND tc.table_name NOT IN (${EXCLUDED_TABLES.map((_, i) => `$${i + 1}`).join(', ')})
        AND ccu.table_name NOT IN (${EXCLUDED_TABLES.map((_, i) => `$${EXCLUDED_TABLES.length + i + 1}`).join(', ')})
      GROUP BY 
        tc.table_name,
        tc.constraint_name,
        ccu.table_name,
        rc.update_rule,
        rc.delete_rule
      ORDER BY tc.table_name
    `, [...EXCLUDED_TABLES, ...EXCLUDED_TABLES]);
    
    console.log(`[TenantSchema] 🔗 Found ${fkResult.rows.length} foreign key constraints (excluding references to ${EXCLUDED_TABLES.join(', ')})`);
    
    for (const fk of fkResult.rows) {
      const sourceColumns = fk.source_columns.split(', ').map(c => `"${c}"`).join(', ');
      const targetColumns = fk.target_columns.split(', ').map(c => `"${c}"`).join(', ');
      
      let fkSql = `ALTER TABLE "${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" ` +
                  `FOREIGN KEY (${sourceColumns}) ` +
                  `REFERENCES "${fk.foreign_table_name}" (${targetColumns})`;
      
      if (fk.update_rule !== 'NO ACTION') {
        fkSql += ` ON UPDATE ${fk.update_rule}`;
      }
      if (fk.delete_rule !== 'NO ACTION') {
        fkSql += ` ON DELETE ${fk.delete_rule}`;
      }
      
      foreignKeyStatements.push(fkSql + ';\n');
    }
    
    // Add foreign keys at the end
    if (foreignKeyStatements.length > 0) {
      schemaParts.push('\n-- Foreign Key Constraints\n');
      schemaParts.push(...foreignKeyStatements);
    }
    
    const fullSchemaSql = schemaParts.join('');
    
    console.log(`[TenantSchema] ✅ Tenant schema SQL generated successfully`);
    console.log(`[TenantSchema] 📊 Total length: ${fullSchemaSql.length} characters`);
    console.log(`[TenantSchema] 📋 Included ${tables.length} tables (excluded: ${EXCLUDED_TABLES.join(', ')})`);
    
    return fullSchemaSql;
    
  } catch (error) {
    console.error('[TenantSchema] ❌ Error generating tenant schema SQL:', error.message);
    console.error('[TenantSchema] Stack:', error.stack);
    throw error;
  }
};

module.exports = {
  generateTenantSchemaSql,
};

