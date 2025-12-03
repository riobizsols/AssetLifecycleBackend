/**
 * Copy data from GENERIC_URL database to DATABASE_URL database
 * 
 * Tables to copy:
 * - tblATMaintFreq
 * - tblMaintTypes
 * - tblOrgs
 * - tblUserJobRoles
 * - tblVendors (only first 5 rows)
 * - tblWFATSeqs
 * - tblWFJobRole
 * - tblWFSteps
 */

require('dotenv').config();
const { Pool } = require('pg');

// Parse database URL
function parseDatabaseUrl(databaseUrl) {
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
    }
    const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (!match) {
        throw new Error('Invalid DATABASE_URL format');
    }
    return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4],
        database: match[5],
    };
}

async function copyData() {
    if (!process.env.GENERIC_URL) {
        throw new Error('GENERIC_URL environment variable is not set');
    }
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    // Try to find the correct database name (case-sensitive)
    let sourceConnectionString = process.env.GENERIC_URL;
    const genericConfig = parseDatabaseUrl(process.env.GENERIC_URL);
    
    try {
        // First try the connection as-is
        const testPool = new Pool({
            connectionString: sourceConnectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        await testPool.query('SELECT NOW()');
        await testPool.end();
    } catch (e) {
        // If it fails, try to find the correct case
        console.log('⚠️  Database name case mismatch, searching for correct name...');
        const adminPool = new Pool({
            connectionString: `postgresql://${genericConfig.user}:${genericConfig.password}@${genericConfig.host}:${genericConfig.port}/postgres`,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        const dbList = await adminPool.query(`
            SELECT datname FROM pg_database 
            WHERE datistemplate = false 
            AND LOWER(datname) = LOWER($1)
            ORDER BY datname
        `, [genericConfig.database]);
        
        await adminPool.end();
        
        if (dbList.rows.length > 0) {
            const actualDbName = dbList.rows[0].datname;
            sourceConnectionString = `postgresql://${genericConfig.user}:${genericConfig.password}@${genericConfig.host}:${genericConfig.port}/${actualDbName}`;
            console.log(`✅ Found correct database name: ${actualDbName}`);
        } else {
            throw new Error(`Database "${genericConfig.database}" not found (case-insensitive search)`);
        }
    }

    const sourcePool = new Pool({
        connectionString: sourceConnectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const targetPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔄 COPYING DATA FROM GENERIC_URL TO DATABASE_URL');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Test source connection
        try {
            await sourcePool.query('SELECT NOW()');
            const sourceDbName = parseDatabaseUrl(process.env.GENERIC_URL).database;
            console.log(`✅ Connected to source database: ${sourceDbName} (GENERIC_URL)`);
        } catch (sourceError) {
            console.error('❌ Failed to connect to source database (GENERIC_URL):', sourceError.message);
            
            // Try to find the correct database name
            try {
                const genericConfig = parseDatabaseUrl(process.env.GENERIC_URL);
                const adminPool = new Pool({
                    connectionString: `postgresql://${genericConfig.user}:${genericConfig.password}@${genericConfig.host}:${genericConfig.port}/postgres`,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                });
                
                const dbList = await adminPool.query(`
                    SELECT datname FROM pg_database 
                    WHERE datistemplate = false 
                    AND LOWER(datname) = LOWER($1)
                    ORDER BY datname
                `, [genericConfig.database]);
                
                await adminPool.end();
                
                if (dbList.rows.length > 0) {
                    const actualDbName = dbList.rows[0].datname;
                    console.error(`\n💡 The database name might be case-sensitive.`);
                    console.error(`   Tried: ${genericConfig.database}`);
                    console.error(`   Found: ${actualDbName}`);
                    console.error(`\n   Please update GENERIC_URL in .env to use: ${actualDbName}`);
                }
            } catch (e) {
                // Ignore
            }
            
            throw new Error(`Cannot connect to source database: ${sourceError.message}`);
        }
        
        // Test target connection
        try {
            await targetPool.query('SELECT NOW()');
            const targetDbName = parseDatabaseUrl(process.env.DATABASE_URL).database;
            console.log(`✅ Connected to target database: ${targetDbName} (DATABASE_URL)\n`);
        } catch (targetError) {
            console.error('❌ Failed to connect to target database (DATABASE_URL):', targetError.message);
            const targetDbName = parseDatabaseUrl(process.env.DATABASE_URL).database;
            console.error(`\n💡 The database "${targetDbName}" might not exist.`);
            console.error('   Please create it first or check your DATABASE_URL in .env file.\n');
            throw new Error(`Cannot connect to target database: ${targetError.message}`);
        }

        // Tables to copy with their primary keys
        // IMPORTANT: Order matters! Copy parent tables before child tables to respect foreign keys
        const tables = [
            { name: 'tblMaintTypes', primaryKey: 'maint_type_id', limit: null }, // Must be before tblATMaintFreq
            { name: 'tblOrgs', primaryKey: 'org_id', limit: null },
            { name: 'tblWFSteps', primaryKey: 'wf_steps_id', limit: null }, // Must be before tblWFJobRole
            { name: 'tblATMaintFreq', primaryKey: 'at_main_freq_id', limit: null },
            { name: 'tblUserJobRoles', primaryKey: 'user_job_role_id', limit: null },
            { name: 'tblVendors', primaryKey: 'vendor_id', limit: 5 }, // Only first 5 rows
            { name: 'tblWFATSeqs', primaryKey: 'wf_at_seqs_id', limit: null },
            { name: 'tblWFJobRole', primaryKey: 'wf_job_role_id', limit: null },
        ];

        for (const table of tables) {
            console.log(`\n📋 Processing table: ${table.name}`);
            console.log('─'.repeat(60));

            try {
                // Step 1: Get all columns from source table
                const columnsResult = await sourcePool.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [table.name]);

                if (columnsResult.rows.length === 0) {
                    console.log(`⚠️  Table ${table.name} does not exist in source database, skipping...`);
                    continue;
                }

                const columns = columnsResult.rows.map(col => col.column_name);
                console.log(`   Columns: ${columns.join(', ')}`);

                // Step 2: Check if table exists in target
                const targetTableCheck = await targetPool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = $1
                    )
                `, [table.name]);

                if (!targetTableCheck.rows[0].exists) {
                    console.log(`⚠️  Table ${table.name} does not exist in target database, skipping...`);
                    continue;
                }

                // Step 3: Fetch data from source
                let sourceQuery = `SELECT * FROM "${table.name}"`;
                if (table.primaryKey) {
                    sourceQuery += ` ORDER BY "${table.primaryKey}"`;
                }
                if (table.limit) {
                    sourceQuery += ` LIMIT ${table.limit}`;
                }

                const sourceData = await sourcePool.query(sourceQuery);
                console.log(`   Found ${sourceData.rows.length} rows in source database`);

                if (sourceData.rows.length === 0) {
                    console.log(`   ℹ️  No data to copy, skipping...`);
                    continue;
                }

                // Step 4: Clear existing data in target
                // Use TRUNCATE CASCADE to handle foreign key constraints, or DELETE if TRUNCATE fails
                let deleteResult;
                try {
                    // Try TRUNCATE CASCADE first (faster and handles foreign keys)
                    deleteResult = await targetPool.query(`TRUNCATE TABLE "${table.name}" CASCADE`);
                    console.log(`   Truncated table "${table.name}" (CASCADE)`);
                } catch (truncateError) {
                    // If TRUNCATE fails, try DELETE
                    try {
                        deleteResult = await targetPool.query(`DELETE FROM "${table.name}"`);
                        console.log(`   Deleted ${deleteResult.rowCount} existing rows from target`);
                    } catch (deleteError) {
                        // If DELETE also fails due to foreign keys, just log a warning
                        console.log(`   ⚠️  Could not delete existing data (foreign key constraints). Will use ON CONFLICT to update instead.`);
                        deleteResult = { rowCount: 0 };
                    }
                }

                // Step 5: Insert data into target
                let insertedCount = 0;
                let errorCount = 0;

                for (const row of sourceData.rows) {
                    try {
                        // Build INSERT query dynamically
                        const columnNames = columns.map(col => `"${col}"`).join(', ');
                        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                        const values = columns.map(col => row[col]);

                        // Try with ON CONFLICT first, fall back to regular INSERT if it fails
                        let insertQuery = `
                            INSERT INTO "${table.name}" (${columnNames})
                            VALUES (${placeholders})
                        `;
                        
                        // Try to add ON CONFLICT if primary key exists
                        try {
                            // Check if primary key constraint exists
                            const constraintCheck = await targetPool.query(`
                                SELECT constraint_name
                                FROM information_schema.table_constraints
                                WHERE table_name = $1
                                AND constraint_type = 'PRIMARY KEY'
                                LIMIT 1
                            `, [table.name]);
                            
                            if (constraintCheck.rows.length > 0) {
                                insertQuery += ` ON CONFLICT ("${table.primaryKey}") DO NOTHING`;
                            }
                        } catch (e) {
                            // If we can't check, just use regular INSERT
                        }

                        const result = await targetPool.query(insertQuery, values);
                        if (result.rowCount > 0) {
                            insertedCount++;
                        }
                    } catch (insertError) {
                        errorCount++;
                        console.error(`   ❌ Error inserting row with ${table.primaryKey} = ${row[table.primaryKey]}:`, insertError.message);
                        
                        // If it's a constraint violation, try to get more details
                        if (insertError.code === '23505') { // Unique violation
                            console.error(`      (Duplicate key - row already exists)`);
                        } else if (insertError.code === '23503') { // Foreign key violation
                            console.error(`      (Foreign key constraint violation)`);
                        }
                    }
                }

                console.log(`   ✅ Successfully inserted: ${insertedCount} rows`);
                if (errorCount > 0) {
                    console.log(`   ⚠️  Errors: ${errorCount} rows`);
                }

            } catch (tableError) {
                console.error(`   ❌ Error processing table ${table.name}:`, tableError.message);
                console.error(`   Stack:`, tableError.stack);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ DATA COPY COMPLETED');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await sourcePool.end();
        await targetPool.end();
        console.log('🔌 Database connections closed');
    }
}

// Run the script
copyData().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

