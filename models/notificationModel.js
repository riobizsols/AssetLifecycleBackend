const pool = require('../config/db');

const getMaintenanceNotifications = async (orgId = 'ORG001') => {
  const query = `
    SELECT 
      wfd.wfamsd_id,
      wfd.wfamsh_id,
      wfd.user_id,
      wfd.sequence,
      wfd.status as detail_status,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.status as header_status,
      a.asset_type_id,
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
    WHERE wfd.org_id = $1 
      AND wfd.status IN ('IN', 'IP')
      AND wfh.status IN ('IN', 'IP')
      AND wfd.user_id IS NOT NULL
    ORDER BY wfh.pl_sch_date ASC, wfd.sequence ASC
  `;
  try {
    const result = await pool.query(query, [orgId]);
    return result.rows;
  } catch (error) {
    console.error('Error in getMaintenanceNotifications:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId]);
    throw error;
  }
};

const getMaintenanceNotificationsByUser = async (userId, orgId = 'ORG001') => {
  const query = `
    SELECT 
      wfd.wfamsd_id,
      wfd.wfamsh_id,
      wfd.user_id,
      wfd.sequence,
      wfd.status as detail_status,
      wfh.pl_sch_date,
      wfh.asset_id,
      wfh.status as header_status,
      a.asset_type_id,
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
    WHERE wfd.org_id = $1 
      AND wfd.user_id = $2
      AND wfd.status IN ('IN', 'IP')
      AND wfh.status IN ('IN', 'IP')
    ORDER BY wfh.pl_sch_date ASC, wfd.sequence ASC
  `;
  try {
    const result = await pool.query(query, [orgId, userId]);
    return result.rows;
  } catch (error) {
    console.error('Error in getMaintenanceNotificationsByUser:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId, userId]);
    throw error;
  }
};

const getNotificationStats = async (orgId = 'ORG001') => {
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
      AND wfd.status IN ('IN', 'IP')
      AND wfh.status IN ('IN', 'IP')
      AND wfd.user_id IS NOT NULL
  `;
  try {
    const result = await pool.query(query, [orgId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error in getNotificationStats:', error);
    console.error('Failed SQL Query:', query);
    console.error('Query Parameters:', [orgId]);
    throw error;
  }
};

module.exports = {
  getMaintenanceNotifications,
  getMaintenanceNotificationsByUser,
  getNotificationStats
}; 