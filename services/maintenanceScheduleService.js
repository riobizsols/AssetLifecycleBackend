const cron = require('node-cron');
const pool = require('../config/db');

let executionCount = 0;

// Configuration for maintenance scheduling
const MAINTENANCE_CONFIG = {
  advanceWarningDays: 10, 
  cronSchedule: '0 * * * *',
  enableAdvanceScheduling: true 
};

// Dummy function for testing 
const dummyMaintenanceSchedule = () => {
  executionCount++;
  console.log(`Hello World with count ${executionCount}`);
  console.log(`[${new Date().toISOString()}] Maintenance Schedule Cron Job executed - Count: ${executionCount}`);
  console.log(` Execution count updated to: ${executionCount}`);
};

// Main maintenance schedule creation function
const createMaintenanceSchedule = async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting maintenance schedule creation...`);
    
    // Step 1: Get asset types where maintenance is required
    const assetTypesQuery = `
      SELECT asset_type_id, maint_required 
      FROM "tblAssetTypes" 
      WHERE maint_required = true
    `;
    
    const assetTypesResult = await pool.query(assetTypesQuery);
    console.log(`Found ${assetTypesResult.rows.length} asset types requiring maintenance`);
    
    for (const assetType of assetTypesResult.rows) {
      console.log(`Processing asset type: ${assetType.asset_type_id}`);
      
      // Step 2: Get assets for this asset type and maintenance frequency
      const assetsQuery = `
        SELECT 
          a.asset_id,
          a.purchased_on,
          a.service_vendor_id,
          a.org_id,
          amf.at_main_freq_id,
          amf.frequency,
          amf.uom
        FROM "tblAssets" a
        LEFT JOIN "tblATMaintFreq" amf ON a.asset_type_id = amf.asset_type_id
        WHERE a.asset_type_id = $1
      `;
      
      const assetsResult = await pool.query(assetsQuery, [assetType.asset_type_id]);
      
      for (const asset of assetsResult.rows) {
        console.log(`🔍 Processing asset: ${asset.asset_id}`);
        console.log(`   Asset details: purchased_on=${asset.purchased_on}, frequency=${asset.frequency}, uom=${asset.uom}`);
        
        // Step 3a: Check if there are any "IN" status records in tblAssetMaintSch
        const checkInStatusQuery = `
          SELECT COUNT(*) as count 
          FROM "tblAssetMaintSch" 
          WHERE asset_id = $1 AND status = 'IN'
        `;
        
        const inStatusResult = await pool.query(checkInStatusQuery, [asset.asset_id]);
        
        if (inStatusResult.rows[0].count > 0) {
          console.log(`Asset ${asset.asset_id} has IN status records, skipping...`);
          continue;
        }
        
        // Step 3b-c: Check for "CO" or "CA" status and get latest date
        let dateToConsider = asset.purchased_on;
        
        const checkCompletedStatusQuery = `
          SELECT act_maint_st_date 
          FROM "tblAssetMaintSch" 
          WHERE asset_id = $1 AND status IN ('CO', 'CA')
          ORDER BY act_maint_st_date DESC 
          LIMIT 1
        `;
        
        const completedStatusResult = await pool.query(checkCompletedStatusQuery, [asset.asset_id]);
        
        if (completedStatusResult.rows.length > 0) {
          const completedDate = completedStatusResult.rows[0].act_maint_st_date;
          dateToConsider = new Date(Math.max(new Date(dateToConsider), new Date(completedDate)));
        }
        
        // Step 3d: Check tblWFAssetMaintSch_H for "IN" or "IP" status
        const checkWFInStatusQuery = `
          SELECT COUNT(*) as count 
          FROM "tblWFAssetMaintSch_H" 
          WHERE asset_id = $1 AND status IN ('IN', 'IP')
        `;
        
        const wfInStatusResult = await pool.query(checkWFInStatusQuery, [asset.asset_id]);
        console.log(`🔍 Asset ${asset.asset_id}: Found ${wfInStatusResult.rows[0].count} existing 'IN/IP' status records in workflow`);
        
        if (wfInStatusResult.rows[0].count > 0) {
          console.log(`⏭️ Asset ${asset.asset_id} has IN/IP status in workflow, skipping...`);
          continue;
        }
        
        // Step 3e-f: Check for "CO" or "CA" status in workflow and get latest date
        const checkWFCompletedStatusQuery = `
          SELECT act_sch_date 
          FROM "tblWFAssetMaintSch_H" 
          WHERE asset_id = $1 AND status IN ('CO', 'CA')
          ORDER BY act_sch_date DESC 
          LIMIT 1
        `;
        
        const wfCompletedStatusResult = await pool.query(checkWFCompletedStatusQuery, [asset.asset_id]);
        
        if (wfCompletedStatusResult.rows.length > 0) {
          const wfCompletedDate = wfCompletedStatusResult.rows[0].act_sch_date;
          dateToConsider = new Date(Math.max(new Date(dateToConsider), new Date(wfCompletedDate)));
        }
        
        // Step 3g: Check if maintenance is due or approaching (7-10 days advance)
        const currentDate = new Date();
        const daysSinceLastMaintenance = Math.floor((currentDate - dateToConsider) / (1000 * 60 * 60 * 24));
        
        // Convert frequency to days based on UOM
        let frequencyInDays = 0;
        switch (asset.uom?.toLowerCase()) {
          case 'days':
            frequencyInDays = asset.frequency || 0;
            break;
          case 'weeks':
            frequencyInDays = (asset.frequency || 0) * 7;
            break;
          case 'months':
            frequencyInDays = (asset.frequency || 0) * 30;
            break;
          case 'years':
            frequencyInDays = (asset.frequency || 0) * 365;
            break;
          default:
            frequencyInDays = asset.frequency || 0;
        }
        
        // Calculate advance warning period (configurable)
        const advanceWarningDays = MAINTENANCE_CONFIG.advanceWarningDays;
        const daysUntilDue = frequencyInDays - daysSinceLastMaintenance;
        
        // Check if maintenance is due OR approaching (within advance warning period)
        console.log(`🔍 Asset ${asset.asset_id}: Days since last maintenance: ${daysSinceLastMaintenance}, Frequency: ${frequencyInDays} days, Days until due: ${daysUntilDue}`);
        
        if (daysUntilDue > advanceWarningDays) {
          console.log(`⏭️ Asset ${asset.asset_id} maintenance not due yet. Days until due: ${daysUntilDue}, Required: ${frequencyInDays}, Advance warning: ${advanceWarningDays} days`);
          continue;
        }
        
        // Log the scheduling reason
        if (daysUntilDue <= 0) {
          console.log(`Asset ${asset.asset_id} maintenance is DUE NOW. Days overdue: ${Math.abs(daysUntilDue)}`);
        } else {
          console.log(`Asset ${asset.asset_id} maintenance scheduled in ADVANCE. Days until due: ${daysUntilDue}, Advance warning: ${advanceWarningDays} days`);
        }
        
        // Step 3h-i: Insert record into tblWFAssetMaintSch_H
        const wfamsHId = `WFAMSH_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        const insertWFAMSHQuery = `
          INSERT INTO "tblWFAssetMaintSch_H" (
            wfamsh_id, at_main_freq_id, maint_type_id, asset_id, group_id, 
            vendor_id, pl_sch_date, act_sch_date, status, created_by, 
            created_on, changed_by, changed_on, org_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `;
        
        await pool.query(insertWFAMSHQuery, [
          wfamsHId,
          asset.at_main_freq_id,
          null, // maint_type_id - will need to be determined based on business logic
          asset.asset_id,
          null, // group_id
          asset.service_vendor_id,
          dateToConsider,
          null, // act_sch_date
          'IN',
          'system',
          new Date(),
          null, // changed_by
          null, // changed_on
          asset.org_id
        ]);
        
        console.log(`Inserted WFAMSH record: ${wfamsHId}`);
        
        // Step 3j: Insert records into tblWFAssetMaintSch_D
        // Get workflow sequences for this asset type
        const wfSeqsQuery = `
          SELECT wf_at_seqs_id, wf_steps_id, seqs_no 
          FROM "tblWFATSeqs" 
          WHERE asset_type_id = $1
          ORDER BY seqs_no
        `;
        
        const wfSeqsResult = await pool.query(wfSeqsQuery, [assetType.asset_type_id]);
        
        for (const wfSeq of wfSeqsResult.rows) {
          // Get job roles for this workflow step
          const jobRolesQuery = `
            SELECT job_role_id, dept_id 
            FROM "tblWFJobRole" 
            WHERE wf_steps_id = $1
          `;
          
          const jobRolesResult = await pool.query(jobRolesQuery, [wfSeq.wf_steps_id]);
          
          for (const jobRole of jobRolesResult.rows) {
            // Find users with this job role and department
            const usersQuery = `
              SELECT user_id 
              FROM "tblUsers" 
              WHERE job_role_id = $1 
                AND dept_id = $2 
                AND org_id = $3
                AND status = 'Active'
              LIMIT 1
            `;
            
            const usersResult = await pool.query(usersQuery, [jobRole.job_role_id, jobRole.dept_id, asset.org_id]);
            const assignedUserId = usersResult.rows.length > 0 ? usersResult.rows[0].user_id : null;
            
            const wfamsDId = `WFAMSD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            const insertWFAMSDQuery = `
              INSERT INTO "tblWFAssetMaintSch_D" (
                wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
                sequence, status, notes, created_by, created_on, 
                changed_by, changed_on, org_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `;
            
            await pool.query(insertWFAMSDQuery, [
              wfamsDId,
              wfamsHId,
              jobRole.job_role_id,
              assignedUserId, // Assign user based on job role and department
              jobRole.dept_id,
              wfSeq.wf_at_seqs_id,
              'IN',
              null, // notes
              'system',
              new Date(),
              null, // changed_by
              null, // changed_on
              asset.org_id
            ]);
            
            console.log(`Inserted WFAMSD record: ${wfamsDId} for job role: ${jobRole.job_role_id}, assigned to user: ${assignedUserId}`);
          }
        }
        
        // Step 3k: Set the first person (smallest sequence) to AP status
        const findSmallestSequenceQuery = `
          SELECT wfamsd_id, sequence 
          FROM "tblWFAssetMaintSch_D" 
          WHERE wfamsh_id = $1 
          ORDER BY sequence ASC 
          LIMIT 1
        `;
        
        const smallestSequenceResult = await pool.query(findSmallestSequenceQuery, [wfamsHId]);
        
        if (smallestSequenceResult.rows.length > 0) {
          const firstPerson = smallestSequenceResult.rows[0];
          
          // Create a new record for the first person with AP status
          const apRecordId = `WFAMSD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          
          const insertAPRecordQuery = `
            INSERT INTO "tblWFAssetMaintSch_D" (
              wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
              sequence, status, notes, created_by, created_on, 
              changed_by, changed_on, org_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `;
          
          // Get the job role and dept from the first person's record
          const firstPersonDetailsQuery = `
            SELECT job_role_id, dept_id, user_id
            FROM "tblWFAssetMaintSch_D" 
            WHERE wfamsd_id = $1
          `;
          
          const firstPersonDetails = await pool.query(firstPersonDetailsQuery, [firstPerson.wfamsd_id]);
          
          if (firstPersonDetails.rows.length > 0) {
            const details = firstPersonDetails.rows[0];
            
            await pool.query(insertAPRecordQuery, [
              apRecordId,
              wfamsHId,
              details.job_role_id,
              details.user_id,
              details.dept_id,
              firstPerson.sequence,
              'AP', // Approval Pending status
              null, // notes
              'system',
              new Date(),
              null, // changed_by
              null, // changed_on
              asset.org_id
            ]);
            
            console.log(`Created AP record for first person: ${apRecordId} with sequence: ${firstPerson.sequence}`);
          }
        }
        
        console.log(`Completed processing asset: ${asset.asset_id}`);
      }
    }
    
    console.log(`[${new Date().toISOString()}] Maintenance schedule creation completed successfully`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in maintenance schedule creation:`, error);
  }
};

// Initialize cron job
const initializeMaintenanceScheduleCron = () => {
  console.log('Initializing maintenance schedule cron job...');
  
  // Schedule the job to run every hour
  cron.schedule('* * * * *', () => {
    console.log(`[${new Date().toISOString()}] Maintenance Schedule Cron Job triggered`);
    
    // Run the actual maintenance schedule logic
    createMaintenanceSchedule();
  });
  
  console.log('Maintenance schedule cron job initialized - running every hour');
};

// Function to get current execution count
const getExecutionCount = () => {
  console.log(`📊 Getting execution count: ${executionCount}`);
  return executionCount;
};

// Function to get maintenance configuration
const getMaintenanceConfig = () => {
  return MAINTENANCE_CONFIG;
};

module.exports = {
  initializeMaintenanceScheduleCron,
  createMaintenanceSchedule,
  dummyMaintenanceSchedule,
  executionCount,
  getExecutionCount,
  getMaintenanceConfig
}; 