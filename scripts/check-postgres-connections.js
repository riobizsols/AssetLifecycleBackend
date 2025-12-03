const { Pool } = require('pg');
require('dotenv').config();

// Use a separate connection for this diagnostic
const diagnosticPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // Only need 1 connection for this check
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkPostgresConnections() {
  const client = await diagnosticPool.connect();
  
  try {
    console.log('🔍 Checking PostgreSQL Connection Limits\n');
    console.log('='.repeat(60));
    
    // Check max_connections setting
    const maxConnQuery = await client.query('SHOW max_connections');
    const maxConnections = parseInt(maxConnQuery.rows[0].max_connections);
    console.log(`\n📊 PostgreSQL max_connections: ${maxConnections}`);
    
    // Check current connections
    const currentConnQuery = await client.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
        count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    const stats = currentConnQuery.rows[0];
    const totalConn = parseInt(stats.total_connections);
    const activeConn = parseInt(stats.active_connections);
    const idleConn = parseInt(stats.idle_connections);
    const idleInTrans = parseInt(stats.idle_in_transaction);
    const idleAborted = parseInt(stats.idle_aborted);
    
    console.log(`\n📈 Current Connections (${client.connectionParameters.database}):`);
    console.log(`   Total: ${totalConn} / ${maxConnections} (${((totalConn/maxConnections)*100).toFixed(1)}%)`);
    console.log(`   Active: ${activeConn}`);
    console.log(`   Idle: ${idleConn}`);
    console.log(`   Idle in Transaction: ${idleInTrans}`);
    console.log(`   Idle Aborted: ${idleAborted}`);
    
    // Check connections by application
    const appConnQuery = await client.query(`
      SELECT 
        application_name,
        count(*) as connection_count,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY application_name
      ORDER BY connection_count DESC
    `);
    
    console.log(`\n📱 Connections by Application:`);
    appConnQuery.rows.forEach(row => {
      console.log(`   ${row.application_name || '(unknown)'}: ${row.connection_count} total (${row.active} active, ${row.idle} idle)`);
    });
    
    // Check connections by user
    const userConnQuery = await client.query(`
      SELECT 
        usename,
        count(*) as connection_count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY usename
      ORDER BY connection_count DESC
    `);
    
    console.log(`\n👤 Connections by User:`);
    userConnQuery.rows.forEach(row => {
      console.log(`   ${row.usename}: ${row.connection_count} connections`);
    });
    
    // Warnings
    console.log(`\n${'='.repeat(60)}`);
    const usagePercent = (totalConn / maxConnections) * 100;
    
    if (usagePercent > 90) {
      console.log('⚠️  WARNING: Connection usage is above 90%!');
      console.log('   Consider:');
      console.log('   1. Closing unused DBeaver/other tool connections');
      console.log('   2. Reducing application pool size (currently max 20)');
      console.log('   3. Increasing PostgreSQL max_connections');
    } else if (usagePercent > 75) {
      console.log('⚠️  WARNING: Connection usage is above 75%');
      console.log('   Monitor closely and consider reducing pool size or closing unused connections');
    } else {
      console.log('✅ Connection usage is healthy');
    }
    
    if (idleInTrans > 0) {
      console.log(`\n⚠️  WARNING: ${idleInTrans} connections are idle in transaction`);
      console.log('   These connections may be holding locks. Check for long-running transactions.');
    }
    
    if (idleAborted > 0) {
      console.log(`\n⚠️  WARNING: ${idleAborted} connections are idle in aborted transaction`);
      console.log('   These connections need to be rolled back.');
    }
    
    console.log(`\n💡 To increase PostgreSQL max_connections:`);
    console.log('   1. Edit postgresql.conf: max_connections = 200 (or higher)');
    console.log('   2. Restart PostgreSQL server');
    console.log('   3. Or set via SQL: ALTER SYSTEM SET max_connections = 200;');
    console.log('      Then reload: SELECT pg_reload_conf();');
    
  } catch (error) {
    console.error('❌ Error checking connections:', error.message);
  } finally {
    client.release();
    await diagnosticPool.end();
  }
}

checkPostgresConnections().catch(console.error);

