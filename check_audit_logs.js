const db = require('./config/db');

async function checkAuditLogs() {
  try {
    console.log('🔍 Checking audit logs...');
    
    // Check if table exists and count records
    const countResult = await db.query('SELECT COUNT(*) as count FROM "tblAuditLogs"');
    console.log('📊 Total audit logs:', countResult.rows[0].count);
    
    // Check recent audit logs
    const recentResult = await db.query(`
      SELECT al_id, user_id, app_id, event_id, text, created_on 
      FROM "tblAuditLogs" 
      ORDER BY created_on DESC 
      LIMIT 5
    `);
    
    console.log('📋 Recent audit logs:');
    recentResult.rows.forEach(log => {
      console.log(`  ${log.al_id}: ${log.app_id}/${log.event_id} - ${log.text} (${log.created_on})`);
    });
    
    // Check audit log config
    const configResult = await db.query('SELECT COUNT(*) as count FROM "tblAuditLogConfig"');
    console.log('⚙️ Audit log config entries:', configResult.rows[0].count);
    
    // Check if any events are enabled
    const enabledResult = await db.query('SELECT COUNT(*) as count FROM "tblAuditLogConfig" WHERE enabled = true');
    console.log('✅ Enabled audit events:', enabledResult.rows[0].count);
    
    // Check some specific audit config entries
    const configEntries = await db.query(`
      SELECT alc.app_id, alc.event_id, alc.enabled, a.app_name, e.event_name 
      FROM "tblAuditLogConfig" alc
      LEFT JOIN "tblApps" a ON alc.app_id = a.app_id
      LEFT JOIN "tblEvents" e ON alc.event_id = e.event_id
      WHERE alc.enabled = true
      LIMIT 10
    `);
    console.log('📋 Enabled audit config entries:');
    configEntries.rows.forEach(config => {
      console.log(`  ${config.app_id}/${config.event_id}: ${config.app_name}/${config.event_name} (enabled: ${config.enabled})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAuditLogs();
