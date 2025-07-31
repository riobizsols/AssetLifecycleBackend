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
    // Get the next sequential ID for current user's record
    const maxIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamsd_id FROM 8) AS INTEGER)) as max_num FROM "tblWFAssetMaintSch_D"`;
    const maxIdResult = await pool.query(maxIdQuery);
    const nextId = (maxIdResult.rows[0].max_num || 0) + 1;
    const newCurrentUserRecordId = `WFAMSD_${nextId.toString().padStart(2, '0')}`;
    
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
    
    // Create new record for current user's approval action
    await pool.query(
      `INSERT INTO "tblWFAssetMaintSch_D" (
        wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
        sequence, status, notes, created_by, created_on, 
        changed_by, changed_on, org_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, ARRAY[NOW()::timestamp without time zone], $11)`,
      [
        newCurrentUserRecordId,
        currentUserStep.wfamsh_id,
        currentUserStep.job_role_id,
        currentUserStep.user_id,
        currentUserStep.dept_id,
        currentUserStep.sequence,
        'UA', // Approved status
        note, // Store approval note
        'system',
        userId.substring(0, 20), // changed_by - truncate to 20 chars
        orgId
      ]
    );
    
    // Find next user and create new record with AP status
    const nextUserStep = workflowDetails.find(w => w.sequence > currentUserStep.sequence);
    if (nextUserStep) {
      // Get the next sequential ID for next user's record
      const nextUserMaxIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamsd_id FROM 8) AS INTEGER)) as max_num FROM "tblWFAssetMaintSch_D"`;
      const nextUserMaxIdResult = await pool.query(nextUserMaxIdQuery);
      const nextUserNextId = (nextUserMaxIdResult.rows[0].max_num || 0) + 1;
      const newNextUserRecordId = `WFAMSD_${nextUserNextId.toString().padStart(2, '0')}`;
      
      // Create new record for next user with AP status
      await pool.query(
        `INSERT INTO "tblWFAssetMaintSch_D" (
          wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
          sequence, status, notes, created_by, created_on, 
          changed_by, changed_on, org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, ARRAY[NOW()::timestamp without time zone], $11)`,
        [
          newNextUserRecordId,
          nextUserStep.wfamsh_id,
          nextUserStep.job_role_id,
          nextUserStep.user_id,
          nextUserStep.dept_id,
          nextUserStep.sequence,
          'AP', // Approval Pending status
          null, // notes
          'system',
          userId.substring(0, 20), // changed_by - truncate to 20 chars
          orgId
        ]
      );
    } else {
      // No next user means this was the last approval - update header to CO (Completed)
      await pool.query(
        `UPDATE "tblWFAssetMaintSch_H" 
         SET status = 'CO', 
             changed_by = $1, 
             changed_on = NOW()::timestamp without time zone
         WHERE wfamsh_id = $2 AND org_id = $3`,
        [
          userId.substring(0, 20), // changed_by - truncate to 20 chars
          currentUserStep.wfamsh_id,
          orgId
        ]
      );
    }
    
    return { success: true, message: 'Maintenance approved successfully' };
  } catch (error) {
    console.error('Error in approveMaintenance:', error);
    throw error;
  }
};

const rejectMaintenance = async (assetId, userId, reason, orgId = 'ORG001') => {
  try {
    // Get the next sequential ID for current user's record
    const maxIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamsd_id FROM 8) AS INTEGER)) as max_num FROM "tblWFAssetMaintSch_D"`;
    const maxIdResult = await pool.query(maxIdQuery);
    const nextId = (maxIdResult.rows[0].max_num || 0) + 1;
    const newCurrentUserRecordId = `WFAMSD_${nextId.toString().padStart(2, '0')}`;
    
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
    
    // Create new record for current user's rejection action
    await pool.query(
      `INSERT INTO "tblWFAssetMaintSch_D" (
        wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
        sequence, status, notes, created_by, created_on, 
        changed_by, changed_on, org_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, ARRAY[NOW()::timestamp without time zone], $11)`,
      [
        newCurrentUserRecordId,
        currentUserStep.wfamsh_id,
        currentUserStep.job_role_id,
        currentUserStep.user_id,
        currentUserStep.dept_id,
        currentUserStep.sequence,
        'UR', // Rejected status
        reason, // Store rejection reason in notes
        'system',
        userId.substring(0, 20), // changed_by - truncate to 20 chars
        orgId
      ]
    );
    
    // Find the previous approved user and create new record with AP status
    const previousApprovedUser = workflowDetails
      .filter(w => w.sequence < currentUserStep.sequence && w.status === 'UA')
      .sort((a, b) => b.sequence - a.sequence)[0]; // get the closest previous UA

    if (previousApprovedUser) {
      // Get the next sequential ID for previous user's record
      const prevUserMaxIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamsd_id FROM 8) AS INTEGER)) as max_num FROM "tblWFAssetMaintSch_D"`;
      const prevUserMaxIdResult = await pool.query(prevUserMaxIdQuery);
      const prevUserNextId = (prevUserMaxIdResult.rows[0].max_num || 0) + 1;
      const newPrevUserRecordId = `WFAMSD_${prevUserNextId.toString().padStart(2, '0')}`;
      
      // Create new record for previous user with AP status
      await pool.query(
        `INSERT INTO "tblWFAssetMaintSch_D" (
          wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
          sequence, status, notes, created_by, created_on, 
          changed_by, changed_on, org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, ARRAY[NOW()::timestamp without time zone], $11)`,
        [
          newPrevUserRecordId,
          previousApprovedUser.wfamsh_id,
          previousApprovedUser.job_role_id,
          previousApprovedUser.user_id,
          previousApprovedUser.dept_id,
          previousApprovedUser.sequence,
          'AP', // Approval Pending status
          null, // notes
          'system',
          userId.substring(0, 20), // changed_by - truncate to 20 chars
          orgId
        ]
      );
    }
    
    // Find next user and create new record with AP status
    const nextUserStep = workflowDetails.find(w => w.sequence > currentUserStep.sequence);
    console.log('Reject - Current user sequence:', currentUserStep.sequence);
    console.log('Reject - All workflow details:', workflowDetails.map(w => ({ user_id: w.user_id, sequence: w.sequence, status: w.status })));
    console.log('Reject - Next user step:', nextUserStep);
    if (nextUserStep) {
      console.log('Reject - Creating new record for next user:', nextUserStep.user_id, 'with AP status');
      // Get the next sequential ID for next user's record
      const nextUserMaxIdQuery = `SELECT MAX(CAST(SUBSTRING(wfamsd_id FROM 8) AS INTEGER)) as max_num FROM "tblWFAssetMaintSch_D"`;
      const nextUserMaxIdResult = await pool.query(nextUserMaxIdQuery);
      const nextUserNextId = (nextUserMaxIdResult.rows[0].max_num || 0) + 1;
      const newNextUserRecordId = `WFAMSD_${nextUserNextId.toString().padStart(2, '0')}`;
      
      // Create new record for next user with AP status
      await pool.query(
        `INSERT INTO "tblWFAssetMaintSch_D" (
          wfamsd_id, wfamsh_id, job_role_id, user_id, dept_id, 
          sequence, status, notes, created_by, created_on, 
          changed_by, changed_on, org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, ARRAY[NOW()::timestamp without time zone], $11)`,
        [
          newNextUserRecordId,
          nextUserStep.wfamsh_id,
          nextUserStep.job_role_id,
          nextUserStep.user_id,
          nextUserStep.dept_id,
          nextUserStep.sequence,
          'AP', // Approval Pending status
          null, // notes
          'system',
          userId.substring(0, 20), // changed_by - truncate to 20 chars
          orgId
        ]
      );
    } else {
      console.log('Reject - No next user found (current user is last in sequence)');
      // No next user means this was the last rejection - update header to CA (Cancelled)
      await pool.query(
        `UPDATE "tblWFAssetMaintSch_H" 
         SET status = 'CA', 
             changed_by = $1, 
             changed_on = NOW()::timestamp without time zone
         WHERE wfamsh_id = $2 AND org_id = $3`,
        [
          userId.substring(0, 20), // changed_by - truncate to 20 chars
          currentUserStep.wfamsh_id,
          orgId
        ]
      );
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
    const query = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfd.job_role_id,
        wfd.user_id,
        wfd.dept_id,
        wfd.sequence,
        wfd.status,
        wfd.notes,
        wfd.created_by,
        wfd.created_on,
        wfd.changed_by,
        wfd.changed_on,
        wfd.org_id,
        u.full_name as user_name,
        u.email as user_email,
        wfd.job_role_id as job_role_name,
        d.text as dept_name,
        wfd.dept_id as dept_id_raw
      FROM "tblWFAssetMaintSch_D" wfd
      LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
      LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
      WHERE wfd.org_id = $1 
        AND EXISTS (
          SELECT 1 FROM "tblWFAssetMaintSch_H" wfh 
          WHERE wfh.wfamsh_id = wfd.wfamsh_id 
            AND wfh.asset_id = $2
        )
      ORDER BY wfd.created_on ASC, wfd.sequence ASC
    `;

    const result = await pool.query(query, [orgId, assetId]);
    return result.rows;
  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    throw error;
  }
};

// Get maintenance approvals for users involved in maintenance
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

module.exports = {
  getApprovalDetailByAssetId,
  approveMaintenance,
  rejectMaintenance,
  getWorkflowHistory,
  getMaintenanceApprovals
}; 