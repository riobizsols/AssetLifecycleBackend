const pool = require('../config/db');
const { getChecklistByAssetId } = require('./checklistModel');
const { getVendorById } = require('./vendorsModel');

const getApprovalDetailByAssetId = async (assetId, orgId = 'ORG001') => {
  console.log('=== getApprovalDetailByAssetId called ===');
  console.log('Asset ID:', assetId);
  console.log('Org ID:', orgId);
  try {
    // First, let's check if there are any records for this asset at all
    const basicQuery = `
      SELECT COUNT(*) as total_records
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfh.asset_id = $1 AND wfd.org_id = $2
    `;
    
    const basicResult = await pool.query(basicQuery, [assetId, orgId]);
    console.log('Basic check - Total records for asset:', basicResult.rows[0].total_records);
    
    // Let's check what status values exist for this asset
    const statusQuery = `
      SELECT wfd.status as detail_status, wfh.status as header_status, wfd.user_id, wfd.changed_on
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfh.asset_id = $1 AND wfd.org_id = $2
    `;
    
    const statusResult = await pool.query(statusQuery, [assetId, orgId]);
    console.log('Status check - All records for asset:', statusResult.rows);
    
    const query = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.user_id,
        wfd.sequence,
        wfd.status as detail_status,
        wfd.notes,
        wfd.changed_by,
        wfd.changed_on,
        wfh.pl_sch_date,
        wfh.asset_id,
        wfh.status as header_status,
        wfh.created_on as maintenance_created_on,
        a.asset_type_id,
        a.prod_serve_id as vendor_id,
        v.vendor_name,
        at.maint_lead_type,
        at.text as asset_type_name,
        at.maint_type_id,
        mt.text as maint_type_name,
        u.full_name as user_name,
        u.email,
        -- Calculate cutoff date: pl_sch_date - maint_lead_type
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) as cutoff_date,
        -- Calculate days until due
        EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
        -- Calculate days until cutoff
        EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) - CURRENT_DATE)) as days_until_cutoff
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON at.maint_type_id = mt.maint_type_id
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblVendors" v ON a.prod_serve_id = v.vendor_id
      WHERE wfd.org_id = $1 
        AND wfh.asset_id = $2
        AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
        AND wfd.user_id IS NOT NULL
        AND wfd.wfamsd_id IN (
          SELECT MAX(wfd2.wfamsd_id)
          FROM "tblWFAssetMaintSch_D" wfd2
          WHERE wfd2.user_id = wfd.user_id 
            AND wfd2.wfamsh_id = wfd.wfamsh_id
            AND wfd2.org_id = wfd.org_id
        )
      ORDER BY wfd.sequence ASC
    `;

    const result = await pool.query(query, [orgId, assetId]);
    const approvalDetails = result.rows;

    console.log('Raw approval details from database:', approvalDetails);
    console.log('Query parameters:', { orgId, assetId });
    console.log('Number of records found:', approvalDetails.length);

    if (approvalDetails.length > 0) {
      // Get the first record for basic details
      const firstRecord = approvalDetails[0];
      
              // Fetch checklist items for this asset
        const checklistItems = await getChecklistByAssetId(assetId, orgId);
        
        // Fetch vendor details
        let vendorDetails = null;
        console.log('Vendor ID from firstRecord:', firstRecord.vendor_id);
        if (firstRecord.vendor_id) {
          vendorDetails = await getVendorById(firstRecord.vendor_id);
          console.log('Vendor details fetched:', vendorDetails);
        } else {
          console.log('No vendor_id found in firstRecord');
        }
        
        // Create workflow steps
      const workflowSteps = [];
      
      // Step 1: System (always first)
      workflowSteps.push({
        id: 'system',
        title: 'Approval Initiated',
        status: 'completed',
        description: 'Maintenance initiated by system',
        date: new Date(firstRecord.maintenance_created_on).toLocaleDateString(),
        time: new Date(firstRecord.maintenance_created_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        user: { id: 'system', name: 'System' }
      });
      
      // Step 2+: Users in sequence order
      approvalDetails.forEach((detail, index) => {
        const stepNumber = index + 2; // Start from step 2
        
        console.log(`Processing detail ${index + 1}:`, {
          user_id: detail.user_id,
          user_name: detail.user_name,
          detail_status: detail.detail_status,
          sequence: detail.sequence
        });
        
        // Determine status and description based on detail_status
        let status, description, title;
        
        switch (detail.detail_status) {
          case 'AP':
            status = 'completed'; // Green for current action user
            title = 'In Progress';
            description = `Action pending by ${detail.user_name}`;
            break;
          case 'UA':
            status = 'approved'; // Blue for approved
            title = 'Approved';
            description = `Approved by ${detail.user_name}`;
            break;
          case 'UR':
            status = 'rejected'; // Red for rejected
            title = 'Rejected';
            description = `Rejected by ${detail.user_name}`;
            break;
          case 'IN':
            status = 'pending'; // Gray for initial
            title = 'Awaiting';
            description = `Waiting for approval from ${detail.user_name}`;
            break;
          default:
            status = 'pending';
            title = 'Awaiting';
            description = `Waiting for approval from ${detail.user_name}`;
        }
        
        console.log(`Mapped status for ${detail.user_name}:`, {
          original_status: detail.detail_status,
          mapped_status: status,
          description: description
        });
        
        workflowSteps.push({
          id: `user-${detail.user_id}`,
          title: title,
          status: status,
          description: description,
          date: (status === 'approved' || status === 'rejected') && detail.changed_on ? new Date(detail.changed_on).toLocaleDateString() : '',
          time: (status === 'approved' || status === 'rejected') && detail.changed_on ? new Date(detail.changed_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          user: { id: detail.user_id, name: detail.user_name },
          notes: detail.notes || null,
          changed_by: detail.changed_by,
          changed_on: detail.changed_on
        });
      });
      
              // Add checklist and vendor details to the first record
        firstRecord.checklist = checklistItems;
        firstRecord.workflowSteps = workflowSteps;
        firstRecord.vendorDetails = vendorDetails;
        
        console.log('Final response with vendor details:', {
          hasVendorDetails: !!vendorDetails,
          vendorDetails: vendorDetails
        });
        
        console.log('Complete firstRecord object:', firstRecord);
        console.log('firstRecord keys:', Object.keys(firstRecord));
      
      return firstRecord;
    }

    return null;
  } catch (error) {
    console.error('Error in getApprovalDetailByAssetId:', error);
    throw error;
  }
};

const approveMaintenance = async (assetId, userId, note = null, orgId = 'ORG001') => {
  try {
    // Get current workflow details - get the latest record for each user
    const currentQuery = `
      SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfh.asset_id = $1 AND wfd.org_id = $2
        AND wfd.wfamsd_id = (
          SELECT MAX(wfd2.wfamsd_id) 
          FROM "tblWFAssetMaintSch_D" wfd2 
          WHERE wfd2.user_id = wfd.user_id 
            AND wfd2.wfamsh_id = wfd.wfamsh_id
        )
      ORDER BY wfd.sequence ASC
    `;
    
    const currentResult = await pool.query(currentQuery, [assetId, orgId]);
    const workflowDetails = currentResult.rows;
    
    if (workflowDetails.length === 0) {
      throw new Error('No workflow found for this asset');
    }
    
    // Find current user's step
    const currentUserStep = workflowDetails.find(w => w.user_id === userId);
    if (!currentUserStep) {
      throw new Error('User not found in workflow');
    }
    
    // Update current user's status to UA (User Approved)
    await pool.query(
      `UPDATE "tblWFAssetMaintSch_D" 
       SET status = $1, notes = $2, changed_by = $3, changed_on = ARRAY[NOW()::timestamp without time zone]
       WHERE wfamsd_id = $4`,
      ['UA', note, userId.substring(0, 20), currentUserStep.wfamsd_id]
    );
    
    console.log(`Updated current user ${userId} status to UA`);
    
    // Insert history record for current user approval
    const historyIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
    const historyIdResult = await pool.query(historyIdQuery);
    const nextHistoryId = (historyIdResult.rows[0].max_num || 0) + 1;
    const wfamhisId = `WFAMHIS_${nextHistoryId.toString().padStart(2, '0')}`;
    
          await pool.query(
        `INSERT INTO "tblWFAssetMaintHist" (
          wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
        [wfamhisId, currentUserStep.wfamsh_id, currentUserStep.wfamsd_id, userId, 'UA', note, orgId]
      );
    
    console.log(`Inserted history record: ${wfamhisId} for user ${userId} approval`);
    
    // Find next user and update their status to AP
    const nextUserStep = workflowDetails.find(w => w.sequence > currentUserStep.sequence);
    if (nextUserStep) {
      // Update next user's status to AP (Approval Pending)
      await pool.query(
        `UPDATE "tblWFAssetMaintSch_D" 
         SET status = $1, changed_by = $2, changed_on = ARRAY[NOW()::timestamp without time zone]
         WHERE wfamsd_id = $3`,
        ['AP', userId.substring(0, 20), nextUserStep.wfamsd_id]
      );
      
      console.log(`Updated next user ${nextUserStep.user_id} status to AP`);
      
      // Insert history record for next user status change
      const nextHistoryIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
      const nextHistoryIdResult = await pool.query(nextHistoryIdQuery);
      const nextNextHistoryId = (nextHistoryIdResult.rows[0].max_num || 0) + 1;
      const nextWfamhisId = `WFAMHIS_${nextNextHistoryId.toString().padStart(2, '0')}`;
      
      await pool.query(
        `INSERT INTO "tblWFAssetMaintHist" (
          wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
        [nextWfamhisId, nextUserStep.wfamsh_id, nextUserStep.wfamsd_id, userId, 'AP', null, orgId]
      );
      
      console.log(`Inserted history record: ${nextWfamhisId} for next user ${nextUserStep.user_id} status change`);
    } else {
      // No next user - check if all users have approved
      const allUsersApprovedQuery = `
        SELECT COUNT(*) as total_users,
               COUNT(CASE WHEN latest_status.status = 'UA' THEN 1 END) as approved_users
        FROM (
          SELECT DISTINCT wfd.user_id, 
                 FIRST_VALUE(wfd.status) OVER (PARTITION BY wfd.user_id ORDER BY wfd.created_on DESC) as status
          FROM "tblWFAssetMaintSch_D" wfd
          WHERE wfd.wfamsh_id = $1
        ) latest_status
      `;
      
      const approvalCheckResult = await pool.query(allUsersApprovedQuery, [currentUserStep.wfamsh_id]);
      const { total_users, approved_users } = approvalCheckResult.rows[0];
      
      console.log(`Approval check - Total users: ${total_users}, Approved users: ${approved_users}`);
      console.log(`Current user step wfamsh_id: ${currentUserStep.wfamsh_id}`);
      
      // Use helper function to check and update workflow status
      const workflowStatus = await checkAndUpdateWorkflowStatus(currentUserStep.wfamsh_id, orgId);
      console.log(`Workflow status after approval: ${workflowStatus}`);
    }
    
    return { success: true, message: 'Maintenance approved successfully' };
  } catch (error) {
    console.error('Error in approveMaintenance:', error);
    throw error;
  }
};

const rejectMaintenance = async (assetId, userId, reason, orgId = 'ORG001') => {
  try {
    // Get current workflow details - get the latest record for each user
    const currentQuery = `
      SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfh.asset_id = $1 AND wfd.org_id = $2
        AND wfd.wfamsd_id = (
          SELECT MAX(wfd2.wfamsd_id) 
          FROM "tblWFAssetMaintSch_D" wfd2 
          WHERE wfd2.user_id = wfd.user_id 
            AND wfd2.wfamsh_id = wfd.wfamsh_id
        )
      ORDER BY wfd.sequence ASC
    `;
    
    const currentResult = await pool.query(currentQuery, [assetId, orgId]);
    const workflowDetails = currentResult.rows;
    
    if (workflowDetails.length === 0) {
      throw new Error('No workflow found for this asset');
    }
    
    // Find current user's step
    const currentUserStep = workflowDetails.find(w => w.user_id === userId);
    if (!currentUserStep) {
      throw new Error('User not found in workflow');
    }
    
    // Update current user's status to UR (User Rejected)
    await pool.query(
      `UPDATE "tblWFAssetMaintSch_D" 
       SET status = $1, notes = $2, changed_by = $3, changed_on = ARRAY[NOW()::timestamp without time zone]
       WHERE wfamsd_id = $4`,
      ['UR', reason, userId.substring(0, 20), currentUserStep.wfamsd_id]
    );
    
    console.log(`Updated current user ${userId} status to UR`);
    
    // Insert history record for current user rejection
    const historyIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
    const historyIdResult = await pool.query(historyIdQuery);
    const nextHistoryId = (historyIdResult.rows[0].max_num || 0) + 1;
    const wfamhisId = `WFAMHIS_${nextHistoryId.toString().padStart(2, '0')}`;
    
          await pool.query(
        `INSERT INTO "tblWFAssetMaintHist" (
          wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
        [wfamhisId, currentUserStep.wfamsh_id, currentUserStep.wfamsd_id, userId, 'UR', reason, orgId]
      );
    
    console.log(`Inserted history record: ${wfamhisId} for user ${userId} rejection`);
    
    // Find the previous approved user and update their status back to AP
    const previousApprovedUserQuery = `
      SELECT wfd.wfamsd_id, wfd.user_id, wfd.sequence, wfd.job_role_id, wfd.dept_id, wfd.wfamsh_id
      FROM "tblWFAssetMaintSch_D" wfd
      WHERE wfd.wfamsh_id = $1 
        AND wfd.sequence < $2
        AND wfd.status = 'UA'
        AND wfd.wfamsd_id = (
          SELECT MAX(wfd2.wfamsd_id)
          FROM "tblWFAssetMaintSch_D" wfd2
          WHERE wfd2.user_id = wfd.user_id 
            AND wfd2.wfamsh_id = wfd.wfamsh_id
        )
      ORDER BY wfd.sequence DESC
      LIMIT 1
    `;
    
    const previousApprovedResult = await pool.query(previousApprovedUserQuery, [currentUserStep.wfamsh_id, currentUserStep.sequence]);
    const previousApprovedUser = previousApprovedResult.rows[0];

    if (previousApprovedUser) {
      // Update previous user's status back to AP (Approval Pending)
      await pool.query(
        `UPDATE "tblWFAssetMaintSch_D" 
         SET status = $1, changed_by = $2, changed_on = ARRAY[NOW()::timestamp without time zone]
         WHERE wfamsd_id = $3`,
        ['AP', userId.substring(0, 20), previousApprovedUser.wfamsd_id]
      );
      
      console.log(`Updated previous user ${previousApprovedUser.user_id} status back to AP`);
      
      // Insert history record for previous user status revert
      const prevHistoryIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
      const prevHistoryIdResult = await pool.query(prevHistoryIdQuery);
      const prevNextHistoryId = (prevHistoryIdResult.rows[0].max_num || 0) + 1;
      const prevWfamhisId = `WFAMHIS_${prevNextHistoryId.toString().padStart(2, '0')}`;
      
      await pool.query(
        `INSERT INTO "tblWFAssetMaintHist" (
          wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
        [prevWfamhisId, previousApprovedUser.wfamsh_id, previousApprovedUser.wfamsd_id, userId, 'AP', null, orgId]
      );
      
      console.log(`Inserted history record: ${prevWfamhisId} for previous user ${previousApprovedUser.user_id} status revert`);
    }
    
    // Check if all users have rejected
    const rejectionCheckQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN latest_status.status = 'UR' THEN 1 END) as rejected_users
      FROM (
        SELECT DISTINCT wfd.user_id, 
               FIRST_VALUE(wfd.status) OVER (PARTITION BY wfd.user_id ORDER BY wfd.created_on DESC) as status
        FROM "tblWFAssetMaintSch_D" wfd
        WHERE wfd.wfamsh_id = $1
      ) latest_status
    `;
    
    const rejectionCheckResult = await pool.query(rejectionCheckQuery, [currentUserStep.wfamsh_id]);
    const { total_users, rejected_users } = rejectionCheckResult.rows[0];
    
    console.log(`Rejection check - Total: ${total_users}, Rejected: ${rejected_users}`);
    
    // If all users have rejected, end the workflow as CA
    if (parseInt(rejected_users) === parseInt(total_users)) {
      console.log('All users have rejected - ending workflow as CA');
      await checkAndUpdateWorkflowStatus(currentUserStep.wfamsh_id, orgId);
    } else {
      // Find next user and update their status to AP
      const nextUserStep = workflowDetails.find(w => w.sequence > currentUserStep.sequence);
      console.log('Reject - Current user sequence:', currentUserStep.sequence);
      console.log('Reject - Next user step:', nextUserStep);
      
      if (nextUserStep) {
        console.log('Reject - Updating next user:', nextUserStep.user_id, 'to AP status');
        
        // Update next user's status to AP (Approval Pending)
        await pool.query(
          `UPDATE "tblWFAssetMaintSch_D" 
           SET status = $1, changed_by = $2, changed_on = ARRAY[NOW()::timestamp without time zone]
           WHERE wfamsd_id = $3`,
          ['AP', userId.substring(0, 20), nextUserStep.wfamsd_id]
        );
        
        console.log(`Updated next user ${nextUserStep.user_id} status to AP`);
        
        // Insert history record for next user status change
        const nextHistoryIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
        const nextHistoryIdResult = await pool.query(nextHistoryIdQuery);
        const nextNextHistoryId = (nextHistoryIdResult.rows[0].max_num || 0) + 1;
        const nextWfamhisId = `WFAMHIS_${nextNextHistoryId.toString().padStart(2, '0')}`;
        
        await pool.query(
          `INSERT INTO "tblWFAssetMaintHist" (
            wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
          [nextWfamhisId, nextUserStep.wfamsh_id, nextUserStep.wfamsd_id, userId, 'AP', null, orgId]
        );
        
        console.log(`Inserted history record: ${nextWfamhisId} for next user ${nextUserStep.user_id} status change`);
      } else {
        console.log('Reject - No next user found (current user is last in sequence)');
        
        // Check if this rejection creates a deadlock (no more path forward)
        const deadlockCheckQuery = `
          SELECT 
            COUNT(*) as total_users,
            COUNT(CASE WHEN latest_status.status = 'UR' THEN 1 END) as rejected_users,
            COUNT(CASE WHEN latest_status.status = 'UA' THEN 1 END) as approved_users,
            COUNT(CASE WHEN latest_status.status = 'AP' THEN 1 END) as pending_users
          FROM (
          SELECT DISTINCT wfd.user_id, 
                 FIRST_VALUE(wfd.status) OVER (PARTITION BY wfd.user_id ORDER BY wfd.created_on DESC) as status
          FROM "tblWFAssetMaintSch_D" wfd
          WHERE wfd.wfamsh_id = $1
        ) latest_status
      `;
      
      const deadlockResult = await pool.query(deadlockCheckQuery, [currentUserStep.wfamsh_id]);
      const { total_users, rejected_users, approved_users, pending_users } = deadlockResult.rows[0];
      
      console.log(`Deadlock check - Total: ${total_users}, Rejected: ${rejected_users}, Approved: ${approved_users}, Pending: ${pending_users}`);
      
      // Check if all users have rejected OR if there's no approved user to return to
      const allUsersRejected = parseInt(rejected_users) === parseInt(total_users);
      const noApprovedUserToReturnTo = parseInt(approved_users) === 0;
      const noPendingUsers = parseInt(pending_users) === 0;
      
      console.log(`Deadlock analysis - All users rejected: ${allUsersRejected}, No approved user to return to: ${noApprovedUserToReturnTo}, No pending users: ${noPendingUsers}`);
      
      // Mark as CA if all users have rejected or there's no path forward
      if (allUsersRejected || (noApprovedUserToReturnTo && noPendingUsers)) {
        console.log('No path forward - setting workflow to CA');
        await checkAndUpdateWorkflowStatus(currentUserStep.wfamsh_id, orgId);
      } else {
        console.log('Workflow can continue - there are approved users to return to');
      }
    }
  }
    
  return { success: true, message: 'Maintenance rejected successfully' };
  } catch (error) {
    console.error('Error in rejectMaintenance:', error);
    throw error;
  }
};

// Get workflow history for an asset
const getWorkflowHistory = async (assetId, orgId = 'ORG001') => {
  try {
    // Get history from tblWFAssetMaintHist table
    const historyQuery = `
      SELECT 
        wh.wfamhis_id,
        wh.wfamsh_id,
        wh.wfamsd_id,
        wh.action_by,
        wh.action_on,
        wh.action,
        wh.notes,
        u.full_name as user_name,
        wfd_user.full_name as affected_user_name,
        jr.text as job_role_name,
        d.text as dept_name,
        wfd.sequence,
        wfd.user_id as affected_user_id
      FROM "tblWFAssetMaintHist" wh
      INNER JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
      LEFT JOIN "tblUsers" wfd_user ON wfd.user_id = wfd_user.user_id
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
      WHERE wfh.asset_id = $1 AND wh.org_id = $2
      ORDER BY wh.action_on ASC
    `;
    
    console.log(`Querying history for asset ${assetId} and org ${orgId}`);
    
    const result = await pool.query(historyQuery, [assetId, orgId]);
    console.log(`Found ${result.rows.length} history records for asset ${assetId}`);
    console.log('History records:', result.rows);
    return result.rows;
  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    throw error;
  }
};

// Get maintenance approvals for users involved in maintenance
// Helper function to check and update workflow status
const checkAndUpdateWorkflowStatus = async (wfamshId, orgId = 'ORG001') => {
  try {
    // Get current status of all users in the workflow
    const statusQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN latest_status.status = 'UA' THEN 1 END) as approved_users,
        COUNT(CASE WHEN latest_status.status = 'UR' THEN 1 END) as rejected_users,
        COUNT(CASE WHEN latest_status.status = 'AP' THEN 1 END) as pending_users
      FROM (
        SELECT DISTINCT wfd.user_id, 
               FIRST_VALUE(wfd.status) OVER (PARTITION BY wfd.user_id ORDER BY wfd.created_on DESC) as status
        FROM "tblWFAssetMaintSch_D" wfd
        WHERE wfd.wfamsh_id = $1
      ) latest_status
    `;
    
    const statusResult = await pool.query(statusQuery, [wfamshId]);
    const { total_users, approved_users, rejected_users, pending_users } = statusResult.rows[0];
    
    console.log(`Workflow status check - Total: ${total_users}, Approved: ${approved_users}, Rejected: ${rejected_users}, Pending: ${pending_users}`);
    
         // Check for completion (all users approved)
     if (parseInt(approved_users) === parseInt(total_users)) {
       console.log(`All users approved! Total: ${total_users}, Approved: ${approved_users}`);
       
       await pool.query(
         `UPDATE "tblWFAssetMaintSch_H" 
          SET status = 'CO', 
              changed_by = 'system', 
              changed_on = NOW()::timestamp without time zone
          WHERE wfamsh_id = $1 AND org_id = $2`,
         [wfamshId, orgId]
       );
       console.log('Workflow completed - Status set to CO');
       
       // Create maintenance record in tblAssetMaintSch
       console.log('About to call createMaintenanceRecord...');
       try {
         const maintenanceRecordId = await createMaintenanceRecord(wfamshId, orgId);
         console.log('Maintenance record created successfully with ID:', maintenanceRecordId);
       } catch (error) {
         console.error('Error creating maintenance record:', error);
         throw error;
       }
       
       return 'CO';
     }
    
         // Check for cancellation (all users rejected OR no approved user to return to)
     if (parseInt(rejected_users) === parseInt(total_users)) {
       await pool.query(
         `UPDATE "tblWFAssetMaintSch_H" 
          SET status = 'CA', 
              changed_by = 'system', 
              changed_on = NOW()::timestamp without time zone
          WHERE wfamsh_id = $1 AND org_id = $2`,
         [wfamshId, orgId]
       );
       console.log('Workflow cancelled - All users rejected, Status set to CA');
       return 'CA';
     }
     
     // Check for cancellation when no approved users and no pending users
     if (parseInt(approved_users) === 0 && parseInt(pending_users) === 0) {
       await pool.query(
         `UPDATE "tblWFAssetMaintSch_H" 
          SET status = 'CA', 
              changed_by = 'system', 
              changed_on = NOW()::timestamp without time zone
          WHERE wfamsh_id = $1 AND org_id = $2`,
         [wfamshId, orgId]
       );
       console.log('Workflow cancelled - No approved users and no pending users, Status set to CA');
       return 'CA';
     }
     
     // Check if there are any pending users (AP status) - if yes, workflow continues
     if (parseInt(pending_users) > 0) {
       console.log('Workflow continues - There are pending users');
       return 'CONTINUE';
     }
    
    // Workflow continues
    return 'CONTINUE';
  } catch (error) {
    console.error('Error in checkAndUpdateWorkflowStatus:', error);
    throw error;
  }
};

 const getMaintenanceApprovals = async (userId, orgId = 'ORG001') => {
   try {
     const query = `
       SELECT DISTINCT
         wfh.wfamsh_id,
         wfh.asset_id,
         wfh.pl_sch_date,
         wfh.act_sch_date,
         wfh.status as header_status,
         wfh.created_on as maintenance_created_on,
         wfh.changed_on as maintenance_changed_on,
         a.asset_type_id,
         at.text as asset_type_name,
         a.serial_number,
         a.description as asset_description,
         v.vendor_name,
         d.text as department_name,
         u.full_name as employee_name,
         mt.text as maintenance_type_name,
         -- Calculate days until due
         EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
         -- Calculate days until cutoff
         EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) - CURRENT_DATE)) as days_until_cutoff
       FROM "tblWFAssetMaintSch_H" wfh
       INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
       INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
       INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
       LEFT JOIN "tblVendors" v ON a.prod_serve_id = v.vendor_id
       LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
       LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
       LEFT JOIN "tblMaintTypes" mt ON at.maint_type_id = mt.maint_type_id
       WHERE wfd.org_id = $1 
         AND wfd.user_id = $2
         AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
         AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
       ORDER BY wfh.pl_sch_date ASC, wfh.created_on DESC
     `;

     const result = await pool.query(query, [orgId, userId]);
     return result.rows;
   } catch (error) {
     console.error('Error in getMaintenanceApprovals:', error);
     throw error;
   }
 };

   // Create maintenance record in tblAssetMaintSch when workflow is completed
  const createMaintenanceRecord = async (wfamshId, orgId = 'ORG001') => {
    try {
      console.log('=== createMaintenanceRecord called ===');
      console.log('Creating maintenance record for wfamsh_id:', wfamshId);
      console.log('Org ID:', orgId);
      
      // Get the next auto-increment ID for ams_id
      // Get the latest ams_id and extract the numeric part
      const maxIdQuery = `
        SELECT MAX(
          CASE 
            WHEN ams_id ~ '^ams[0-9]+$' THEN CAST(SUBSTRING(ams_id FROM 4) AS INTEGER)
            WHEN ams_id ~ '^[0-9]+$' THEN CAST(ams_id AS INTEGER)
            ELSE 0
          END
        ) as max_num 
        FROM "tblAssetMaintSch"
      `;
      const maxIdResult = await pool.query(maxIdQuery);
      const nextId = (maxIdResult.rows[0].max_num || 0) + 1;
      const amsId = `ams${nextId.toString().padStart(3, '0')}`;
      
      console.log(`Latest ams_id number: ${maxIdResult.rows[0].max_num || 0}, Next ams_id: ${amsId}`);
     
           // Get maintenance details from workflow header
      const workflowQuery = `
        SELECT 
          wfh.wfamsh_id,
          wfh.asset_id,
          wfh.pl_sch_date as act_maint_st_date,
          a.asset_type_id,
          wfh.maint_type_id,
          a.prod_serve_id as vendor_id,
          wfh.at_main_freq_id
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE wfh.wfamsh_id = $1 AND wfh.org_id = $2
      `;
     
     console.log('Executing workflow query with params:', [wfamshId, orgId]);
     const workflowResult = await pool.query(workflowQuery, [wfamshId, orgId]);
     console.log('Workflow query result rows:', workflowResult.rows.length);
     
     if (workflowResult.rows.length === 0) {
       console.error('No workflow found for creating maintenance record');
       throw new Error('Workflow not found for creating maintenance record');
     }
     
     const workflowData = workflowResult.rows[0];
     console.log('Workflow data:', workflowData);
     
           // Insert maintenance record
      const insertQuery = `
        INSERT INTO "tblAssetMaintSch" (
          ams_id,
          wfamsh_id,
          asset_id,
          maint_type_id,
          vendor_id,
          at_main_freq_id,
          status,
          act_maint_st_date,
          created_by,
          created_on,
          org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)
      `;
      
      // Use a default maint_type_id if it's null
      const maintTypeId = workflowData.maint_type_id;
      
      const insertParams = [
        amsId,
        workflowData.wfamsh_id,
        workflowData.asset_id,
        maintTypeId,
        workflowData.vendor_id,
        workflowData.at_main_freq_id,
        'IN', // Initial status
        workflowData.act_maint_st_date,
        'system', // created_by
        orgId
      ];
     
     console.log('Insert query params:', insertParams);
     console.log('About to execute insert query...');
     
     await pool.query(insertQuery, insertParams);
     
     console.log('Maintenance record created successfully with ams_id:', amsId);
     return amsId;
   } catch (error) {
     console.error('Error in createMaintenanceRecord:', error);
     throw error;
   }
 };

 module.exports = {
   getApprovalDetailByAssetId,
   approveMaintenance,
   rejectMaintenance,
   getWorkflowHistory,
   getMaintenanceApprovals,
   createMaintenanceRecord
 }; 