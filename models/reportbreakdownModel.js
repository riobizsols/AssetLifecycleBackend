const pool = require('../config/db');
const { peekNextId } = require('../utils/idGenerator');
const msModel = require('./maintenanceScheduleModel');

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
const getBreakdownReasonCodes = async (orgId, assetTypeId = null) => {
  let query = `
    SELECT atbrrc_id, asset_type_id, text, instatus, org_id
    FROM "tblATBRReasonCodes"
    WHERE instatus = '1' AND org_id = $1
  `;
  const params = [orgId];
  if (assetTypeId) {
    query += ' AND asset_type_id = $2';
    params.push(assetTypeId);
  }
  query += ' ORDER BY text ASC';
  
  console.log('Reason codes query:', query);
  console.log('Reason codes params:', params);
  
  const result = await pool.query(query, params);
  console.log('Reason codes result:', result.rows.length, 'rows');
  
  return result.rows;
};



// Get upcoming maintenance date for an asset (simplified version)
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

// Create a new breakdown report with workflow integration and schedule handling
const createBreakdownReport = async (breakdownData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      asset_id,
      atbrrc_id,
      reported_by,
      description,
      decision_code, // BF01 | BF02 | BF03
      org_id
    } = breakdownData;

    // Generate a unique sequential abr_id
    const getNextAbrId = async () => {
      return await peekNextId("ABR", '"tblAssetBRDet"', "abr_id", 3);
    };
    const abr_id = await getNextAbrId();

    // Insert breakdown record
    const insertQuery = `
      INSERT INTO "tblAssetBRDet" (
        abr_id,
        asset_id,
        atbrrc_id,
        reported_by,
        is_create_maintenance,
        decision_code,
        status,
        description,
        org_id,
        created_on
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const insertValues = [
      abr_id,
      asset_id,
      atbrrc_id,
      reported_by,
      false,
      decision_code,
      'CR',
      description,
      org_id
    ];
    const breakdownInsert = await client.query(insertQuery, insertValues);
    const breakdownRecord = breakdownInsert.rows[0];

    // Helper: fetch asset_type_id and basic info
    const assetQuery = `
      SELECT a.asset_id, a.asset_type_id, a.service_vendor_id, a.org_id
      FROM "tblAssets" a
      WHERE a.asset_id = $1
    `;
    const assetRes = await client.query(assetQuery, [asset_id]);
    const assetRow = assetRes.rows[0] || null;

    // Upcoming maintenance info
    const upcomingMaintenance = await getUpcomingMaintenanceWithRecommendation(asset_id);

    let maintenanceResult = null;
    const nowDate = new Date();
    const nowISODateOnly = new Date().toISOString().split('T')[0];

    // Check existing IN schedule
    const existingSchRes = await client.query(
      `SELECT ams_id, status, act_maint_st_date, wo_id
       FROM "tblAssetMaintSch"
       WHERE asset_id = $1 AND status = 'IN'
       ORDER BY act_maint_st_date ASC
       LIMIT 1`,
      [asset_id]
    );
    const existingSchedule = existingSchRes.rows[0] || null;

    // Determine if workflow applies (by asset type)
    let hasWorkflow = false;
    if (assetRow && assetRow.asset_type_id) {
      hasWorkflow = await msModel.checkAssetTypeWorkflow(assetRow.asset_type_id);
    }

    const appendWorkOrderNote = (currentWo, suffix) => {
      const base = currentWo ? String(currentWo) : '';
      return base && base.length > 0 ? `${base} - Breakdown: ${suffix}` : `Breakdown: ${suffix}`;
    };

    if (decision_code === 'BF01') {
      // Prepone: tie to current maintenance schedule when present, otherwise create new
      if (existingSchedule) {
        const updateRes = await client.query(
          `UPDATE "tblAssetMaintSch"
           SET act_maint_st_date = $1,
               wo_id = $2,
               changed_on = CURRENT_TIMESTAMP
           WHERE ams_id = $3
           RETURNING *`,
          [nowISODateOnly, appendWorkOrderNote(existingSchedule.wo_id, abr_id), existingSchedule.ams_id]
        );
        maintenanceResult = updateRes.rows[0];
      } else if (hasWorkflow) {
        // Create workflow H/D entries
        // Determine frequency/maint_type if available
        let at_main_freq_id = null;
        let maint_type_id = null;
        if (assetRow && assetRow.asset_type_id) {
          const freqRes = await msModel.getMaintenanceFrequency(assetRow.asset_type_id);
          if (freqRes.rows && freqRes.rows.length > 0) {
            at_main_freq_id = freqRes.rows[0].at_main_freq_id;
            maint_type_id = freqRes.rows[0].maint_type_id;
          }
        }
        const wfamsh_id = await msModel.getNextWFAMSHId();
        const headerRes = await msModel.insertWorkflowMaintenanceScheduleHeader({
          wfamsh_id,
          at_main_freq_id,
          maint_type_id: 'MT004',
          asset_id,
          group_id: null,
          vendor_id: assetRow ? assetRow.service_vendor_id : null,
          pl_sch_date: nowDate,
          act_sch_date: nowDate,
          status: 'IP',
          created_by: reported_by,
          org_id,
          isBreakdown: true
        });
        // Create first detail step as IN, others PD
        const seqsRes = await msModel.getWorkflowAssetSequences(assetRow.asset_type_id);
        for (let i = 0; i < seqsRes.rows.length; i++) {
          const seq = seqsRes.rows[i];
          const wfamsd_id = await msModel.getNextWFAMSDId();
          // Fetch approvers for step
          const jobRolesRes = await msModel.getWorkflowJobRoles(seq.wf_steps_id);
          const firstDetailStatus = i === 0 ? 'AP' : 'IN';
          await msModel.insertWorkflowMaintenanceScheduleDetail({
            wfamsd_id,
            wfamsh_id: headerRes.rows[0].wfamsh_id,
            job_role_id: jobRolesRes.rows[0]?.job_role_id || null,
            user_id: jobRolesRes.rows[0]?.emp_int_id || null,
            dept_id: jobRolesRes.rows[0]?.dept_id || null,
            sequence: seq.seqs_no,
            status: firstDetailStatus,
            notes: `Breakdown ${abr_id}`,
            created_by: reported_by,
            org_id
          });
        }
        maintenanceResult = headerRes.rows[0];
      } else {
        // Direct create schedule in AMS
        const ams_id = await msModel.getNextAMSId();
        const insertDirectRes = await msModel.insertDirectMaintenanceSchedule({
          ams_id,
          asset_id,
          maint_type_id: null,
          vendor_id: assetRow ? assetRow.service_vendor_id : null,
          at_main_freq_id: null,
          maintained_by: null,
          notes: `Breakdown Maintenance - ${abr_id}`,
          status: 'IN',
          act_maint_st_date: nowISODateOnly,
          created_by: reported_by,
          org_id
        });
        maintenanceResult = insertDirectRes.rows[0];
      }
    } else if (decision_code === 'BF02') {
      // Separate breakdown fix, do not modify existing schedule
      if (hasWorkflow) {
        // Create workflow H/D entries
        let at_main_freq_id = null;
        let maint_type_id = null;
        if (assetRow && assetRow.asset_type_id) {
          const freqRes = await msModel.getMaintenanceFrequency(assetRow.asset_type_id);
          if (freqRes.rows && freqRes.rows.length > 0) {
            at_main_freq_id = freqRes.rows[0].at_main_freq_id;
            maint_type_id = freqRes.rows[0].maint_type_id;
          }
        }
        const wfamsh_id = await msModel.getNextWFAMSHId();
        const headerRes = await msModel.insertWorkflowMaintenanceScheduleHeader({
          wfamsh_id,
          at_main_freq_id,
          maint_type_id: 'MT004',
          asset_id,
          group_id: null,
          vendor_id: assetRow ? assetRow.service_vendor_id : null,
          pl_sch_date: nowDate,
          act_sch_date: nowDate,
          status: 'IP',
          created_by: reported_by,
          org_id,
          isBreakdown: true
        });
        const seqsRes = await msModel.getWorkflowAssetSequences(assetRow.asset_type_id);
        for (let i = 0; i < seqsRes.rows.length; i++) {
          const seq = seqsRes.rows[i];
          const wfamsd_id = await msModel.getNextWFAMSDId();
          const jobRolesRes = await msModel.getWorkflowJobRoles(seq.wf_steps_id);
          await msModel.insertWorkflowMaintenanceScheduleDetail({
            wfamsd_id,
            wfamsh_id: headerRes.rows[0].wfamsh_id,
            job_role_id: jobRolesRes.rows[0]?.job_role_id || null,
            user_id: jobRolesRes.rows[0]?.emp_int_id || null,
            dept_id: jobRolesRes.rows[0]?.dept_id || null,
            sequence: seq.seqs_no,
            status: i === 0 ? 'AP' : 'IN',
            notes: `Breakdown ${abr_id}`,
            created_by: reported_by,
            org_id
          });
        }
        maintenanceResult = headerRes.rows[0];
      } else {
        // Create a new AMS line, do not touch existing
        const ams_id = await msModel.getNextAMSId();
        const insertDirectRes = await msModel.insertDirectMaintenanceSchedule({
          ams_id,
          asset_id,
          maint_type_id: null,
          vendor_id: assetRow ? assetRow.service_vendor_id : null,
          at_main_freq_id: null,
          maintained_by: null,
          notes: `Breakdown Maintenance - ${abr_id}`,
          status: 'IN',
          act_maint_st_date: nowISODateOnly,
          created_by: reported_by,
          org_id
        });
        maintenanceResult = insertDirectRes.rows[0];
      }
    } else if (decision_code === 'BF03') {
      // Postpone: only update work order of existing IN schedule if present
      if (existingSchedule) {
        const updateRes = await client.query(
          `UPDATE "tblAssetMaintSch"
           SET wo_id = $1,
               changed_on = CURRENT_TIMESTAMP
           WHERE ams_id = $2
           RETURNING *`,
          [appendWorkOrderNote(existingSchedule.wo_id, abr_id), existingSchedule.ams_id]
        );
        maintenanceResult = updateRes.rows[0];
      }
    }

    await client.query('COMMIT');

    return {
      breakdown: breakdownRecord,
      maintenance: maintenanceResult,
      upcoming_maintenance: upcomingMaintenance
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};



// Update breakdown report
const updateBreakdownReport = async (abrId, updateData) => {
  const client = await pool.connect();
  try {
    const {
      atbrrc_id,
      description,
      reported_by_type,
      decision_code,
      priority,
      reported_by_user_id,
      reported_by_dept_id
    } = updateData;

    // Validate required fields
    if (!atbrrc_id || !description || !decision_code) {
      throw new Error('Missing required fields: atbrrc_id, description, decision_code');
    }

    // Validate decision code
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (!validDecisionCodes.includes(decision_code)) {
      throw new Error('Invalid decision code. Must be BF01, BF02, or BF03');
    }

    const updateQuery = `
      UPDATE "tblAssetBRDet" 
      SET 
        atbrrc_id = $1,
        description = $2,
        decision_code = $3
      WHERE abr_id = $4
      RETURNING *
    `;

    const updateValues = [
      atbrrc_id,
      description,
      decision_code,
      abrId
    ];

    const result = await client.query(updateQuery, updateValues);
    
    if (result.rows.length === 0) {
      throw new Error('Breakdown report not found');
    }

    return result.rows[0];
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getBreakdownReasonCodes,
  getAllReports,
  getUpcomingMaintenanceDate,
  createBreakdownReport,
  updateBreakdownReport
};
