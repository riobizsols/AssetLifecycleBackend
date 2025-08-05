const db = require('./config/db');

async function checkUSR002Role() {
  try {
    console.log('🔍 Checking USR002 job role...\n');
    
    const result = await db.query(
      `SELECT user_id, job_role_id
       FROM "tblUserJobRoles"
       WHERE user_id = 'USR002'`
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ USR002 Details:');
      console.log(`   User ID: ${user.user_id}`);
      console.log(`   Job Role ID: ${user.job_role_id}`);
    } else {
      console.log('❌ USR002 not found in tblUserJobRoles');
    }
    
  } catch (error) {
    console.error('❌ Error checking USR002 role:', error);
  } finally {
    await db.end();
  }
}

checkUSR002Role(); 