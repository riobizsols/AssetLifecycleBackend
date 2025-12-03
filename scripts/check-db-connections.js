/**
 * Check database connection status and PostgreSQL settings
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkDatabaseConnections() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 DATABASE CONNECTION DIAGNOSTICS');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Check PostgreSQL max_connections setting
        const maxConnResult = await pool.query('SHOW max_connections');
        const maxConnections = parseInt(maxConnResult.rows[0].max_connections);
        console.log(`📊 PostgreSQL max_connections: ${maxConnections}`);

        // Check current active connections
        const activeConnResult = await pool.query(`
            SELECT 
                count(*) as total_connections,
                count(*) FILTER (WHERE state = 'active') as active_connections,
                count(*) FILTER (WHERE state = 'idle') as idle_connections,
                count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
                count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_in_transaction_aborted
            FROM pg_stat_activity
            WHERE datname = current_database()
        `);
        const connStats = activeConnResult.rows[0];
        console.log(`\n📈 Current Connection Statistics:`);
        console.log(`   Total connections: ${connStats.total_connections}`);
        console.log(`   Active connections: ${connStats.active_connections}`);
        console.log(`   Idle connections: ${connStats.idle_connections}`);
        console.log(`   Idle in transaction: ${connStats.idle_in_transaction}`);
        console.log(`   Idle in transaction (aborted): ${connStats.idle_in_transaction_aborted}`);

        // Check connections by application name
        const appConnResult = await pool.query(`
            SELECT 
                application_name,
                count(*) as connection_count,
                count(*) FILTER (WHERE state = 'active') as active,
                count(*) FILTER (WHERE state = 'idle') as idle,
                count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_trans
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY application_name
            ORDER BY connection_count DESC
        `);
        console.log(`\n📱 Connections by Application:`);
        appConnResult.rows.forEach(row => {
            console.log(`   ${row.application_name || '(no name)'}: ${row.connection_count} total (${row.active} active, ${row.idle} idle, ${row.idle_in_trans} idle in trans)`);
        });

        // Check for long-running queries
        const longQueriesResult = await pool.query(`
            SELECT 
                pid,
                usename,
                application_name,
                client_addr,
                state,
                query_start,
                state_change,
                now() - query_start as duration,
                LEFT(query, 100) as query_preview
            FROM pg_stat_activity
            WHERE datname = current_database()
            AND state != 'idle'
            AND now() - query_start > interval '5 seconds'
            ORDER BY query_start
        `);
        if (longQueriesResult.rows.length > 0) {
            console.log(`\n⚠️  Long-running queries (>5 seconds):`);
            longQueriesResult.rows.forEach(row => {
                console.log(`   PID ${row.pid}: ${row.duration} - ${row.query_preview}`);
            });
        }

        // Check for idle in transaction connections (potential leaks)
        const idleInTransResult = await pool.query(`
            SELECT 
                pid,
                usename,
                application_name,
                state,
                now() - state_change as idle_duration,
                LEFT(query, 100) as query_preview
            FROM pg_stat_activity
            WHERE datname = current_database()
            AND state = 'idle in transaction'
            ORDER BY state_change
        `);
        if (idleInTransResult.rows.length > 0) {
            console.log(`\n⚠️  Connections idle in transaction (potential leaks):`);
            idleInTransResult.rows.forEach(row => {
                console.log(`   PID ${row.pid}: idle for ${row.idle_duration} - ${row.query_preview}`);
            });
        }

        // Check connection usage percentage
        const usagePercent = ((connStats.total_connections / maxConnections) * 100).toFixed(2);
        console.log(`\n📊 Connection Usage: ${connStats.total_connections}/${maxConnections} (${usagePercent}%)`);

        if (connStats.total_connections >= maxConnections * 0.9) {
            console.log(`\n❌ WARNING: Connection usage is above 90%!`);
        } else if (connStats.total_connections >= maxConnections * 0.75) {
            console.log(`\n⚠️  WARNING: Connection usage is above 75%!`);
        }

        // Recommendations
        console.log(`\n💡 Recommendations:`);
        if (maxConnections < 100) {
            console.log(`   - Consider increasing PostgreSQL max_connections (currently ${maxConnections})`);
            console.log(`   - Run: ALTER SYSTEM SET max_connections = 200; (then restart PostgreSQL)`);
        }
        if (connStats.idle_in_transaction > 0) {
            console.log(`   - Found ${connStats.idle_in_transaction} connections idle in transaction`);
            console.log(`   - These may be connection leaks - check for uncommitted transactions`);
        }
        if (connStats.total_connections > maxConnections * 0.8) {
            console.log(`   - Consider reducing DB_POOL_MAX in your application`);
            console.log(`   - Current pool max should be less than ${Math.floor(maxConnections * 0.8)}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkDatabaseConnections();


