const cron = require('node-cron');
const { getDb } = require('../utils/dbContext');
const { createVendorContractRenewalWorkflow } = require('../models/vendorContractRenewalModel');
const { deactivateExpiredVendors } = require('../models/vendorContractRenewalModel');

/**
 * ==================================================================================
 * VENDOR CONTRACT RENEWAL - AUTOMATED CRON JOB
 * ==================================================================================
 * 
 * PURPOSE:
 * Automatically checks vendor contract end dates and:
 * 1. Creates renewal notifications for contracts ending within 10 days (0-10 days)
 * 2. Deactivates vendors (int_status = 0) if contract expired and renewal not completed
 * 
 * HOW IT WORKS:
 * 1. Checks vendors with contract_end_date within 10 days (today to 10 days from today)
 * 2. Creates workflow notifications for admin users
 * 3. Checks vendors with contract_end_date < today (expired)
 * 4. Blocks vendors that haven't been renewed (workflow not approved before contract_end_date)
 * 
 * SCHEDULE: 
 * - Default: Every day at 8:00 AM IST
 * - Cron Expression: '0 8 * * *'
 * 
 * ==================================================================================
 */

let vendorContractCronJob = null;

/**
 * Start the Vendor Contract Renewal cron job
 */
const startVendorContractRenewalCron = () => {
  try {
    // Stop existing job if it's running
    if (vendorContractCronJob) {
      vendorContractCronJob.stop();
    }

    // Create and start the cron job
    // Runs every day at 8:00 AM IST
    vendorContractCronJob = cron.schedule('0 8 * * *', async () => {
      const startTime = Date.now();
      const executionTime = new Date().toISOString();
      const userId = 'SYSTEM';
      
      console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
      console.log('║  VENDOR CONTRACT RENEWAL - AUTOMATED PROCESS STARTED            ║');
      console.log('╚═══════════════════════════════════════════════════════════════════╝');
      console.log('⏰ Execution Time:', executionTime);
      console.log('📋 Task: Check vendor contract end dates and create renewal workflows');
      console.log('───────────────────────────────────────────────────────────────────\n');

      try {
        const dbPool = getDb();
        
        // Step 1: Check vendors with contract ending within 10 days (0-10 days)
        console.log('📅 Step 1: Checking vendors with contracts ending within 10 days...');
        const todayDate = new Date();
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        const todayStr = todayDate.toISOString().split('T')[0];
        const tenDaysDateStr = tenDaysFromNow.toISOString().split('T')[0];
        
        const vendorsDueQuery = `
          SELECT 
            v.vendor_id,
            v.vendor_name,
            v.contract_end_date,
            v.org_id,
            v.branch_code,
            v.int_status
          FROM "tblVendors" v
          WHERE v.contract_end_date IS NOT NULL
            AND v.contract_end_date::date >= $1::date
            AND v.contract_end_date::date <= $2::date
            AND v.int_status = 1
            AND NOT EXISTS (
              SELECT 1 
              FROM "tblWFAssetMaintSch_H" wfh
              WHERE wfh.vendor_id = v.vendor_id
                AND wfh.maint_type_id = 'MT005'
                AND wfh.status IN ('IN', 'IP', 'CO')
                AND wfh.pl_sch_date = v.contract_end_date
            )
          ORDER BY v.contract_end_date ASC, v.vendor_id
        `;
        
        const vendorsDueResult = await dbPool.query(vendorsDueQuery, [todayStr, tenDaysDateStr]);
        console.log(`   Found ${vendorsDueResult.rows.length} vendor(s) with contracts ending within 10 days`);
        
        // Sequential loop: one connection at a time. Do NOT use forEach+async or Promise.all
        // or the pool will be exhausted (connection storm) and login/API will time out.
        for (const vendor of vendorsDueResult.rows) {
          try {
            console.log(`   Creating renewal workflow for vendor: ${vendor.vendor_name} (${vendor.vendor_id})`);
            await createVendorContractRenewalWorkflow(vendor);
            console.log(`   ✅ Created renewal workflow for ${vendor.vendor_id}`);
          } catch (err) {
            console.error(`   ❌ Failed to create renewal workflow for ${vendor.vendor_id}:`, err.message);
          }
        }
        
    // Step 2: Deactivate vendors with expired contracts (renewal not completed before contract_end_date)
    console.log('\n📅 Step 2: Checking vendors with expired contracts...');
    const todayDateStr = todayDate.toISOString().split('T')[0];
    
    const expiredVendorsResult = await deactivateExpiredVendors(todayDateStr);
        console.log(`   Processed ${expiredVendorsResult.deactivated} expired vendor(s)`);
        
        const duration = Date.now() - startTime;
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║  VENDOR CONTRACT RENEWAL - PROCESS COMPLETED                    ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log(`✅ Process completed in ${duration}ms`);
        console.log(`📊 Summary:`);
        console.log(`   - Renewal workflows created: ${vendorsDueResult.rows.length}`);
        console.log(`   - Vendors deactivated: ${expiredVendorsResult.deactivated}`);
        console.log('───────────────────────────────────────────────────────────────────\n');
        
      } catch (error) {
        console.error('❌ Error in vendor contract renewal cron job:', error);
        console.error('Stack trace:', error.stack);
      }
    });

    console.log('✅ Vendor Contract Renewal cron job scheduled (runs daily at 8:00 AM IST)');
    return vendorContractCronJob;
  } catch (error) {
    console.error('❌ Failed to start vendor contract renewal cron job:', error);
    throw error;
  }
};

/**
 * Stop the Vendor Contract Renewal cron job
 */
const stopVendorContractRenewalCron = () => {
  if (vendorContractCronJob) {
    vendorContractCronJob.stop();
    vendorContractCronJob = null;
    console.log('✅ Vendor Contract Renewal cron job stopped');
  }
};

/**
 * Manually trigger vendor contract renewal check (for testing/manual execution)
 */
const triggerVendorContractRenewal = async () => {
  const startTime = Date.now();
  const executionTime = new Date().toISOString();
  const userId = 'SYSTEM';
  
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║  VENDOR CONTRACT RENEWAL - MANUAL TRIGGER                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('⏰ Execution Time:', executionTime);
  console.log('📋 Task: Check vendor contract end dates and create renewal workflows');
  console.log('───────────────────────────────────────────────────────────────────\n');

  try {
    const dbPool = getDb();
    
    // Step 1: Check vendors with contract ending within 10 days (0-10 days)
    console.log('📅 Step 1: Checking vendors with contracts ending within 10 days...');
    const todayDate = new Date();
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
    const todayStr = todayDate.toISOString().split('T')[0];
    const tenDaysDateStr = tenDaysFromNow.toISOString().split('T')[0];
    
    const vendorsDueQuery = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        v.contract_end_date,
        v.org_id,
        v.branch_code,
        v.int_status
      FROM "tblVendors" v
      WHERE v.contract_end_date IS NOT NULL
        AND v.contract_end_date::date >= $1::date
        AND v.contract_end_date::date <= $2::date
        AND v.int_status = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM "tblWFAssetMaintSch_H" wfh
          WHERE wfh.vendor_id = v.vendor_id
            AND wfh.maint_type_id = 'MT005'
            AND wfh.status IN ('IN', 'IP', 'CO')
            AND wfh.pl_sch_date = v.contract_end_date
        )
      ORDER BY v.contract_end_date ASC, v.vendor_id
    `;
    
    const vendorsDueResult = await dbPool.query(vendorsDueQuery, [todayStr, tenDaysDateStr]);
    console.log(`   Found ${vendorsDueResult.rows.length} vendor(s) with contracts ending within 10 days`);
    
    // Sequential loop: one connection at a time (pool-friendly; do not switch to forEach+async).
    for (const vendor of vendorsDueResult.rows) {
      try {
        console.log(`   Creating renewal workflow for vendor: ${vendor.vendor_name} (${vendor.vendor_id})`);
        await createVendorContractRenewalWorkflow(vendor);
        console.log(`   ✅ Created renewal workflow for ${vendor.vendor_id}`);
      } catch (err) {
        console.error(`   ❌ Failed to create renewal workflow for ${vendor.vendor_id}:`, err.message);
      }
    }
    
    // Step 2: Deactivate vendors with expired contracts (renewal not completed before contract_end_date)
    console.log('\n📅 Step 2: Checking vendors with expired contracts...');
    const todayDateStr = todayDate.toISOString().split('T')[0];
    
    const expiredVendorsResult = await deactivateExpiredVendors(todayDateStr);
    console.log(`   Processed ${expiredVendorsResult.deactivated} expired vendor(s)`);
    
    const duration = Date.now() - startTime;
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  VENDOR CONTRACT RENEWAL - PROCESS COMPLETED                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`✅ Process completed in ${duration}ms`);
    console.log(`📊 Summary:`);
    console.log(`   - Renewal workflows created: ${vendorsDueResult.rows.length}`);
    console.log(`   - Vendors deactivated: ${expiredVendorsResult.deactivated}`);
    console.log('───────────────────────────────────────────────────────────────────\n');
    
    return {
      success: true,
      message: 'Vendor contract renewal check completed',
      workflowsCreated: vendorsDueResult.rows.length,
      vendorsDeactivated: expiredVendorsResult.deactivated,
      duration: duration
    };
  } catch (error) {
    console.error('❌ Error in vendor contract renewal manual trigger:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

module.exports = {
  startVendorContractRenewalCron,
  stopVendorContractRenewalCron,
  triggerVendorContractRenewal
};

