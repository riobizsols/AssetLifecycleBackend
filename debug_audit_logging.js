const db = require('./config/db');

async function debugAuditLogging() {
  try {
    console.log('🔍 Debugging audit logging system...');
    
    // Check if LOGIN app exists
    const loginApp = await db.query('SELECT * FROM "tblApps" WHERE app_id = $1', ['LOGIN']);
    console.log('📱 LOGIN app exists:', loginApp.rows.length > 0);
    if (loginApp.rows.length > 0) {
      console.log('   App details:', loginApp.rows[0]);
    }
    
    // Check if LOGOUT app exists
    const logoutApp = await db.query('SELECT * FROM "tblApps" WHERE app_id = $1', ['LOGOUT']);
    console.log('📱 LOGOUT app exists:', logoutApp.rows.length > 0);
    if (logoutApp.rows.length > 0) {
      console.log('   App details:', logoutApp.rows[0]);
    }
    
    // Check if ASSETS app exists
    const assetsApp = await db.query('SELECT * FROM "tblApps" WHERE app_id = $1', ['ASSETS']);
    console.log('📱 ASSETS app exists:', assetsApp.rows.length > 0);
    if (assetsApp.rows.length > 0) {
      console.log('   App details:', assetsApp.rows[0]);
    }
    
    // Check if DEPARTMENTS app exists
    const deptApp = await db.query('SELECT * FROM "tblApps" WHERE app_id = $1', ['DEPARTMENTS']);
    console.log('📱 DEPARTMENTS app exists:', deptApp.rows.length > 0);
    if (deptApp.rows.length > 0) {
      console.log('   App details:', deptApp.rows[0]);
    }
    
    // Check audit config for LOGIN
    const loginConfig = await db.query('SELECT * FROM "tblAuditLogConfig" WHERE app_id = $1', ['LOGIN']);
    console.log('⚙️ LOGIN audit config entries:', loginConfig.rows.length);
    loginConfig.rows.forEach(config => {
      console.log(`   ${config.app_id}/${config.event_id}: enabled=${config.enabled}`);
    });
    
    // Check audit config for LOGOUT
    const logoutConfig = await db.query('SELECT * FROM "tblAuditLogConfig" WHERE app_id = $1', ['LOGOUT']);
    console.log('⚙️ LOGOUT audit config entries:', logoutConfig.rows.length);
    logoutConfig.rows.forEach(config => {
      console.log(`   ${config.app_id}/${config.event_id}: enabled=${config.enabled}`);
    });
    
    // Check audit config for ASSETS
    const assetsConfig = await db.query('SELECT * FROM "tblAuditLogConfig" WHERE app_id = $1', ['ASSETS']);
    console.log('⚙️ ASSETS audit config entries:', assetsConfig.rows.length);
    assetsConfig.rows.forEach(config => {
      console.log(`   ${config.app_id}/${config.event_id}: enabled=${config.enabled}`);
    });
    
    // Check recent audit logs to see what's being recorded
    const recentLogs = await db.query(`
      SELECT al_id, user_id, app_id, event_id, text, created_on 
      FROM "tblAuditLogs" 
      WHERE created_on > CURRENT_DATE - INTERVAL '1 day'
      ORDER BY created_on DESC 
      LIMIT 10
    `);
    console.log('📋 Recent audit logs (last 24 hours):');
    recentLogs.rows.forEach(log => {
      console.log(`  ${log.al_id}: ${log.app_id}/${log.event_id} - ${log.text} (${log.created_on})`);
    });
    
    // Test the isEventEnabled function
    console.log('\n🧪 Testing isEventEnabled function...');
    const AuditLogModel = require('./models/auditLogModel');
    
    // Test LOGIN/Eve001
    const loginEvent = await AuditLogModel.isEventEnabled('LOGIN', 'Eve001');
    console.log('LOGIN/Eve001 enabled:', loginEvent ? 'YES' : 'NO');
    if (loginEvent) {
      console.log('   Config:', loginEvent);
    }
    
    // Test LOGOUT/Eve002
    const logoutEvent = await AuditLogModel.isEventEnabled('LOGOUT', 'Eve002');
    console.log('LOGOUT/Eve002 enabled:', logoutEvent ? 'YES' : 'NO');
    if (logoutEvent) {
      console.log('   Config:', logoutEvent);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugAuditLogging();
