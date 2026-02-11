/**
 * Check tblApps entries in GENERIC_URL to find all app_ids
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkAppsInGenericUrl() {
  const genericPool = new Pool({
    connectionString: process.env.GENERIC_URL,
    max: 5
  });

  try {
    console.log('🔍 Checking tblApps in GENERIC_URL (template database)...\n');
    
    const result = await genericPool.query(`
      SELECT app_id, text, org_id
      FROM "tblApps"
      ORDER BY app_id
    `);
    
    console.log(`📋 Found ${result.rows.length} app entries:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.app_id} - ${row.text || '(no label)'} (org: ${row.org_id})`);
    });
    
    // Check specifically for WORKORDERMANAGEMENT
    const workOrderApp = result.rows.find(r => r.app_id === 'WORKORDERMANAGEMENT');
    
    if (workOrderApp) {
      console.log(`\n✅ WORKORDERMANAGEMENT exists in GENERIC_URL`);
      console.log(`   Label: ${workOrderApp.text}`);
      console.log(`   Org: ${workOrderApp.org_id}`);
    } else {
      console.log(`\n❌ WORKORDERMANAGEMENT NOT found in GENERIC_URL`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await genericPool.end();
  }
}

checkAppsInGenericUrl();
