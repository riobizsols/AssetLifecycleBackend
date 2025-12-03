/**
 * Check available databases and connection status
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabases() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 CHECKING DATABASE CONNECTIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check GENERIC_URL
    if (process.env.GENERIC_URL) {
        try {
            const genericConfig = process.env.GENERIC_URL.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
            if (genericConfig) {
                const genericDb = genericConfig[5];
                console.log(`📊 GENERIC_URL: ${genericDb}`);
                
                // Connect to postgres database to list all databases
                const adminPool = new Pool({
                    connectionString: process.env.GENERIC_URL.replace(`/${genericDb}`, '/postgres'),
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                });
                
                try {
                    const dbList = await adminPool.query(`
                        SELECT datname FROM pg_database 
                        WHERE datistemplate = false 
                        ORDER BY datname
                    `);
                    console.log(`   Available databases on this server:`);
                    dbList.rows.forEach(row => {
                        const marker = row.datname === genericDb ? ' ← GENERIC_URL' : '';
                        console.log(`   - ${row.datname}${marker}`);
                    });
                    await adminPool.end();
                } catch (e) {
                    console.log(`   ⚠️  Could not list databases: ${e.message}`);
                }
            }
        } catch (e) {
            console.log(`❌ GENERIC_URL: Error - ${e.message}`);
        }
    } else {
        console.log('❌ GENERIC_URL: Not set in .env file');
    }

    console.log('');

    // Check DATABASE_URL
    if (process.env.DATABASE_URL) {
        try {
            const mainConfig = process.env.DATABASE_URL.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
            if (mainConfig) {
                const mainDb = mainConfig[5];
                console.log(`📊 DATABASE_URL: ${mainDb}`);
                
                // Try to connect
                const testPool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                });
                
                try {
                    await testPool.query('SELECT NOW()');
                    console.log(`   ✅ Database "${mainDb}" exists and is accessible`);
                    await testPool.end();
                } catch (e) {
                    console.log(`   ❌ Database "${mainDb}" does not exist or is not accessible`);
                    console.log(`   Error: ${e.message}`);
                    
                    // Try to list available databases
                    try {
                        const adminPool = new Pool({
                            connectionString: process.env.DATABASE_URL.replace(`/${mainDb}`, '/postgres'),
                            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                        });
                        const dbList = await adminPool.query(`
                            SELECT datname FROM pg_database 
                            WHERE datistemplate = false 
                            ORDER BY datname
                        `);
                        console.log(`\n   💡 Available databases on this server:`);
                        dbList.rows.forEach(row => {
                            console.log(`   - ${row.datname}`);
                        });
                        console.log(`\n   💡 To create the database "${mainDb}", run:`);
                        console.log(`   CREATE DATABASE "${mainDb}";`);
                        await adminPool.end();
                    } catch (adminError) {
                        console.log(`   ⚠️  Could not list databases: ${adminError.message}`);
                    }
                }
            }
        } catch (e) {
            console.log(`❌ DATABASE_URL: Error - ${e.message}`);
        }
    } else {
        console.log('❌ DATABASE_URL: Not set in .env file');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
}

checkDatabases().catch(console.error);


