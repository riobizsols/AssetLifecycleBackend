const { Client } = require('pg');
require('dotenv').config();

async function manageConnections() {
  // Use a direct client connection
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
  } catch (error) {
    if (error.code === '53300') {
      console.error('❌ Cannot connect - database is at max connections limit!');
      console.error('   You need to manually close connections or restart PostgreSQL.');
      console.error('   Or wait for idle connections to timeout.');
      process.exit(1);
    }
    throw error;
  }
  
  try {
    console.log('🔍 DATABASE CONNECTION ANALYSIS\n');
    console.log('='.repeat(70));
    
    // 1. Check max_connections setting
    const maxConnResult = await client.query('SHOW max_connections');
    const maxConnections = parseInt(maxConnResult.rows[0].max_connections);
    console.log(`\n📊 PostgreSQL max_connections: ${maxConnections}`);
    
    // 2. Get current connection statistics
    const statsQuery = `
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    
    const statsResult = await client.query(statsQuery);
    const stats = statsResult.rows[0];
    const totalConn = parseInt(stats.total_connections);
    const activeConn = parseInt(stats.active_connections);
    const idleConn = parseInt(stats.idle_connections);
    const idleInTrans = parseInt(stats.idle_in_transaction);
    const idleAborted = parseInt(stats.idle_aborted);
    
    console.log(`\n📈 CURRENT CONNECTIONS:`);
    console.log(`   Total: ${totalConn} / ${maxConnections} (${((totalConn/maxConnections)*100).toFixed(1)}%)`);
    console.log(`   Active: ${activeConn}`);
    console.log(`   Idle: ${idleConn}`);
    console.log(`   Idle in Transaction: ${idleInTrans}`);
    console.log(`   Idle Aborted: ${idleAborted}`);
    
    // 3. Show connections by application
    const appQuery = `
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
    `;
    
    const appResult = await client.query(appQuery);
    console.log(`\n📱 CONNECTIONS BY APPLICATION:`);
    appResult.rows.forEach(row => {
      const appName = row.application_name || '(unknown)';
      console.log(`   ${appName}:`);
      console.log(`      Total: ${row.connection_count}, Active: ${row.active}, Idle: ${row.idle}, Idle in Trans: ${row.idle_in_trans}`);
    });
    
    // 4. Show detailed idle connections (can be killed)
    const idleQuery = `
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        state_change,
        query_start,
        NOW() - state_change as idle_duration,
        LEFT(query, 100) as last_query
      FROM pg_stat_activity
      WHERE datname = current_database()
      AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
      AND pid != pg_backend_pid()
      ORDER BY state_change ASC
    `;
    
    const idleResult = await client.query(idleQuery);
    
    if (idleResult.rows.length > 0) {
      console.log(`\n💤 IDLE CONNECTIONS (can be terminated):`);
      console.log(`   Found ${idleResult.rows.length} idle connection(s)\n`);
      
      idleResult.rows.forEach((row, idx) => {
        const duration = row.idle_duration;
        const hours = Math.floor(duration.total_seconds / 3600);
        const minutes = Math.floor((duration.total_seconds % 3600) / 60);
        const seconds = Math.floor(duration.total_seconds % 60);
        const durationStr = `${hours}h ${minutes}m ${seconds}s`;
        
        console.log(`   ${idx + 1}. PID: ${row.pid}`);
        console.log(`      User: ${row.usename}`);
        console.log(`      Application: ${row.application_name || '(unknown)'}`);
        console.log(`      State: ${row.state}`);
        console.log(`      Idle Duration: ${durationStr}`);
        console.log(`      Last Query: ${row.last_query || 'N/A'}`);
        console.log('');
      });
      
      // 5. Ask if user wants to kill idle connections
      console.log('='.repeat(70));
      console.log('\n💡 OPTIONS:');
      console.log('   1. Kill all idle connections (safe - only kills idle ones)');
      console.log('   2. Kill idle connections older than 5 minutes');
      console.log('   3. Kill idle connections from specific application');
      console.log('   4. Exit without killing');
      
      // For automation, we'll kill idle connections older than 5 minutes
      const killOldIdleQuery = `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
        AND pid != pg_backend_pid()
        AND state_change < NOW() - INTERVAL '5 minutes'
      `;
      
      const killResult = await client.query(killOldIdleQuery);
      const killedCount = killResult.rowCount;
      
      if (killedCount > 0) {
        console.log(`\n✅ Terminated ${killedCount} idle connection(s) older than 5 minutes`);
      } else {
        console.log(`\nℹ️  No idle connections older than 5 minutes to terminate`);
      }
      
      // Also kill aborted transactions
      const killAbortedQuery = `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = current_database()
        AND state = 'idle in transaction (aborted)'
        AND pid != pg_backend_pid()
      `;
      
      const killAbortedResult = await client.query(killAbortedQuery);
      if (killAbortedResult.rowCount > 0) {
        console.log(`✅ Terminated ${killAbortedResult.rowCount} aborted transaction(s)`);
      }
      
    } else {
      console.log(`\n✅ No idle connections found (all connections are active)`);
    }
    
    // 6. Show connections by user
    const userQuery = `
      SELECT 
        usename,
        count(*) as connection_count,
        count(*) FILTER (WHERE state = 'active') as active
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY usename
      ORDER BY connection_count DESC
    `;
    
    const userResult = await client.query(userQuery);
    console.log(`\n👤 CONNECTIONS BY USER:`);
    userResult.rows.forEach(row => {
      console.log(`   ${row.usename}: ${row.connection_count} total (${row.active} active)`);
    });
    
    // 7. Recommendations
    console.log('\n' + '='.repeat(70));
    console.log('💡 RECOMMENDATIONS:');
    
    const usagePercent = (totalConn / maxConnections) * 100;
    
    if (usagePercent > 90) {
      console.log('⚠️  CRITICAL: Connection usage is above 90%!');
      console.log('   Actions:');
      console.log('   1. Close all unused DBeaver connections');
      console.log('   2. Restart your Node.js server');
      console.log('   3. Consider increasing PostgreSQL max_connections');
    } else if (usagePercent > 75) {
      console.log('⚠️  WARNING: Connection usage is above 75%');
      console.log('   Actions:');
      console.log('   1. Close unused DBeaver connections');
      console.log('   2. Monitor connection usage');
    } else {
      console.log('✅ Connection usage is healthy');
    }
    
    if (idleInTrans > 0) {
      console.log(`\n⚠️  WARNING: ${idleInTrans} connections are idle in transaction`);
      console.log('   These may be holding locks. Consider killing them.');
    }
    
    if (idleAborted > 0) {
      console.log(`\n⚠️  WARNING: ${idleAborted} connections are idle in aborted transaction`);
      console.log('   These should be killed immediately.');
    }
    
    console.log('\n📋 TO INCREASE POSTGRESQL MAX_CONNECTIONS:');
    console.log('   1. Edit postgresql.conf: max_connections = 200');
    console.log('   2. Restart PostgreSQL');
    console.log('   OR run: ALTER SYSTEM SET max_connections = 200;');
    console.log('   Then: SELECT pg_reload_conf();');
    
    // 8. Final stats
    const finalStats = await client.query(statsQuery);
    const finalTotal = parseInt(finalStats.rows[0].total_connections);
    console.log(`\n📊 FINAL CONNECTION COUNT: ${finalTotal} / ${maxConnections}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const killAll = args.includes('--kill-all');
const killOld = args.includes('--kill-old') || !killAll; // Default to killing old

manageConnections().catch(console.error);

