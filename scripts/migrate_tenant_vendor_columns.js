const { Client } = require('pg');
require('dotenv').config();
const tenantService = require('../services/tenantService');

/**
 * Migrate tenant databases to add contract_start_date and contract_end_date columns
 * This script will update all existing tenant databases
 */
async function migrateTenantDatabases() {
  try {
    console.log('🔄 Starting tenant database migration for vendor contract dates...\n');
    
    // Get all tenants
    const pool = tenantService.initTenantRegistryPool();
    const tenantsResult = await pool.query(`
      SELECT org_id, db_host, db_port, db_name, db_user, db_password 
      FROM "tenants" 
      WHERE is_active = true
    `);
    const tenants = tenantsResult.rows;
    
    if (tenants.length === 0) {
      console.log('ℹ️  No active tenants found');
      await pool.end();
      return;
    }
    
    console.log(`📋 Found ${tenants.length} active tenant(s) to migrate\n`);
    
    const sql = `
      ALTER TABLE public."tblVendors" 
      ADD COLUMN IF NOT EXISTS contract_start_date DATE,
      ADD COLUMN IF NOT EXISTS contract_end_date DATE;
      
      COMMENT ON COLUMN public."tblVendors".contract_start_date IS 'Contract start date for vendor';
      COMMENT ON COLUMN public."tblVendors".contract_end_date IS 'Contract end date for vendor';
    `;
    
    let successCount = 0;
    let failCount = 0;
    
    for (const tenant of tenants) {
      try {
        console.log(`🔄 Migrating tenant: ${tenant.org_id}...`);
        
        // Decrypt password if needed
        const tenantService = require('../services/tenantService');
        const credentials = await tenantService.getTenantCredentials(tenant.org_id);
        const dbPassword = credentials.password;
        
        // Build connection string using tenantService helper
        const connectionString = tenantService.getTenantConnectionString(credentials);
        
        const tenantClient = new Client({
          connectionString: connectionString
        });
        
        await tenantClient.connect();
        await tenantClient.query(sql);
        await tenantClient.end();
        
        console.log(`✅ Successfully migrated tenant: ${tenant.org_id}\n`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to migrate tenant ${tenant.org_id}:`, error.message);
        failCount++;
      }
    }
    
    await pool.end();
    
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📋 Total: ${tenants.length}`);
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

// Run migration
migrateTenantDatabases();

