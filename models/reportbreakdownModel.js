const pool = require('../config/db');
const { peekNextId } = require('../utils/idGenerator');

// Get all reports from reports-view
const getAllReports = async (orgId) => {
  const query = `
    SELECT *
    FROM "tblAssetBRDet"
    WHERE org_id = $1
    ORDER BY reported_by DESC
  `;
  const result = await pool.query(query, [orgId]);
  return result.rows;
};

// Reason Codes
const getBreakdownReasonCodes = async (orgId = 'ORG001', assetTypeId = null) => {
  let query = `
    SELECT atbrrc_id, asset_type_id, text, instatus, org_id
    FROM "tblATBRReasonCodes"
    WHERE instatus = 'A' AND org_id = $1
  `;
  const params = [orgId];
  if (assetTypeId) {
    query += ' AND asset_type_id = $2';
    params.push(assetTypeId);
  }
  query += ' ORDER BY text ASC';
  const result = await pool.query(query, params);
  return result.rows;
};

// Get upcoming maintenance date for an asset
const getUpcomingMaintenanceDate = async (assetId) => {
  // Get the next maintenance date (including overdue maintenance)
  const query = `
    SELECT act_maint_st_date
    FROM "tblAssetMaintSch"
    WHERE asset_id = $1 
      AND status IN ('IN', 'AP')
    ORDER BY act_maint_st_date ASC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [assetId]);
  
  if (result.rows.length > 0) {
    return result.rows[0].act_maint_st_date;
  }
  
  // If no maintenance found, check workflow maintenance schedules
  const workflowQuery = `
    SELECT act_sch_date
    FROM "tblWFAssetMaintSch_H"
    WHERE asset_id = $1 
      AND status IN ('IN', 'AP', 'IP')
    ORDER BY act_sch_date ASC
    LIMIT 1
  `;
  
  const workflowResult = await pool.query(workflowQuery, [assetId]);
  
  return workflowResult.rows.length > 0 ? workflowResult.rows[0].act_sch_date : null;
};

// Get upcoming maintenance date with recommendation for an asset
const getUpcomingMaintenanceWithRecommendation = async (assetId) => {
  const maintenanceDate = await getUpcomingMaintenanceDate(assetId);
  
  if (!maintenanceDate) {
    return {
      upcoming_maintenance_date: null,
      create_maintenance_recommendation: 'Yes' // Default to Yes if no maintenance scheduled
    };
  }
  
  // Calculate days difference
  const currentDate = new Date();
  const maintenanceDateTime = new Date(maintenanceDate);
  const timeDifference = maintenanceDateTime.getTime() - currentDate.getTime();
  const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
  
  // If difference is less than 30 days, recommend "No", otherwise "Yes"
  const recommendation = daysDifference < 30 ? 'No' : 'Yes';
  
  return {
    upcoming_maintenance_date: maintenanceDate,
    create_maintenance_recommendation: recommendation,
    days_until_maintenance: daysDifference
  };
};

// Create a new breakdown report
const createBreakdownReport = async (breakdownData) => {
  const {
    asset_id,
    atbrrc_id,
    reported_by,
    is_create_maintenance,
    description,
    org_id
  } = breakdownData;

  // Generate a unique sequential abr_id using the existing ID generator
  const getNextAbrId = async () => {
    return await peekNextId("ABR", '"tblAssetBRDet"', "abr_id", 3);
  };

  const abr_id = await getNextAbrId();

  const query = `
    INSERT INTO "tblAssetBRDet" (
      abr_id, 
      asset_id, 
      atbrrc_id, 
      reported_by, 
      is_create_maintenance, 
      status, 
      description, 
      org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [
    abr_id,
    asset_id,
    atbrrc_id,
    reported_by,
    is_create_maintenance,
    'CR', // Default status for new breakdown reports (Pending)
    description,
    org_id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};



module.exports = {
  getBreakdownReasonCodes,
  getAllReports,
  getUpcomingMaintenanceDate,
  getUpcomingMaintenanceWithRecommendation,
  createBreakdownReport
};
