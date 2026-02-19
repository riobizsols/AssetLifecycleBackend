const { getDb } = require('../utils/dbContext');

// Supports super access users who can view all branches
const getMaintenanceNotifications = async (orgId = 'ORG001', branchId, hasSuperAccess = false) => {
  // ROLE-BASED WORKFLOW: Fetch all users with the required job role
  // Includes both asset-based maintenance and vendor contract renewal (MT005)
  let query = `
    SELECT 
      wfd.wfamsd_id,
      wfd.wfamsh_id,
      wfd.job_role_id,
      wfd.sequence,
      wfd.status as detail_status,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.group_id,
      wfh.vendor_id,
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
      -- Calculate cutoff date: pl_sch_date - maint_lead_type (or 10 days for MT005)
      CASE 
        WHEN wfh.maint_type_id = 'MT005' THEN wfh.pl_sch_date - INTERVAL '10 days'
        ELSE (wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0))
      END as cutoff_date,
      -- Calculate days until due
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
      -- Calculate days until cutoff
      CASE 
        WHEN wfh.maint_type_id = 'MT005' THEN EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '10 days') - CURRENT_DATE))
        ELSE EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * COALESCE(CAST(at.maint_lead_type AS INTEGER), 0)) - CURRENT_DATE))
      END as days_until_cutoff
    FROM "tblWFAssetMaintSch_D" wfd
    INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
    LEFT JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblAssetGroup_H" ag ON wfh.group_id = ag.assetgroup_h_id
    LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
    LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
    -- Join with all users who have this job role
    LEFT JOIN "tblUserJobRoles" ujr ON wfd.job_role_id = ujr.job_role_id
    LEFT JOIN "tblUsers" u ON ujr.user_id = u.user_id
    WHERE wfd.org_id = $1 
      AND (
        -- For asset-based maintenance: check branch_id only if user doesn't have super access
        (wfh.asset_id IS NOT NULL AND a.org_id = $1${!hasSuperAccess && branchId ? ' AND a.branch_id = $2' : ''})
        OR
        -- For vendor contract renewal (MT005): check vendor branch_code
        (wfh.maint_type_id = 'MT005' AND wfh.vendor_id IS NOT NULL)
      )
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
  `;

  // Inspection Notifications Query
  const inspectionQuery = `
    SELECT 
      wfd.wfaiisd_id as wfamsd_id,
      wfd.wfaiish_id as wfamsh_id,
      wfd.job_role_id,
      wfd.sequence,
      wfd.status as detail_status,
      wfh.pl_sch_date,
      wfh.asset_id,
      NULL::varchar as group_id,
      NULL::varchar as vendor_id,
      wfh.status as header_status,
      a.asset_type_id,
      '0' as maint_lead_type, -- Default lead time 0
      at.text as asset_type_name,
      NULL::varchar as group_name,
      0 as group_asset_count,
      'INSPECTION' as maint_type_id,
      'Inspection' as maint_type_name,
      jr.text as job_role_name,
      u.user_id,
      u.emp_int_id,
      u.full_name as user_name,
      u.email,
      -- Cutoff date is schedule date
      wfh.pl_sch_date as cutoff_date,
      -- Days until due
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
      -- Days until cutoff
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_cutoff
    FROM "tblWFAATInspSch_D" wfd
    INNER JOIN "tblWFAATInspSch_H" wfh ON wfd.wfaiish_id = wfh.wfaiish_id
    INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
    LEFT JOIN "tblUserJobRoles" ujr ON wfd.job_role_id = ujr.job_role_id
    LEFT JOIN "tblUsers" u ON ujr.user_id = u.user_id
    
    WHERE wfd.org_id = $1
      AND wfh.org_id = $1
      AND a.org_id = $1
      ${!hasSuperAccess && branchId ? 'AND a.branch_id = $2' : ''}
      AND wfd.status IN ('IN', 'IP', 'AP')
      AND wfh.status IN ('IN', 'IP')
      AND wfd.job_role_id IS NOT NULL
      AND u.int_status = 1
  `;

  try {
    const params = [orgId];
    if (!hasSuperAccess && branchId) {
      params.push(branchId);
    }
    
    // Execute Maintenance Query
    const results = await getDb().query(query, params);
    let allNotifications = results.rows || [];

    // Execute Inspection Query
    try {
        const inspResults = await getDb().query(inspectionQuery, params);
        if (inspResults.rows && inspResults.rows.length > 0) {
            allNotifications = [...allNotifications, ...inspResults.rows];
        }
    } catch (inspError) {
        console.warn('Error fetching inspection notifications (might be missing tables):', inspError.message);
    }
    
    // Sort combined results
    allNotifications.sort((a, b) => {
        const dA = a.pl_sch_date ? new Date(a.pl_sch_date) : new Date(0);
        const dB = b.pl_sch_date ? new Date(b.pl_sch_date) : new Date(0);
        return dA - dB;
    });

    return allNotifications;
  } catch (error) {
    console.error('Error in getMaintenanceNotifications:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId, branchId]);
    throw error;
  }
};

// Supports super access users who can view all branches
const getMaintenanceNotificationsByUser = async (empIntId, orgId = 'ORG001', branchId, hasSuperAccess = false) => {
  // ROLE-BASED WORKFLOW: Check if user has any of the required job roles for pending workflows
  // Includes:
  // - asset-based maintenance + vendor contract renewal (MT005)
  // - scrap maintenance workflow approvals (tblWFScrap_*) - if tables exist
  // - inspection approvals (tblWFAATInspSch_*)
  
  // Build parameters array dynamically
  const params = [orgId];
  let paramIndex = 2;
  
  // Add branch filter condition if user doesn't have super access
  let branchFilter = '';
  let branchIdParamIndex = null;
  if (!hasSuperAccess && branchId) {
    branchIdParamIndex = paramIndex;
    params.push(branchId);
    branchFilter = ` AND a.branch_id = $${paramIndex}`;
    paramIndex++;
  }
  
  // empIntId parameter index
  const empIntIdParamIndex = paramIndex;
  params.push(empIntId);
  
  const scrapBranchFilter = (!hasSuperAccess && branchId && branchIdParamIndex)
    ? ` AND ((wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%') OR agh.branch_code = (SELECT branch_code FROM "tblBranches" WHERE branch_id = $${branchIdParamIndex}))`
    : '';

  // Inspection branch filtering uses asset branch_id like maintenance
  const inspectionBranchFilter = (!hasSuperAccess && branchId && branchIdParamIndex)
    ? ` AND a.branch_id = $${branchIdParamIndex}`
    : '';

  const maintenanceQuery = `
    SELECT *
    FROM (
    SELECT DISTINCT
      wfh.wfamsh_id,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.group_id,
      wfh.vendor_id,
      wfh.status as header_status,
      a.asset_type_id,
      ag.text as group_name,
      (SELECT COUNT(*) FROM "tblAssetGroup_D" WHERE assetgroup_h_id = wfh.group_id) as group_asset_count,
      CASE 
        WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
        ELSE at.maint_lead_type::text
      END as maint_lead_type,
      CASE 
        WHEN wfh.maint_type_id = 'MT005' THEN 'Vendor Contract Renewal'
        ELSE COALESCE(at.text, 'Unknown Asset Type')
      END as asset_type_name,
      COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
      COALESCE(mt.text, 'Regular Maintenance') as maint_type_name,
      -- Get the current action role and users
      COALESCE(current_action_role.job_role_name, 'Unknown Role') as current_action_role_name,
      current_action_role.job_role_id as current_action_role_id,
      -- Calculate cutoff date: pl_sch_date - maint_lead_type (or 10 days for MT005)
      CASE 
        WHEN wfh.maint_type_id = 'MT005' THEN wfh.pl_sch_date - INTERVAL '10 days'
        ELSE (wfh.pl_sch_date - INTERVAL '1 day' * CAST(
        CASE 
          WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
          ELSE at.maint_lead_type::text
        END AS INTEGER
        ))
      END as cutoff_date,
      -- Calculate days until due
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
      -- Calculate days until cutoff
      CASE 
        WHEN wfh.maint_type_id = 'MT005' THEN EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '10 days') - CURRENT_DATE))
        ELSE EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * CAST(
        CASE 
          WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
          ELSE at.maint_lead_type::text
        END AS INTEGER
        )) - CURRENT_DATE))
      END as days_until_cutoff
    FROM "tblWFAssetMaintSch_H" wfh
    LEFT JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
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
      AND (
        -- For asset-based maintenance: check branch_id only if user doesn't have super access
        (wfh.asset_id IS NOT NULL AND a.org_id = $1${branchFilter})
        OR
        -- For vendor contract renewal (MT005): include all (branch filtering handled by vendor)
        (wfh.maint_type_id = 'MT005' AND wfh.vendor_id IS NOT NULL)
      )
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
          AND u.emp_int_id = $${empIntIdParamIndex}
          AND u.int_status = 1
          AND wfd.status IN ('IN', 'IP', 'AP')
      )
    ) n
  `;

  const scrapQuery = `
      SELECT DISTINCT
        wh.id_d as wfamsh_id,
        wh.created_on as pl_sch_date,
        NULL::varchar as asset_id,
        wh.assetgroup_id as group_id,
        NULL::varchar as vendor_id,
        wh.status as header_status,
        seq.asset_type_id as asset_type_id,
        CASE
          WHEN wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' THEN 'Individual Asset'
          WHEN wh.assetgroup_id LIKE 'SCRAP_SALES_%' THEN 'Scrap Sales'
          ELSE COALESCE(agh.text, 'Unknown Group')
        END as group_name,
        CASE
          WHEN wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%' THEN (
            SELECT COUNT(*)::int FROM "tblAssetScrap" WHERE asset_group_id = wh.assetgroup_id
          )
          ELSE (
            SELECT COUNT(*)::int FROM "tblAssetGroup_D" WHERE assetgroup_h_id = wh.assetgroup_id
          )
        END as group_asset_count,
        '0'::text as maint_lead_type,
        COALESCE(at.text, 'Unknown Asset Type') as asset_type_name,
        'SCRAP'::varchar as maint_type_id,
        CASE
          WHEN wh.is_scrap_sales = 'Y' THEN 'Scrap Sales'
          ELSE 'Scrap Maintenance'
        END as maint_type_name,
        COALESCE(current_scrap_action_role.job_role_name, 'Unknown Role') as current_action_role_name,
        current_scrap_action_role.job_role_id as current_action_role_id,
        NULL::timestamp as cutoff_date,
        999::int as days_until_due,
        999::int as days_until_cutoff
      FROM "tblWFScrap_H" wh
      LEFT JOIN "tblAssetGroup_H" agh ON agh.assetgroup_h_id = wh.assetgroup_id
      INNER JOIN "tblWFScrapSeq" seq ON seq.id = wh.wfscrapseq_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = seq.asset_type_id
      LEFT JOIN LATERAL (
        SELECT d.job_role_id, jr.text as job_role_name
        FROM "tblWFScrap_D" d
        LEFT JOIN "tblJobRoles" jr ON d.job_role_id = jr.job_role_id
        WHERE d.wfscrap_h_id = wh.id_d
          AND d.status IN ('AP','IN')
        ORDER BY d.seq ASC, d.created_on ASC
        LIMIT 1
      ) current_scrap_action_role ON true
      WHERE (
          (wh.assetgroup_id LIKE 'SCRAP_INDIVIDUAL_%' OR wh.assetgroup_id LIKE 'SCRAP_SALES_%') AND seq.org_id = $1
          OR (agh.org_id = $1)
        )
        ${scrapBranchFilter}
        AND wh.status IN ('IN','IP')
        AND EXISTS (
          SELECT 1
          FROM "tblWFScrap_D" d2
          WHERE d2.wfscrap_h_id = wh.id_d
            AND d2.status IN ('IN','AP')
        )
        AND EXISTS (
          SELECT 1
          FROM "tblWFScrap_D" d3
          INNER JOIN "tblUserJobRoles" ujr3 ON d3.job_role_id = ujr3.job_role_id
          INNER JOIN "tblUsers" u3 ON ujr3.user_id = u3.user_id
          WHERE d3.wfscrap_h_id = wh.id_d
            AND u3.emp_int_id = $${empIntIdParamIndex}
            AND u3.int_status = 1
            AND d3.status IN ('IN','AP')
        )
  `;

  // NEW: Inspection Query
  const inspectionQuery = `
    SELECT DISTINCT
      wfh.wfaiish_id as wfamsh_id,
      wfh.pl_sch_date,
      wfh.asset_id,
      NULL::varchar as group_id,
      NULL::varchar as vendor_id,
      wfh.status as header_status,
      a.asset_type_id,
      NULL::varchar as group_name,
      0::int as group_asset_count,
      '0'::text as maint_lead_type,
      COALESCE(at.text, 'Unknown Asset Type') as asset_type_name,
      'INSPECTION'::varchar as maint_type_id,
      'Inspection' as maint_type_name,
      jr.text as current_action_role_name,
      wfd.job_role_id as current_action_role_id,
      wfh.pl_sch_date as cutoff_date,
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
      EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_cutoff
    FROM "tblWFAATInspSch_H" wfh
    INNER JOIN "tblWFAATInspSch_D" wfd ON wfh.wfaiish_id = wfd.wfaiish_id
    INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
    WHERE wfh.org_id = $1
      ${inspectionBranchFilter}
      AND wfh.status IN ('IN', 'AP', 'IP')
      AND wfd.status = 'AP'
      -- User must have this role assignemnt
      AND EXISTS (
        SELECT 1 
        FROM "tblUserJobRoles" ujr
        INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
        WHERE ujr.job_role_id = wfd.job_role_id
          AND u.emp_int_id = $${empIntIdParamIndex}
          AND u.int_status = 1
      )
  `;

  try {
    // Run maintenance query (core tables always exist)
    const maintenanceResult = await getDb().query(maintenanceQuery, params);
    let allRows = maintenanceResult.rows || [];

    // Run inspection query (try/catch in case tables are missing)
    try {
      const inspectionResult = await getDb().query(inspectionQuery, params);
      if (inspectionResult.rows && inspectionResult.rows.length > 0) {
        allRows = [...allRows, ...inspectionResult.rows];
      }
    } catch (inspErr) {
       console.warn('Error fetching inspection notifications:', inspErr.message);
    }

    // Try scrap query - scrap tables may not exist in all DBs (e.g. hospitality)
    try {
      const scrapResult = await getDb().query(
        `SELECT * FROM (${scrapQuery}) s ORDER BY s.pl_sch_date ASC NULLS LAST`,
        params
      );
      if (scrapResult.rows && scrapResult.rows.length > 0) {
        allRows = [...allRows, ...scrapResult.rows];
      }
    } catch (scrapErr) {
      // 42P01 = relation does not exist; scrap tables not yet migrated
      if (scrapErr.code === '42P01') {
        console.warn('Scrap workflow tables not found, skipping scrap notifications:', scrapErr.message);
      } else {
        console.warn('Error fetching scrap notifications:', scrapErr.message);
      }
    }

    // Sort combined results by pl_sch_date
    allRows.sort((a, b) => {
      const dA = a.pl_sch_date ? new Date(a.pl_sch_date) : new Date(0);
      const dB = b.pl_sch_date ? new Date(b.pl_sch_date) : new Date(0);
      return dA - dB;
    });

    return allRows;
  } catch (error) {
    console.error('Error in getMaintenanceNotificationsByUser:', error);
    console.error('Failed SQL Query (maintenance):', maintenanceQuery);
    console.error('Query Parameters:', params);
    throw error;
  }
};

// Supports super access users who can view all branches
const getNotificationStats = async (orgId = 'ORG001', branchId, hasSuperAccess = false) => {
  let query = `
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