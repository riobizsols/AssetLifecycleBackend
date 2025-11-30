const { getDb } = require('../utils/dbContext');

const getMaintenanceNotifications = async (orgId = 'ORG001', branchId) => {
  // ROLE-BASED WORKFLOW: Fetch all users with the required job role
  const query = `
    SELECT 
      wfd.wfamsd_id,
      wfd.wfamsh_id,
      wfd.job_role_id,
      wfd.sequence,
      wfd.status as detail_status,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.group_id,
      wfh.status as header_status,
      a.asset_type_id,
      at.maint_lead_type,
      at.text as asset_type_name,
      ag.text as group_name,
      (SELECT COUNT(*) FROM "tblAssetGroup_D" WHERE assetgroup_h_id = wfh.group_id) as group_asset_count,
      COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
      mt.text as maint_type_name,
      jr.text as job_role_name,
      u.user_id,
      u.emp_int_id,
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
    LEFT JOIN "tblAssetGroup_H" ag ON wfh.group_id = ag.assetgroup_h_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
    LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
    -- Join with all users who have this job role
    LEFT JOIN "tblUserJobRoles" ujr ON wfd.job_role_id = ujr.job_role_id
    LEFT JOIN "tblUsers" u ON ujr.user_id = u.user_id
    WHERE wfd.org_id = $1 
      AND a.org_id = $1
      AND a.branch_id = $2
      -- Only show pending statuses (IN, IP, AP) - exclude approved (UA) and rejected (UR)
      AND wfd.status IN ('IN', 'IP', 'AP')
      -- Exclude completed (CO) and cancelled (CA) workflows
      AND wfh.status IN ('IN', 'IP')
      -- Only include if there are still pending approvals for this workflow
      AND EXISTS (
        SELECT 1 
        FROM "tblWFAssetMaintSch_D" wfd2
        WHERE wfd2.wfamsh_id = wfh.wfamsh_id
          AND wfd2.org_id = $1
          AND wfd2.status IN ('IN', 'IP', 'AP')
      )
      AND wfd.job_role_id IS NOT NULL
      AND u.int_status = 1
    ORDER BY wfh.pl_sch_date ASC, wfd.sequence ASC, u.full_name ASC
  `;
  try {
    const result = await getDb().query(query, [orgId, branchId]);
    return result.rows;
  } catch (error) {
    console.error('Error in getMaintenanceNotifications:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId, branchId]);
    throw error;
  }
};

const getMaintenanceNotificationsByUser = async (empIntId, orgId = 'ORG001', branchId) => {
  // ROLE-BASED WORKFLOW: Check if user has any of the required job roles for pending workflows
  const query = `
    SELECT DISTINCT
      wfh.wfamsh_id,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.group_id,
      wfh.status as header_status,
      a.asset_type_id,
      ag.text as group_name,
      (SELECT COUNT(*) FROM "tblAssetGroup_D" WHERE assetgroup_h_id = wfh.group_id) as group_asset_count,
      CASE 
        WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
        ELSE at.maint_lead_type::text
      END as maint_lead_type,
      COALESCE(at.text, 'Unknown Asset Type') as asset_type_name,
      COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
      COALESCE(mt.text, 'Regular Maintenance') as maint_type_name,
      -- Get the current action role and users
      COALESCE(current_action_role.job_role_name, 'Unknown Role') as current_action_role_name,
      current_action_role.job_role_id as current_action_role_id,
      -- Calculate cutoff date: pl_sch_date - maint_lead_type
      (wfh.pl_sch_date - INTERVAL '1 day' * CAST(
        CASE 
          WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
          ELSE at.maint_lead_type::text
        END AS INTEGER
      )) as cutoff_date,
      -- Calculate days until due
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
      -- Calculate days until cutoff
      EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * CAST(
        CASE 
          WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
          ELSE at.maint_lead_type::text
        END AS INTEGER
      )) - CURRENT_DATE)) as days_until_cutoff
    FROM "tblWFAssetMaintSch_H" wfh
    INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblAssetGroup_H" ag ON wfh.group_id = ag.assetgroup_h_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
    -- Get current action role (workflow step with AP status)
    LEFT JOIN (
      SELECT 
        wfd2.wfamsh_id,
        wfd2.job_role_id,
        jr2.text as job_role_name
      FROM "tblWFAssetMaintSch_D" wfd2
      LEFT JOIN "tblJobRoles" jr2 ON wfd2.job_role_id = jr2.job_role_id
      WHERE wfd2.status IN ('AP', 'IN')
        AND wfd2.wfamsd_id = (
          SELECT MAX(wfd3.wfamsd_id)
          FROM "tblWFAssetMaintSch_D" wfd3
          WHERE wfd3.wfamsh_id = wfd2.wfamsh_id
            AND wfd3.status IN ('AP', 'IN')
        )
    ) current_action_role ON wfh.wfamsh_id = current_action_role.wfamsh_id
    -- Check if the requesting employee has a role involved in this workflow
    WHERE wfh.org_id = $1 
      AND a.org_id = $1
      AND a.branch_id = $2
      -- Exclude completed (CO) and cancelled (CA) workflows
      AND wfh.status IN ('IN', 'IP')
      -- Only show if there are pending approvals (status IN, IP, or AP)
      AND EXISTS (
        SELECT 1 
        FROM "tblWFAssetMaintSch_D" wfd
        WHERE wfd.wfamsh_id = wfh.wfamsh_id
          AND wfd.org_id = $1
          AND wfd.status IN ('IN', 'IP', 'AP')
      )
      -- Check if the requesting employee has a role involved in this workflow with pending status
      AND EXISTS (
        SELECT 1 
        FROM "tblWFAssetMaintSch_D" wfd
        INNER JOIN "tblUserJobRoles" ujr ON wfd.job_role_id = ujr.job_role_id
        INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
        WHERE wfd.wfamsh_id = wfh.wfamsh_id
          AND u.emp_int_id = $3
          AND u.int_status = 1
          AND wfd.status IN ('IN', 'IP', 'AP')
      )
    ORDER BY wfh.pl_sch_date ASC
  `;
  try {
    const result = await getDb().query(query, [orgId, branchId, empIntId]);
    return result.rows;
  } catch (error) {
    console.error('Error in getMaintenanceNotificationsByUser:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId, branchId, empIntId]);
    throw error;
  }
};

const getNotificationStats = async (orgId = 'ORG001', branchId) => {
  const query = `
    SELECT 
      COUNT(*) as total_notifications,
      COUNT(CASE WHEN (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) <= CURRENT_DATE THEN 1 END) as overdue_notifications,
      COUNT(CASE WHEN wfh.pl_sch_date <= CURRENT_DATE THEN 1 END) as due_notifications,
      COUNT(CASE WHEN wfh.pl_sch_date > CURRENT_DATE AND (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) > CURRENT_DATE THEN 1 END) as upcoming_notifications
    FROM "tblWFAssetMaintSch_D" wfd
    INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
    INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE wfd.org_id = $1 
      AND a.org_id = $1
      AND a.branch_id = $2
      AND wfd.status IN ('IN', 'IP')
      AND wfh.status IN ('IN', 'IP')
      AND wfd.user_id IS NOT NULL
  `;
  try {
    const result = await getDb().query(query, [orgId, branchId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error in getNotificationStats:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId, branchId]);
    throw error;
  }
};

module.exports = {
  getMaintenanceNotifications,
  getMaintenanceNotificationsByUser,
  getNotificationStats
}; 