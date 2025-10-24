const db = require('./config/db');

async function diagnoseAuditLogging() {
  try {
    console.log('🔍 Diagnosing Audit Logging Issues...\n');
    
    // Check if apps exist
    const appsToCheck = ['LOGIN', 'LOGOUT', 'DEPARTMENTS', 'PRODSERV', 'ASSETS'];
    console.log('📱 Checking if apps exist:');
    for (const appId of appsToCheck) {
      const appResult = await db.query('SELECT * FROM "tblApps" WHERE app_id = $1', [appId]);
      console.log(`   ${appId}: ${appResult.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
      if (appResult.rows.length > 0) {
        console.log(`      Name: ${appResult.rows[0].app_name}`);
      }
    }
    
    console.log('\n⚙️ Checking audit log configuration:');
    for (const appId of appsToCheck) {
      const configResult = await db.query(`
        SELECT alc.app_id, alc.event_id, alc.enabled, e.text as event_name
        FROM "tblAuditLogConfig" alc
        LEFT JOIN "tblEvents" e ON alc.event_id = e.event_id
        WHERE alc.app_id = $1
        ORDER BY alc.enabled DESC, e.text
      `, [appId]);
      
      console.log(`\n   ${appId} (${configResult.rows.length} events):`);
      if (configResult.rows.length === 0) {
        console.log('      ❌ NO EVENTS CONFIGURED');
      } else {
        configResult.rows.forEach(config => {
          const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
          console.log(`      ${status}: ${config.event_id} - ${config.event_name || 'Unknown'}`);
        });
      }
    }
    
    // Check recent audit logs
    console.log('\n📋 Recent audit logs (last 10):');
    const recentLogs = await db.query(`
      SELECT al_id, user_id, app_id, event_id, text, created_on 
      FROM "tblAuditLogs" 
      ORDER BY created_on DESC 
      LIMIT 10
    `);
    
    if (recentLogs.rows.length === 0) {
      console.log('   ❌ NO AUDIT LOGS FOUND');
    } else {
      recentLogs.rows.forEach(log => {
        const date = new Date(log.created_on).toLocaleString();
        console.log(`   ${log.al_id}: ${log.app_id}/${log.event_id} - ${log.text} (${date})`);
      });
    }
    
    // Check if there are any audit logs from today
    console.log('\n📅 Audit logs from today:');
    const todayLogs = await db.query(`
      SELECT COUNT(*) as count, app_id
      FROM "tblAuditLogs" 
      WHERE DATE(created_on) = CURRENT_DATE
      GROUP BY app_id
      ORDER BY count DESC
    `);
    
    if (todayLogs.rows.length === 0) {
      console.log('   ❌ NO AUDIT LOGS FROM TODAY');
    } else {
      todayLogs.rows.forEach(log => {
        console.log(`   ${log.app_id}: ${log.count} logs`);
      });
    }
    
    // Check specific events that should be working
    console.log('\n🎯 Checking specific events:');
    const specificEvents = [
      { app_id: 'LOGIN', event_id: 'Eve001' },
      { app_id: 'LOGOUT', event_id: 'Eve002' },
      { app_id: 'DEPARTMENTS', event_id: 'Eve004' },
      { app_id: 'PRODSERV', event_id: 'Eve005' }
    ];
    
    for (const event of specificEvents) {
      const eventResult = await db.query(`
        SELECT alc.enabled, e.text as event_name
        FROM "tblAuditLogConfig" alc
        LEFT JOIN "tblEvents" e ON alc.event_id = e.event_id
        WHERE alc.app_id = $1 AND alc.event_id = $2
      `, [event.app_id, event.event_id]);
      
      if (eventResult.rows.length === 0) {
        console.log(`   ${event.app_id}/${event.event_id}: ❌ NOT CONFIGURED`);
      } else {
        const config = eventResult.rows[0];
        const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
        console.log(`   ${event.app_id}/${event.event_id}: ${status} - ${config.event_name || 'Unknown'}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseAuditLogging();
