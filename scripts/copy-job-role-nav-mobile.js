/**
 * Copy all rows from tblJobRoleNav in LifeCycle database to Hospital database
 * Only copies rows where mob_desk = 'M'
 * 
 * Usage:
 *   node copy-job-role-nav-mobile.js <lifecycle_db_name> <hospital_db_name>
 * 
 * Example:
 *   node copy-job-role-nav-mobile.js lifecycle hospital
 * 
 * The script will use the current DATABASE_URL from .env and change the database name
 */

const { Pool } = require('pg');
require('dotenv').config();

// Get database names from command line arguments
const LIFECYCLE_DB_NAME = process.argv[2];
const HOSPITAL_DB_NAME = process.argv[3];

if (!LIFECYCLE_DB_NAME || !HOSPITAL_DB_NAME) {
    console.error('\n❌ Error: Database names required!');
    console.error('\nUsage:');
    console.error('  node copy-job-role-nav-mobile.js <lifecycle_db_name> <hospital_db_name>');
    console.error('\nExample:');
    console.error('  node copy-job-role-nav-mobile.js lifecycle hospital\n');
    process.exit(1);
}

// Get base connection string from environment
const BASE_DB_URL = process.env.DATABASE_URL;

if (!BASE_DB_URL) {
    console.error('\n❌ Error: DATABASE_URL not found in environment!');
    console.error('   Please set DATABASE_URL in your .env file\n');
    process.exit(1);
}

// Parse the connection string and replace database name
function getConnectionString(dbName) {
    // Handle both postgresql:// and postgres:// protocols
    const protocolMatch = BASE_DB_URL.match(/^(postgresql?:\/\/)/);
    const protocol = protocolMatch ? protocolMatch[1] : 'postgresql://';
    
    // Remove protocol for parsing
    const urlPart = BASE_DB_URL.replace(/^postgresql?:\/\//, '');
    
    // Split into parts
    const atIndex = urlPart.indexOf('@');
    const slashIndex = urlPart.indexOf('/', atIndex !== -1 ? atIndex : 0);
    
    let authPart = '';
    let hostPart = '';
    let dbAndQuery = '';
    
    if (atIndex !== -1) {
        authPart = urlPart.substring(0, atIndex + 1);
        const afterAuth = urlPart.substring(atIndex + 1);
        const hostSlashIndex = afterAuth.indexOf('/');
        if (hostSlashIndex !== -1) {
            hostPart = afterAuth.substring(0, hostSlashIndex);
            dbAndQuery = afterAuth.substring(hostSlashIndex + 1);
        } else {
            hostPart = afterAuth;
        }
    } else {
        const hostSlashIndex = urlPart.indexOf('/');
        if (hostSlashIndex !== -1) {
            hostPart = urlPart.substring(0, hostSlashIndex);
            dbAndQuery = urlPart.substring(hostSlashIndex + 1);
        } else {
            hostPart = urlPart;
        }
    }
    
    // Extract query string if present
    const queryIndex = dbAndQuery.indexOf('?');
    const queryString = queryIndex !== -1 ? '?' + dbAndQuery.substring(queryIndex + 1) : '';
    
    // Reconstruct with new database name
    return `${protocol}${authPart}${hostPart}/${dbName}${queryString}`;
}

const LIFECYCLE_DB_URL = getConnectionString(LIFECYCLE_DB_NAME);
const HOSPITAL_DB_URL = getConnectionString(HOSPITAL_DB_NAME);

async function copyJobRoleNavMobile() {
    let lifecyclePool = null;
    let hospitalPool = null;
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📱 COPYING MOBILE NAVIGATION (mob_desk = M)');
        console.log(`   FROM: ${LIFECYCLE_DB_NAME} Database`);
        console.log(`   TO:   ${HOSPITAL_DB_NAME} Database`);
        console.log('═══════════════════════════════════════════════════════════\n');
        
        console.log(`🔗 LifeCycle DB URL: ${LIFECYCLE_DB_URL.replace(/:[^:@]+@/, ':****@')}`);
        console.log(`🔗 Hospital DB URL: ${HOSPITAL_DB_URL.replace(/:[^:@]+@/, ':****@')}\n`);
        
        // Connect to LifeCycle database
        console.log(`🔌 Connecting to ${LIFECYCLE_DB_NAME} database...`);
        lifecyclePool = new Pool({
            connectionString: LIFECYCLE_DB_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        await lifecyclePool.query('SELECT NOW()');
        console.log(`✅ Connected to ${LIFECYCLE_DB_NAME} database\n`);
        
        // Connect to Hospital database
        console.log('🔌 Connecting to Hospital database...');
        hospitalPool = new Pool({
            connectionString: HOSPITAL_DB_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        
        await hospitalPool.query('SELECT NOW()');
        console.log('✅ Connected to Hospital database\n');
        
        // Step 1: Get all rows from LifeCycle where mob_desk = 'M'
        console.log('📋 Fetching rows from LifeCycle database (mob_desk = \'M\')...');
        const sourceQuery = `
            SELECT 
                job_role_nav_id,
                org_id,
                int_status,
                job_role_id,
                parent_id,
                app_id,
                label,
                sub_menu,
                sequence,
                access_level,
                is_group,
                mob_desk
            FROM "tblJobRoleNav"
            WHERE mob_desk = 'M'
            ORDER BY job_role_nav_id
        `;
        
        const sourceResult = await lifecyclePool.query(sourceQuery);
        console.log(`✅ Found ${sourceResult.rows.length} rows to copy\n`);
        
        if (sourceResult.rows.length === 0) {
            console.log('⚠️  No rows found with mob_desk = \'M\' in LifeCycle database');
            console.log('   Nothing to copy.\n');
            return;
        }
        
        // Step 2: Check table structure in Hospital database
        console.log('🔍 Checking table structure in Hospital database...');
        const tableCheckQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'tblJobRoleNav'
            ORDER BY ordinal_position
        `;
        
        const tableCheckResult = await hospitalPool.query(tableCheckQuery);
        
        if (tableCheckResult.rows.length === 0) {
            console.error('❌ Table tblJobRoleNav does not exist in Hospital database!');
            console.error('   Please create the table first.\n');
            return;
        }
        
        console.log(`✅ Table exists with ${tableCheckResult.rows.length} columns\n`);
        
        // Step 3: Insert/Update rows in Hospital database
        console.log('📥 Copying rows to Hospital database...\n');
        
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (const row of sourceResult.rows) {
            try {
                // Check if row already exists
                const checkQuery = `
                    SELECT job_role_nav_id
                    FROM "tblJobRoleNav"
                    WHERE job_role_nav_id = $1
                `;
                
                const checkResult = await hospitalPool.query(checkQuery, [row.job_role_nav_id]);
                
                if (checkResult.rows.length > 0) {
                    // Update existing row
                    const updateQuery = `
                        UPDATE "tblJobRoleNav"
                        SET 
                            org_id = $1,
                            int_status = $2,
                            job_role_id = $3,
                            parent_id = $4,
                            app_id = $5,
                            label = $6,
                            sub_menu = $7,
                            sequence = $8,
                            access_level = $9,
                            is_group = $10,
                            mob_desk = $11
                        WHERE job_role_nav_id = $12
                    `;
                    
                    await hospitalPool.query(updateQuery, [
                        row.org_id,
                        row.int_status,
                        row.job_role_id,
                        row.parent_id,
                        row.app_id,
                        row.label,
                        row.sub_menu,
                        row.sequence,
                        row.access_level,
                        row.is_group,
                        row.mob_desk,
                        row.job_role_nav_id
                    ]);
                    
                    updatedCount++;
                    console.log(`   ✅ Updated: ${row.job_role_nav_id} - ${row.label} (${row.job_role_id})`);
                } else {
                    // Insert new row
                    const insertQuery = `
                        INSERT INTO "tblJobRoleNav" (
                            job_role_nav_id,
                            org_id,
                            int_status,
                            job_role_id,
                            parent_id,
                            app_id,
                            label,
                            sub_menu,
                            sequence,
                            access_level,
                            is_group,
                            mob_desk
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    `;
                    
                    await hospitalPool.query(insertQuery, [
                        row.job_role_nav_id,
                        row.org_id,
                        row.int_status,
                        row.job_role_id,
                        row.parent_id,
                        row.app_id,
                        row.label,
                        row.sub_menu,
                        row.sequence,
                        row.access_level,
                        row.is_group,
                        row.mob_desk
                    ]);
                    
                    insertedCount++;
                    console.log(`   ✅ Inserted: ${row.job_role_nav_id} - ${row.label} (${row.job_role_id})`);
                }
            } catch (error) {
                errorCount++;
                console.error(`   ❌ Error processing ${row.job_role_nav_id}: ${error.message}`);
                
                // Continue with next row
                continue;
            }
        }
        
        // Summary
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 COPY SUMMARY');
        console.log(`${'═'.repeat(60)}\n`);
        
        console.log(`Total rows in source: ${sourceResult.rows.length}`);
        console.log(`   ✅ Inserted: ${insertedCount}`);
        console.log(`   🔄 Updated:  ${updatedCount}`);
        console.log(`   ⚠️  Errors:   ${errorCount}`);
        console.log(`   ⏭️  Skipped:  ${skippedCount}\n`);
        
        if (errorCount > 0) {
            console.log('⚠️  Some rows had errors. Check the messages above for details.\n');
        } else {
            console.log('✅ All rows copied successfully!\n');
        }
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('   Stack:', error.stack);
        throw error;
    } finally {
        // Close connections
        if (lifecyclePool) {
            await lifecyclePool.end();
            console.log('🔌 Closed LifeCycle database connection');
        }
        if (hospitalPool) {
            await hospitalPool.end();
            console.log('🔌 Closed Hospital database connection');
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

copyJobRoleNavMobile()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

