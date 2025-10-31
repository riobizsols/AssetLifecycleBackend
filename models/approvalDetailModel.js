const pool = require('../config/db');
const { getChecklistByAssetId } = require('./checklistModel');
const { getVendorById } = require('./vendorsModel');

// Helper function to convert emp_int_id to user_id
const getUserIdByEmpIntId = async (empIntId) => {
  const result = await pool.query(
    'SELECT user_id FROM "tblUsers" WHERE emp_int_id = $1',
    [empIntId]
  );
  return result.rows.length > 0 ? result.rows[0].user_id : null;
};

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
    
    // ROLE-BASED WORKFLOW: Query now shows job role instead of specific user
    const query = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.job_role_id,
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
        a.service_vendor_id as vendor_id,
        v.vendor_name,
        v.company_name,
        v.company_email,
        v.contact_person_name,
        v.contact_person_email,
        v.contact_person_number,
        v.address_line1,
        v.address_line2,
        v.city,
        v.state,
        v.pincode,
        v.gst_number,
        v.cin_number,
        at.maint_lead_type,
        at.text as asset_type_name,
        COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
        mt.text as maint_type_name,
        jr.text as job_role_name,
        -- ROLE-BASED: Always show role name (user_id is not used)
        -- To see who actually approved, check tblWFAssetMaintHist.action_by
        jr.text as user_name,
        NULL as email,
        -- Calculate cutoff date: pl_sch_date - maint_lead_type
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) as cutoff_date,
        -- Calculate days until due
        EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
        -- Calculate days until cutoff
        EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) - CURRENT_DATE)) as days_until_cutoff
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
      WHERE wfd.org_id = $1 
        AND wfh.asset_id = $2
        AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
        AND wfd.job_role_id IS NOT NULL
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
        
        // ROLE-BASED: Always show role name (user_id is never used)
        // To see who approved, query tblWFAssetMaintHist
        switch (detail.detail_status) {
          case 'AP':
            status = 'completed'; // Green for current action step
            title = 'In Progress';
            description = `Action pending by any ${detail.job_role_name}`;
            break;
          case 'UA':
            status = 'approved'; // Blue for approved
            title = 'Approved';
            description = `Approved by ${detail.job_role_name}`;
            break;
          case 'UR':
            status = 'rejected'; // Red for rejected
            title = 'Rejected';
            description = `Rejected by ${detail.job_role_name}`;
            break;
          case 'IN':
            status = 'pending'; // Gray for initial
            title = 'Awaiting';
            description = `Waiting for approval from any ${detail.job_role_name}`;
            break;
          default:
            status = 'pending';
            title = 'Awaiting';
            description = `Waiting for approval from any ${detail.job_role_name}`;
        }
        
        console.log(`Mapped status for ${detail.user_name}:`, {
          original_status: detail.detail_status,
          mapped_status: status,
          description: description
        });
        
        workflowSteps.push({
          id: `role-${detail.job_role_id}-${index + 1}`,
          title: title,
          status: status,
          description: description,
          date: (status === 'approved' || status === 'rejected') && detail.changed_on ? new Date(detail.changed_on).toLocaleDateString() : '',
          time: (status === 'approved' || status === 'rejected') && detail.changed_on ? new Date(detail.changed_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          role: { id: detail.job_role_id, name: detail.job_role_name },
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

// Approve by wfamshId for precision; fallback to assetId for legacy calls
const approveMaintenance = async (assetOrWfamshId, empIntId, note = null, orgId = 'ORG001') => {
  try {
    // Convert emp_int_id to user_id
    const userId = await getUserIdByEmpIntId(empIntId);
    if (!userId) {
      throw new Error('User not found with the provided employee ID');
    }
    
    // ROLE-BASED WORKFLOW: Get user's roles
    const userRolesQuery = `
      SELECT job_role_id FROM "tblUserJobRoles" WHERE user_id = $1
    `;
    const userRolesResult = await pool.query(userRolesQuery, [userId]);
    const userRoleIds = userRolesResult.rows.map(r => r.job_role_id);
    
    if (userRoleIds.length === 0) {
      throw new Error('User has no assigned roles');
    }
    
    // Detect whether the identifier is a wfamsh_id or asset_id
    const isWfamshId = String(assetOrWfamshId || '').startsWith('WFAMSH_');

    let currentResult;
    if (isWfamshId) {
      // ROLE-BASED: Find workflow step where user has the required role
      const byHeaderQuery = `
        SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
        FROM "tblWFAssetMaintSch_D" wfd
        WHERE wfd.wfamsh_id = $1 AND wfd.org_id = $2
          AND wfd.job_role_id = ANY($3::varchar[])
        ORDER BY wfd.sequence ASC
      `;
      currentResult = await pool.query(byHeaderQuery, [assetOrWfamshId, orgId, userRoleIds]);
    } else {
      // ROLE-BASED: Find workflow step where user has the required role
      const currentQuery = `
        SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
        FROM "tblWFAssetMaintSch_D" wfd
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
        WHERE wfh.asset_id = $1 AND wfd.org_id = $2
          AND wfd.job_role_id = ANY($3::varchar[])
        ORDER BY wfd.sequence ASC
      `;
      currentResult = await pool.query(currentQuery, [assetOrWfamshId, orgId, userRoleIds]);
    }
    const workflowDetails = currentResult.rows;
    
    if (workflowDetails.length === 0) {
      throw new Error('No workflow found for this asset or user does not have required role');
    }
    
    // ROLE-BASED: Find the current step that needs approval (status AP)
    let currentUserStep = workflowDetails.find(w => w.status === 'AP');
    if (!currentUserStep) {
      throw new Error('No pending approval step found for your role');
    }
    
    // ROLE-BASED: Update workflow step status to UA (User Approved)
    // user_id remains NULL - only job_role_id is used
    await pool.query(
      `UPDATE "tblWFAssetMaintSch_D" 
       SET status = $1, notes = $2, changed_by = $3, changed_on = ARRAY[NOW()::timestamp without time zone]
       WHERE wfamsd_id = $4`,
      ['UA', note, userId.substring(0, 20), currentUserStep.wfamsd_id]
    );
    
    console.log(`Updated workflow step ${currentUserStep.wfamsd_id} status to UA, approved by user ${userId} (${empIntId}) - user_id remains NULL, tracked in history`);
    
    // Insert history record - ROLE-BASED: action_by stores the actual user who approved
    const historyIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
    const historyIdResult = await pool.query(historyIdQuery);
    const nextHistoryId = (historyIdResult.rows[0].max_num || 0) + 1;
    const wfamhisId = `WFAMHIS_${nextHistoryId.toString().padStart(2, '0')}`;
    
    await pool.query(
      `INSERT INTO "tblWFAssetMaintHist" (
        wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
      [wfamhisId, currentUserStep.wfamsh_id, currentUserStep.wfamsd_id, empIntId, 'UA', note, orgId]
    );
    
    console.log(`Inserted history record: ${wfamhisId} - User ${empIntId} approved workflow step`);
    
    // Find next user and update their status to AP
    // Get ALL workflow steps (not just current user's steps) to find the next approver
    const allWorkflowStepsQuery = `
      SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
      FROM "tblWFAssetMaintSch_D" wfd
      WHERE wfd.wfamsh_id = $1 AND wfd.org_id = $2
      ORDER BY wfd.sequence ASC
    `;
    const allStepsResult = await pool.query(allWorkflowStepsQuery, [currentUserStep.wfamsh_id, orgId]);
    const allWorkflowSteps = allStepsResult.rows;
    
    const nextUserStep = allWorkflowSteps.find(w => w.sequence > currentUserStep.sequence);
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
        [nextWfamhisId, nextUserStep.wfamsh_id, nextUserStep.wfamsd_id, empIntId, 'AP', null, orgId]
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

// Reject by wfamshId for precision; fallback to assetId for legacy calls
const rejectMaintenance = async (assetOrWfamshId, empIntId, reason, orgId = 'ORG001') => {
  try {
    // Convert emp_int_id to user_id
    const userId = await getUserIdByEmpIntId(empIntId);
    if (!userId) {
      throw new Error('User not found with the provided employee ID');
    }
    
    // ROLE-BASED WORKFLOW: Get user's roles
    const userRolesQuery = `
      SELECT job_role_id FROM "tblUserJobRoles" WHERE user_id = $1
    `;
    const userRolesResult = await pool.query(userRolesQuery, [userId]);
    const userRoleIds = userRolesResult.rows.map(r => r.job_role_id);
    
    if (userRoleIds.length === 0) {
      throw new Error('User has no assigned roles');
    }
    
    // Detect whether the identifier is a wfamsh_id or asset_id
    const isWfamshId = String(assetOrWfamshId || '').startsWith('WFAMSH_');

    let currentResult;
    if (isWfamshId) {
      // ROLE-BASED: Find workflow step where user has the required role
      const byHeaderQuery = `
        SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
        FROM "tblWFAssetMaintSch_D" wfd
        WHERE wfd.wfamsh_id = $1 AND wfd.org_id = $2
          AND wfd.job_role_id = ANY($3::varchar[])
        ORDER BY wfd.sequence ASC
      `;
      currentResult = await pool.query(byHeaderQuery, [assetOrWfamshId, orgId, userRoleIds]);
    } else {
      // ROLE-BASED: Find workflow step where user has the required role
      const currentQuery = `
        SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
        FROM "tblWFAssetMaintSch_D" wfd
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
        WHERE wfh.asset_id = $1 AND wfd.org_id = $2
          AND wfd.job_role_id = ANY($3::varchar[])
        ORDER BY wfd.sequence ASC
      `;
      currentResult = await pool.query(currentQuery, [assetOrWfamshId, orgId, userRoleIds]);
    }
    const workflowDetails = currentResult.rows;
    
    if (workflowDetails.length === 0) {
      throw new Error('No workflow found for this asset or user does not have required role');
    }
    
    // ROLE-BASED: Find the current step that needs approval (status AP)
    let currentUserStep = workflowDetails.find(w => w.status === 'AP');
    if (!currentUserStep) {
      throw new Error('No pending approval step found for your role');
    }
    
    // ROLE-BASED: Update workflow step status to UR (User Rejected)
    // user_id remains NULL - only job_role_id is used
    await pool.query(
      `UPDATE "tblWFAssetMaintSch_D" 
       SET status = $1, notes = $2, changed_by = $3, changed_on = ARRAY[NOW()::timestamp without time zone]
       WHERE wfamsd_id = $4`,
      ['UR', reason, userId.substring(0, 20), currentUserStep.wfamsd_id]
    );
    
    console.log(`Updated workflow step ${currentUserStep.wfamsd_id} status to UR, rejected by user ${userId} (${empIntId}) - user_id remains NULL, tracked in history`);
    
    // Insert history record - ROLE-BASED: action_by stores the actual user who rejected
    const historyIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamhis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAssetMaintHist"`;
    const historyIdResult = await pool.query(historyIdQuery);
    const nextHistoryId = (historyIdResult.rows[0].max_num || 0) + 1;
    const wfamhisId = `WFAMHIS_${nextHistoryId.toString().padStart(2, '0')}`;
    
    await pool.query(
      `INSERT INTO "tblWFAssetMaintHist" (
        wfamhis_id, wfamsh_id, wfamsd_id, action_by, action_on, action, notes, org_id
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7)`,
      [wfamhisId, currentUserStep.wfamsh_id, currentUserStep.wfamsd_id, empIntId, 'UR', reason, orgId]
    );
    
    console.log(`Inserted history record: ${wfamhisId} - User ${empIntId} rejected workflow step`);
    
    // Find the previous approved step and update their status back to AP
    // ROLE-BASED: Find the most recent approved step (UA status) with lower sequence
    const previousApprovedUserQuery = `
      SELECT wfd.wfamsd_id, wfd.user_id, wfd.sequence, wfd.job_role_id, wfd.dept_id, wfd.wfamsh_id
      FROM "tblWFAssetMaintSch_D" wfd
      WHERE wfd.wfamsh_id = $1 
        AND wfd.sequence < $2
        AND wfd.status = 'UA'
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
        [prevWfamhisId, previousApprovedUser.wfamsh_id, previousApprovedUser.wfamsd_id, empIntId, 'AP', null, orgId]
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
        CASE 
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN wh.action_by LIKE 'EMP_INT_%' THEN u_emp.full_name
          ELSE 'System'
        END as user_name,
        CASE 
          WHEN wfd_user.full_name IS NOT NULL THEN wfd_user.full_name
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN wfd_user_emp.full_name
          ELSE 'Unknown User'
        END as affected_user_name,
        jr.text as job_role_name,
        d.text as dept_name,
        wfd.sequence,
        wfd.user_id as affected_user_id
      FROM "tblWFAssetMaintHist" wh
      INNER JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
      LEFT JOIN "tblUsers" wfd_user ON wfd.user_id = wfd_user.user_id
      LEFT JOIN "tblUsers" wfd_user_emp ON wfd.user_id = wfd_user_emp.emp_int_id
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

// Get workflow history by wfamsh_id (specific workflow)
const getWorkflowHistoryByWfamshId = async (wfamshId, orgId = 'ORG001') => {
  try {
    // Get history from tblWFAssetMaintHist table for specific workflow
    const historyQuery = `
      SELECT 
        wh.wfamhis_id,
        wh.wfamsh_id,
        wh.wfamsd_id,
        wh.action_by,
        wh.action_on,
        wh.action,
        wh.notes,
        CASE 
          WHEN u.full_name IS NOT NULL THEN u.full_name
          WHEN wh.action_by LIKE 'EMP_INT_%' THEN u_emp.full_name
          ELSE 'System'
        END as user_name,
        CASE 
          WHEN wfd_user.full_name IS NOT NULL THEN wfd_user.full_name
          WHEN wfd.user_id LIKE 'EMP_INT_%' THEN wfd_user_emp.full_name
          ELSE 'Unknown User'
        END as affected_user_name,
        jr.text as job_role_name,
        d.text as dept_name,
        wfd.sequence,
        wfd.user_id as affected_user_id
      FROM "tblWFAssetMaintHist" wh
      INNER JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
      LEFT JOIN "tblUsers" u_emp ON wh.action_by = u_emp.emp_int_id
      LEFT JOIN "tblUsers" wfd_user ON wfd.user_id = wfd_user.user_id
      LEFT JOIN "tblUsers" wfd_user_emp ON wfd.user_id = wfd_user_emp.emp_int_id
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
      WHERE wfh.wfamsh_id = $1 AND wh.org_id = $2
      ORDER BY wh.action_on ASC
    `;
    
    console.log(`Querying history for workflow ${wfamshId} and org ${orgId}`);
    
    const result = await pool.query(historyQuery, [wfamshId, orgId]);
    console.log(`Found ${result.rows.length} history records for workflow ${wfamshId}`);
    console.log('History records:', result.rows);
    
    // Transform the data to match frontend expectations
    const transformedHistory = result.rows.map(record => {
      // Convert action codes to full text
      let actionText = record.action;
      let actionColor = 'text-gray-600'; // default color
      
      switch (record.action) {
        case 'UA':
          actionText = 'User Approved';
          actionColor = 'text-green-600';
          break;
        case 'UR':
          actionText = 'User Rejected';
          actionColor = 'text-red-600';
          break;
        case 'AP':
          actionText = 'Approval Pending';
          actionColor = 'text-orange-600';
          break;
        case 'IN':
          actionText = 'Initiated';
          actionColor = 'text-blue-600';
          break;
        case 'IP':
          actionText = 'In Progress';
          actionColor = 'text-yellow-600';
          break;
        case 'CO':
          actionText = 'Completed';
          actionColor = 'text-green-600';
          break;
        case 'CA':
          actionText = 'Cancelled';
          actionColor = 'text-red-600';
          break;
        default:
          actionText = record.action;
          actionColor = 'text-gray-600';
      }
      
      return {
        id: record.wfamhis_id,
        date: record.action_on ? new Date(record.action_on).toLocaleDateString() : '-',
        action: actionText,
        actionCode: record.action, // Keep original code for reference
        actionColor: actionColor,
        user: record.user_name || '-',
        jobRole: record.job_role_name || '-',
        department: record.dept_name || '-',
        notes: record.notes || '-',
        actionType: record.action,
        sequence: record.sequence
      };
    });
    
    console.log('Transformed history records:', transformedHistory);
    return transformedHistory;
  } catch (error) {
    console.error('Error in getWorkflowHistoryByWfamshId:', error);
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

const getMaintenanceApprovals = async (empIntId, orgId = 'ORG001', userBranchCode) => {
   try {
     console.log('=== getMaintenanceApprovals model (ROLE-BASED with branch_code) ===');
     console.log('empIntId:', empIntId);
     console.log('orgId:', orgId);
     console.log('userBranchCode:', userBranchCode);
     
     // Handle empty string or null empIntId
     if (!empIntId || empIntId === '') {
       console.log('empIntId is empty or null, returning empty array');
       return [];
     }
     
     // ROLE-BASED: Get user's roles first
     const userQuery = `SELECT user_id FROM "tblUsers" WHERE emp_int_id = $1 AND int_status = 1`;
     const userResult = await pool.query(userQuery, [empIntId]);
     
     if (userResult.rows.length === 0) {
       console.log('User not found with emp_int_id:', empIntId);
       return [];
     }
     
     const userId = userResult.rows[0].user_id;
     
     const rolesQuery = `SELECT job_role_id FROM "tblUserJobRoles" WHERE user_id = $1`;
     const rolesResult = await pool.query(rolesQuery, [userId]);
     const userRoleIds = rolesResult.rows.map(r => r.job_role_id);
     
     if (userRoleIds.length === 0) {
       console.log('User has no assigned roles');
       return [];
     }
     
     console.log('User roles:', userRoleIds);
     
     // ROLE-BASED: Query workflows where user's roles match workflow steps AND maintenance belongs to user's org/branch_code
     const query = `
       SELECT DISTINCT
         wfh.wfamsh_id,
         wfh.asset_id,
         wfh.pl_sch_date as scheduled_date,
         wfh.act_sch_date,
         wfh.status as header_status,
         wfh.created_on as maintenance_created_on,
         wfh.changed_on as maintenance_changed_on,
         wfh.branch_code,
         a.asset_type_id,
         at.text as asset_type_name,
         a.serial_number,
         a.description as asset_description,
         v.vendor_name,
         v.vendor_name as vendor,
         d.text as department_name,
         jr.text as job_role_name,
         mt.text as maintenance_type_name,
         mt.text as maintenance_type,
         -- Calculate days until due
         EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
         -- Calculate days until cutoff
         EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(NULLIF(at.maint_lead_type, '') AS INTEGER), 0)) - CURRENT_DATE)) as days_until_cutoff
       FROM "tblWFAssetMaintSch_H" wfh
       INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
       INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
       INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
       LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
       LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
       LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
       LEFT JOIN "tblMaintTypes" mt ON wfh.maint_type_id = mt.maint_type_id
       WHERE wfd.org_id = $1 
         AND a.org_id = $1
         AND wfh.branch_code = $2
         AND wfd.job_role_id = ANY($3::varchar[])
         AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
         AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
       ORDER BY wfh.pl_sch_date ASC, wfh.created_on DESC
     `;

     const result = await pool.query(query, [orgId, userBranchCode, userRoleIds]);
     console.log('Query executed successfully, found rows:', result.rows.length);
     console.log('Sample row (if any):', result.rows[0] || 'No rows found');
     return result.rows;
   } catch (error) {
     console.error('Error in getMaintenanceApprovals:', error);
     console.error('Error details:', {
       message: error.message,
       code: error.code,
       detail: error.detail,
       hint: error.hint,
       position: error.position,
       where: error.where
     });
     throw error;
   }
 };

   // Create maintenance record in tblAssetMaintSch when workflow is completed
  const createMaintenanceRecord = async (wfamshId, orgId = 'ORG001') => {
    try {
      console.log('=== createMaintenanceRecord called ===');
      console.log('Creating maintenance record for wfamsh_id:', wfamshId);
      console.log('Org ID:', orgId);
      
           // Get maintenance details from workflow header
      const workflowQuery = `
        SELECT 
          wfh.wfamsh_id,
          wfh.asset_id,
          wfh.pl_sch_date as act_maint_st_date,
          a.asset_type_id,
          wfh.maint_type_id,
          a.service_vendor_id as vendor_id,
          wfh.at_main_freq_id,
          a.branch_id,
          b.branch_code,
          -- detect breakdown from detail notes
          EXISTS (
            SELECT 1 
            FROM "tblWFAssetMaintSch_D" d 
            WHERE d.wfamsh_id = wfh.wfamsh_id 
              AND d.org_id = $2 
              AND d.notes ILIKE '%breakdown%'
          ) as has_breakdown_note,
          -- detect BF01/BF03 breakdown with existing schedule (renamed to bf01_notes for compatibility)
          (
            SELECT d.notes
            FROM "tblWFAssetMaintSch_D" d
            WHERE d.wfamsh_id = wfh.wfamsh_id
              AND d.org_id = $2
              AND (d.notes ILIKE '%BF01-Breakdown%' OR d.notes ILIKE '%BF03-Breakdown%')
            LIMIT 1
          ) as bf01_notes,
          -- Determine maintained_by based on service_vendor_id
          CASE 
            WHEN a.service_vendor_id IS NOT NULL AND a.service_vendor_id != '' THEN 'Vendor'
            ELSE 'Inhouse'
          END as maintained_by
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
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
     console.log('Maintained by will be set to:', workflowData.maintained_by);
     console.log('Service vendor ID:', workflowData.vendor_id);
     console.log('BF01 notes:', workflowData.bf01_notes);
     
     // Check if this is a BF01 or BF03 breakdown with existing schedule
     let existingAmsId = null;
     let breakdownId = null;
     let breakdownReasonCode = null;
     let isBF03Postpone = false;
     
     // Check for BF01 breakdown
     if (workflowData.bf01_notes && workflowData.bf01_notes.includes('BF01-Breakdown')) {
       // Extract breakdown ID from notes: BF01-Breakdown-{ABR_ID}
       const abrMatch = workflowData.bf01_notes.match(/BF01-Breakdown-([A-Z0-9]+)/);
       if (abrMatch && abrMatch[1]) {
         breakdownId = abrMatch[1];
         console.log('Found BF01 breakdown ID:', breakdownId);
         
         // Get breakdown reason code from tblAssetBRDet
         const breakdownQuery = `
           SELECT brd.abr_id, brd.atbrrc_id, brd.description, brc.text as breakdown_reason
           FROM "tblAssetBRDet" brd
           LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
           WHERE brd.abr_id = $1 AND brd.org_id = $2
         `;
         const breakdownResult = await pool.query(breakdownQuery, [breakdownId, orgId]);
         if (breakdownResult.rows.length > 0) {
           breakdownReasonCode = breakdownResult.rows[0].breakdown_reason || breakdownResult.rows[0].atbrrc_id;
           console.log('Found breakdown reason:', breakdownReasonCode);
         }
       }
       
       // Extract existing schedule ID if present
       if (workflowData.bf01_notes.includes('ExistingSchedule')) {
         const match = workflowData.bf01_notes.match(/ExistingSchedule-([^-\s]+)/);
         if (match && match[1]) {
           existingAmsId = match[1];
           console.log('Found BF01 with existing schedule:', existingAmsId);
         }
       }
     }
     
     // Check for BF03 breakdown (Postpone)
     if (workflowData.bf01_notes && workflowData.bf01_notes.includes('BF03-Breakdown')) {
       isBF03Postpone = true;
       console.log('Found BF03 postpone breakdown - will update wo_id only');
       
       // Extract breakdown ID for work order tracking
       const abrMatch = workflowData.bf01_notes.match(/BF03-Breakdown-([A-Z0-9]+)/);
       if (abrMatch && abrMatch[1]) {
         breakdownId = abrMatch[1];
         console.log('BF03 breakdown ID:', breakdownId);
         
         // Get breakdown reason code from tblAssetBRDet
         const breakdownQuery = `
           SELECT brd.abr_id, brd.atbrrc_id, brd.description, brc.text as breakdown_reason
           FROM "tblAssetBRDet" brd
           LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
           WHERE brd.abr_id = $1 AND brd.org_id = $2
         `;
         const breakdownResult = await pool.query(breakdownQuery, [breakdownId, orgId]);
         if (breakdownResult.rows.length > 0) {
           breakdownReasonCode = breakdownResult.rows[0].breakdown_reason || breakdownResult.rows[0].atbrrc_id;
           console.log('Found BF03 breakdown reason:', breakdownReasonCode);
         }
       }
       
       // Extract existing schedule ID if present
       if (workflowData.bf01_notes.includes('ExistingSchedule')) {
         const match = workflowData.bf01_notes.match(/ExistingSchedule-([^-\s]+)/);
         if (match && match[1]) {
           existingAmsId = match[1];
           console.log('Found BF03 with existing schedule:', existingAmsId);
         }
       }
     }
     
     // Generate work order ID
     let workOrderId = null;
     if (breakdownId) {
       // Format: WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON} for breakdown workflows
       workOrderId = `WO-${wfamshId}-${breakdownId}`;
       if (breakdownReasonCode) {
         // Add breakdown reason to work order ID for reference
         workOrderId = `${workOrderId}-${breakdownReasonCode.substring(0, 20).replace(/\s/g, '_')}`;
       }
       console.log('Generated work order ID for breakdown:', workOrderId);
     } else {
       // Format: WO-{WFAMSH_ID} for regular workflows
       workOrderId = `WO-${wfamshId}`;
       console.log('Generated work order ID for regular workflow:', workOrderId);
     }
     
     // Decide maintenance type
     // If any detail note contains 'breakdown', force MT004; otherwise use header value or default to MT002
     const isBreakdown = !!workflowData.has_breakdown_note;
     const maintTypeId = isBreakdown ? 'MT004' : (workflowData.maint_type_id || 'MT002');
     
     // If BF03 with existing schedule, update only wo_id
     if (isBF03Postpone && existingAmsId) {
       console.log('BF03 detected - Updating wo_id only for existing maintenance schedule:', existingAmsId);
       
       const updateQuery = `
         UPDATE "tblAssetMaintSch"
         SET wo_id = $1,
             branch_code = COALESCE($2, branch_code),
             changed_by = 'system',
             changed_on = CURRENT_TIMESTAMP
         WHERE ams_id = $3 AND org_id = $4
         RETURNING ams_id, wo_id
       `;
       
       const updateParams = [
         workOrderId,
         workflowData.branch_code,
         existingAmsId,
         orgId
       ];
       
       console.log('BF03 update query params:', updateParams);
       const updateResult = await pool.query(updateQuery, updateParams);
       
       if (updateResult.rows.length === 0) {
         console.error('Failed to update existing schedule for BF03.');
       } else {
         console.log('BF03: wo_id updated successfully:', existingAmsId, updateResult.rows[0].wo_id);
       }
       
       return existingAmsId;
     }
     
     // If BF01 with existing schedule, update it instead of creating new one
     if (existingAmsId && !isBF03Postpone) {
       console.log('BF01 detected - Updating existing maintenance schedule:', existingAmsId);
       
       const updateQuery = `
         UPDATE "tblAssetMaintSch"
         SET act_maint_st_date = CURRENT_DATE,
             wfamsh_id = $1,
             maint_type_id = $2,
             vendor_id = $3,
             at_main_freq_id = $4,
             maintained_by = $5,
             branch_code = COALESCE($6, branch_code),
             changed_by = 'system',
             changed_on = CURRENT_TIMESTAMP
         WHERE ams_id = $7 AND org_id = $8
         RETURNING ams_id, wo_id
       `;
       
       const updateParams = [
         workflowData.wfamsh_id,
         maintTypeId,
         workflowData.vendor_id,
         workflowData.at_main_freq_id,
         workflowData.maintained_by,
         workflowData.branch_code,
         existingAmsId,
         orgId
       ];
       
       console.log('Update query params:', updateParams);
       const updateResult = await pool.query(updateQuery, updateParams);
       
       if (updateResult.rows.length === 0) {
         console.error('Failed to update existing schedule. Creating new one instead.');
         // Fall through to create new record
       } else {
         console.log('Maintenance schedule updated successfully. wo_id remains unchanged:', existingAmsId, updateResult.rows[0].wo_id);
         return existingAmsId;
       }
     }
     
     // Create new maintenance record (default behavior or if update failed)
     console.log('Creating new maintenance record');
     
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
     
           // Insert maintenance record
      const insertQuery = `
        INSERT INTO "tblAssetMaintSch" (
          ams_id,
          wfamsh_id,
          wo_id,
          asset_id,
          maint_type_id,
          vendor_id,
          at_main_freq_id,
          maintained_by,
          notes,
          status,
          act_maint_st_date,
          created_by,
          created_on,
          org_id,
          branch_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13, $14)
      `;
      
      const insertParams = [
        amsId,
        workflowData.wfamsh_id,
        workOrderId, // Work order ID with breakdown information
        workflowData.asset_id,
        maintTypeId,
        workflowData.vendor_id,
        workflowData.at_main_freq_id,
        workflowData.maintained_by, // Set based on service_vendor_id
        null, // notes - will be set when maintenance is performed
        'IN', // Initial status
        workflowData.act_maint_st_date,
        'system', // created_by
        orgId,
        workflowData.branch_code
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

// Get all maintenance workflows for an asset (separated by wfamsh_id)
const getAllMaintenanceWorkflowsByAssetId = async (assetId, orgId = 'ORG001') => {
  console.log('=== getAllMaintenanceWorkflowsByAssetId called ===');
  console.log('Asset ID:', assetId);
  console.log('Org ID:', orgId);
  
  try {
    // First get all distinct workflow headers for this asset
    const headersQuery = `
      SELECT DISTINCT
        wfh.wfamsh_id,
        wfh.pl_sch_date,
        wfh.act_sch_date,
        wfh.status as header_status,
        wfh.created_on as maintenance_created_on,
        wfh.changed_on as maintenance_changed_on,
        a.asset_type_id,
        a.service_vendor_id as vendor_id,
        v.vendor_name,
        v.company_name,
        v.company_email,
        v.contact_person_name,
        v.contact_person_email,
        v.contact_person_number,
        v.address_line1,
        v.address_line2,
        v.city,
        v.state,
        v.pincode,
        v.gst_number,
        v.cin_number,
        at.maint_lead_type,
        at.text as asset_type_name,
        at.maint_type_id,
        mt.text as maint_type_name,
        -- Calculate cutoff date: pl_sch_date - maint_lead_type
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) as cutoff_date,
        -- Calculate days until due
        EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
        -- Calculate days until cutoff
        EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) - CURRENT_DATE)) as days_until_cutoff
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON at.maint_type_id = mt.maint_type_id
      LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
      WHERE wfh.asset_id = $1 
        AND wfh.org_id = $2
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
      ORDER BY wfh.created_on DESC
    `;

    const headersResult = await pool.query(headersQuery, [assetId, orgId]);
    const workflowHeaders = headersResult.rows;
    
    console.log('Found workflow headers:', workflowHeaders.length);
    
    if (workflowHeaders.length === 0) {
      return [];
    }

    const allWorkflows = [];

    // For each workflow header, get its details
    for (const header of workflowHeaders) {
      const detailsQuery = `
        SELECT 
          wfd.wfamsd_id,
          wfd.wfamsh_id,
          wfd.user_id,
          wfd.sequence,
          wfd.status as detail_status,
          wfd.notes,
          wfd.changed_by,
          wfd.changed_on,
          CASE 
            WHEN u.full_name IS NOT NULL THEN u.full_name
            WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.full_name
            ELSE 'Unknown User'
          END as user_name,
          CASE 
            WHEN u.email IS NOT NULL THEN u.email
            WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.email
            ELSE NULL
          END as email
        FROM "tblWFAssetMaintSch_D" wfd
        LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
        LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
        WHERE wfd.wfamsh_id = $1 
          AND wfd.org_id = $2
          AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
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

      const detailsResult = await pool.query(detailsQuery, [header.wfamsh_id, orgId]);
      const workflowDetails = detailsResult.rows;
      
      console.log(`Workflow ${header.wfamsh_id} has ${workflowDetails.length} details`);

      // Create workflow steps for this maintenance
      const workflowSteps = [];
      
      // Step 1: System (always first)
      workflowSteps.push({
        id: 'system',
        title: 'Approval Initiated',
        status: 'completed',
        description: 'Maintenance initiated by system',
        date: new Date(header.maintenance_created_on).toLocaleDateString(),
        time: new Date(header.maintenance_created_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        user: { id: 'system', name: 'System' }
      });
      
      // Step 2+: Users in sequence order
      workflowDetails.forEach((detail, index) => {
        const stepStatus = detail.detail_status === 'UA' ? 'completed' : 
                          detail.detail_status === 'UR' ? 'rejected' : 'pending';
        
        workflowSteps.push({
          id: `user_${index + 1}`,
          title: `Action pending by ${detail.user_name}`,
          status: stepStatus,
          description: `Action pending by ${detail.user_name}`,
          date: detail.changed_on ? new Date(detail.changed_on).toLocaleDateString() : '-',
          time: detail.changed_on ? new Date(detail.changed_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          user: { 
            id: detail.user_id, 
            name: detail.user_name,
            email: detail.email
          },
          sequence: detail.sequence,
          wfamsdId: detail.wfamsd_id,
          notes: detail.notes
        });
      });

      // Fetch checklist items for this asset
      const checklistItems = await getChecklistByAssetId(assetId, orgId);
      
      // Fetch vendor details
      let vendorDetails = null;
      if (header.vendor_id) {
        vendorDetails = await getVendorById(header.vendor_id);
      }

      // Create the workflow object
      const workflow = {
        // Basic info
        wfamshId: header.wfamsh_id,
        assetId: assetId,
        assetTypeId: header.asset_type_id,
        assetTypeName: header.asset_type_name,
        vendorId: header.vendor_id,
        vendorName: header.vendor_name,
        
        // Maintenance info
        maintenanceType: header.maint_type_name || 'Regular Maintenance',
        dueDate: header.pl_sch_date,
        cutoffDate: header.cutoff_date,
        actualDate: header.act_sch_date,
        
        // Status info
        headerStatus: header.header_status,
        
        // Calculated fields
        daysUntilDue: Math.floor(header.days_until_due || 0),
        daysUntilCutoff: Math.floor(header.days_until_cutoff || 0),
        isUrgent: header.days_until_cutoff <= 2,
        isOverdue: header.days_until_due <= 0,
        
        // Additional fields
        notes: null,
        checklist: checklistItems || [],
        vendorDetails: vendorDetails,
        workflowSteps: workflowSteps,
        workflowDetails: workflowDetails,
        createdOn: header.maintenance_created_on,
        changedOn: header.maintenance_changed_on
      };

      allWorkflows.push(workflow);
    }

    console.log(`Returning ${allWorkflows.length} separate workflows for asset ${assetId}`);
    return allWorkflows;

  } catch (error) {
    console.error('Error in getAllMaintenanceWorkflowsByAssetId:', error);
    throw error;
  }
};

// Get approval detail by wfamsh_id (specific workflow)
const getApprovalDetailByWfamshId = async (wfamshId, orgId = 'ORG001') => {
  console.log('=== getApprovalDetailByWfamshId called ===');
  console.log('WFAMSH ID:', wfamshId);
  console.log('Org ID:', orgId);
  
  // Validate wfamshId is a valid string
  if (!wfamshId || typeof wfamshId !== 'string' || wfamshId.trim().length === 0) {
    throw new Error('Invalid wfamshId: must be a valid string');
  }
  
  try {
    // First, let's check if there are any records for this wfamsh_id at all
    const basicQuery = `
      SELECT COUNT(*) as total_records
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfd.wfamsh_id = $1 AND wfd.org_id = $2
    `;
    
    const basicResult = await pool.query(basicQuery, [wfamshId, orgId]);
    console.log('Basic check - Total records for wfamsh_id:', basicResult.rows[0].total_records);
    
    // Let's check what status values exist for this wfamsh_id
    const statusQuery = `
      SELECT wfd.status as detail_status, wfh.status as header_status, wfd.user_id, wfd.changed_on
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfd.wfamsh_id = $1 AND wfd.org_id = $2
    `;
    
    const statusResult = await pool.query(statusQuery, [wfamshId, orgId]);
    console.log('Status check - All records for wfamsh_id:', statusResult.rows);
    
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
        wfd.job_role_id,
        wfh.pl_sch_date,
        wfh.asset_id,
        wfh.status as header_status,
        wfh.created_on as maintenance_created_on,
        a.asset_type_id,
        a.service_vendor_id as vendor_id,
        v.vendor_name,
        v.company_name,
        v.company_email,
        v.contact_person_name,
        v.contact_person_email,
        v.contact_person_number,
        v.address_line1,
        v.address_line2,
        v.city,
        v.state,
        v.pincode,
        v.gst_number,
        v.cin_number,
        at.maint_lead_type,
        at.text as asset_type_name,
        COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
        mt.text as maint_type_name,
        jr.text as job_role_name,
        -- ROLE-BASED: Always show role name (user_id is not used)
        jr.text as user_name,
        NULL as email,
        -- Calculate cutoff date: pl_sch_date - maint_lead_type
        (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) as cutoff_date,
        -- Calculate days until due
        EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
        -- Calculate days until cutoff
        EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN 0
            WHEN at.maint_lead_type ~ '^[0-9]+$' THEN CAST(at.maint_lead_type AS INTEGER)
            ELSE 0
          END, 0
        )) - CURRENT_DATE)) as days_until_cutoff
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      LEFT JOIN "tblVendors" v ON a.service_vendor_id = v.vendor_id
      WHERE wfd.org_id = $1 
        AND wfd.wfamsh_id = $2
        AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
        AND wfd.job_role_id IS NOT NULL
      ORDER BY wfd.sequence ASC
    `;

    const result = await pool.query(query, [orgId, wfamshId]);
    const approvalDetails = result.rows;

    console.log('Raw approval details from database:', approvalDetails);
    console.log('Query parameters:', { orgId, wfamshId });
    console.log('Number of records found:', approvalDetails.length);

    if (approvalDetails.length > 0) {
      // Get the first record for basic details
      const firstRecord = approvalDetails[0];
      
      // Fetch checklist items for this asset
      const checklistItems = await getChecklistByAssetId(firstRecord.asset_id, orgId);

      // Build workflow steps for this specific wfamsh_id
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
        
        let stepStatus = 'pending';
        let stepTitle = 'Awaiting';
        let stepDescription = `Awaiting approval from any ${detail.job_role_name}`;
        
        // ROLE-BASED: Determine step status based on workflow progression
        if (detail.detail_status === 'UA') {
          stepStatus = 'approved';
          stepTitle = 'Approved';
          stepDescription = `Approved by ${detail.job_role_name}`;
        } else if (detail.detail_status === 'UR') {
          stepStatus = 'rejected';
          stepTitle = 'Rejected';
          stepDescription = `Rejected by ${detail.job_role_name}`;
        } else if (detail.detail_status === 'AP') {
          stepStatus = 'current';
          stepTitle = 'In Progress';
          stepDescription = `Action pending by any ${detail.job_role_name}`;
        } else if (detail.detail_status === 'IN') {
          stepStatus = 'pending';
          stepTitle = 'Awaiting';
          stepDescription = `Waiting for approval from any ${detail.job_role_name}`;
        }
        
        workflowSteps.push({
          id: `role-${detail.job_role_id}-${index + 1}`,
          title: stepTitle || `Step ${stepNumber}`,
          status: stepStatus,
          description: stepDescription,
          date: detail.changed_on ? new Date(detail.changed_on).toLocaleDateString() : '',
          time: detail.changed_on ? new Date(detail.changed_on).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          // ROLE-BASED: user.id contains job_role_id (not emp_int_id)
          // Frontend will check if current user has this role
          user: { 
            id: detail.job_role_id, 
            name: detail.job_role_name,
            email: null // Roles don't have emails
          },
          role: { id: detail.job_role_id, name: detail.job_role_name }, // Keep for backward compatibility
          notes: detail.notes || null,
          changed_by: detail.changed_by,
          changed_on: detail.changed_on,
          sequence: detail.sequence
        });
      });

      // Format the response
      const formattedDetail = {
        wfamsdId: firstRecord.wfamsd_id,
        wfamshId: firstRecord.wfamsh_id,
        assetId: firstRecord.asset_id,
        assetTypeId: firstRecord.asset_type_id,
        assetTypeName: firstRecord.asset_type_name,
        vendorId: firstRecord.vendor_id,
        vendorName: firstRecord.vendor_name,
        maintenanceType: firstRecord.maint_type_name,
        dueDate: firstRecord.pl_sch_date,
        cutoffDate: firstRecord.cutoff_date,
        actionBy: firstRecord.user_name,
        userId: firstRecord.user_id,
        userEmail: firstRecord.email,
        status: firstRecord.detail_status,
        sequence: firstRecord.sequence,
        daysUntilDue: Math.floor(firstRecord.days_until_due),
        daysUntilCutoff: Math.floor(firstRecord.days_until_cutoff),
        isUrgent: firstRecord.days_until_due <= 2,
        isOverdue: firstRecord.days_until_due < 0,
        notes: firstRecord.notes,
        checklist: checklistItems,
        vendorDetails: {
          vendorName: firstRecord.vendor_name,
          vendorId: firstRecord.vendor_id,
          vendor_name: firstRecord.vendor_name,
          company_name: firstRecord.company_name,
          company_email: firstRecord.company_email,
          contact_person_name: firstRecord.contact_person_name,
          contact_person_email: firstRecord.contact_person_email,
          contact_person_number: firstRecord.contact_person_number,
          address_line1: firstRecord.address_line1,
          address_line2: firstRecord.address_line2,
          city: firstRecord.city,
          state: firstRecord.state,
          pincode: firstRecord.pincode,
          gst_number: firstRecord.gst_number,
          cin_number: firstRecord.cin_number
        },
        workflowSteps: workflowSteps,
        workflowDetails: approvalDetails
      };

      return formattedDetail;
    } else {
      console.log('No approval details found for wfamsh_id:', wfamshId);
      return null;
    }
  } catch (error) {
    console.error('Error in getApprovalDetailByWfamshId:', error);
    throw error;
  }
};

 module.exports = {
   getApprovalDetailByAssetId,
   getApprovalDetailByWfamshId,
   approveMaintenance,
   rejectMaintenance,
   getWorkflowHistory,
   getWorkflowHistoryByWfamshId,
   getMaintenanceApprovals,
   createMaintenanceRecord,
   getAllMaintenanceWorkflowsByAssetId
 }; 