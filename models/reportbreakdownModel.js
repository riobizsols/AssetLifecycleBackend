// Allowed status values (add new ones)
const ALLOWED_STATUSES = [
  "CR", // Created
  "IN", // Initiated
  "CO", // Completed
  "CF", // Confirmed
  "RE", // Reopened
  "AP", "IP", "CA" // others if used
];

// Confirm Employee Report Breakdown (final state)
const confirmEmployeeReportBreakdown = async (abrId, orgId, userId) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    // Only update if not already Confirmed
    const res = await client.query(
      `SELECT status FROM "tblAssetBRDet" WHERE abr_id = $1 AND org_id = $2`,
      [abrId, orgId]
    );
    if (!res.rows.length) throw new Error("Breakdown not found");
    if (res.rows[0].status === "CF") throw new Error("Already confirmed");
    await client.query(
      `UPDATE "tblAssetBRDet" SET status = 'CF' WHERE abr_id = $1 AND org_id = $2`,
      [abrId, orgId]
    );
    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Reopen Employee Report Breakdown (cycle restart)
const reopenEmployeeReportBreakdown = async (abrId, orgId, userId, notes) => {
  if (!notes || !notes.trim()) throw new Error("Notes are required to reopen");
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    // Only allow if not already Confirmed
    const res = await client.query(
      `SELECT status FROM "tblAssetBRDet" WHERE abr_id = $1 AND org_id = $2`,
      [abrId, orgId]
    );
    if (!res.rows.length) throw new Error("Breakdown not found");
    if (res.rows[0].status === "CF") throw new Error("Cannot reopen a confirmed breakdown");

    // 1. Employee Report Breakdown → IN (reset back to Initiated as requested)
    // and store reopen_notes and also update description so it's visible in reports
    await client.query(
      `UPDATE "tblAssetBRDet" 
       SET status = 'IN', 
           reopen_notes = $1,
           description = COALESCE(description, '') || ' [Reopened: ' || $1 || ']',
           changed_on = CURRENT_TIMESTAMP
       WHERE abr_id = $2 AND org_id = $3`,
      [notes, abrId, orgId]
    );

    // 2. Restart maintenance workflow
    // The user wants a clean restart requiring re-approval/assignment.
    // We cancel the old maintenance and re-trigger the workflow.
    
    // Fetch breakdown and asset details for workflow re-triggering
    const breakdownResult = await client.query(
      `SELECT brd.*, a.asset_type_id, a.service_vendor_id, b.branch_code
       FROM "tblAssetBRDet" brd
       LEFT JOIN "tblAssets" a ON brd.asset_id = a.asset_id
       LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
       WHERE brd.abr_id = $1`,
      [abrId]
    );
    
    const breakdownData = breakdownResult.rows[0];
    if (breakdownData) {
      const { asset_id, decision_code, reported_by } = breakdownData;
      
      // Cancel previous completed maintenance linked to this breakdown
      await client.query(
        `UPDATE "tblAssetMaintSch" 
         SET status = 'CA', changed_on = CURRENT_TIMESTAMP 
         WHERE asset_id = $1 AND status = 'CO' AND notes ILIKE $2`,
        [asset_id, `%${abrId}%`]
      );

      // Re-trigger the workflow using existing decision code
      // This will create new workflow entries requiring re-approval
      await triggerBreakdownWorkflow(client, {
        asset_id,
        decision_code: decision_code || 'BF01', // Use BF01 (Prepone) as default for re-trigger
        reported_by: userId, // The person who reopened it
        org_id: orgId,
        abr_id: abrId,
        assetRow: {
          asset_type_id: breakdownData.asset_type_id,
          service_vendor_id: breakdownData.service_vendor_id,
          branch_code: breakdownData.branch_code
        },
        existingSchedule: null // Treat as new request
      });
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
const { getDb } = require("../utils/dbContext");
const { peekNextId } = require("../utils/idGenerator");
const msModel = require("./maintenanceScheduleModel");

// Get all reports from reports-view
// Supports super access users who can view all branches
const getAllReports = async (
  orgId,
  branchId = null,
  hasSuperAccess = false,
) => {
  let query = `
    SELECT 
      brd.*,
      a.asset_type_id
    FROM "tblAssetBRDet" brd
    LEFT JOIN "tblAssets" a ON brd.asset_id = a.asset_id
    WHERE brd.org_id = $1
  `;

  const params = [orgId];

  // Apply branch filter only if user doesn't have super access
  if (!hasSuperAccess && branchId) {
    query += ` AND a.branch_id = $2`;
    params.push(branchId);
  }

  query += ` ORDER BY brd.reported_by DESC`;

  const result = await getDb().query(query, params);
  return result.rows;
};

// Reason Codes
const getBreakdownReasonCodes = async (orgId, assetTypeId = null) => {
  let query = "";
  const params = [orgId];

  if (assetTypeId) {
    // If assetTypeId is provided, filter by it and ensure unique atbrrc_id
    query = `
      SELECT DISTINCT ON (atbrrc_id) atbrrc_id, asset_type_id, text, instatus, org_id
      FROM "tblATBRReasonCodes"
      WHERE instatus = '1' AND org_id = $1 AND asset_type_id = $2
      ORDER BY atbrrc_id, text ASC
    `;
    params.push(assetTypeId);
  } else {
    // If no assetTypeId, just get distinct codes (shouldn't happen in normal flow)
    query = `
      SELECT DISTINCT ON (atbrrc_id) atbrrc_id, asset_type_id, text, instatus, org_id
      FROM "tblATBRReasonCodes"
      WHERE instatus = '1' AND org_id = $1
      ORDER BY atbrrc_id, text ASC
    `;
  }

  console.log("Reason codes query:", query);
  console.log("Reason codes params:", params);

  const result = await getDb().query(query, params);
  console.log("Reason codes result:", result.rows.length, "rows");

  return result.rows;
};

// Get upcoming maintenance date for an asset (simplified version)
const getUpcomingMaintenanceDate = async (assetId) => {
  // Get the next maintenance date (including overdue maintenance)
  const query = `
    SELECT act_maint_st_date
    FROM "tblAssetMaintSch"
    WHERE asset_id = $1 
      AND status IN ('IN', 'AP', 'RE')
    ORDER BY act_maint_st_date ASC
    LIMIT 1
  `;

  const result = await getDb().query(query, [assetId]);

  if (result.rows.length > 0) {
    return result.rows[0].act_maint_st_date;
  }

  // If no maintenance found, check workflow maintenance schedules
  const workflowQuery = `
    SELECT act_sch_date
    FROM "tblWFAssetMaintSch_H"
    WHERE asset_id = $1 
      AND status IN ('IN', 'AP', 'IP', 'RE')
    ORDER BY act_sch_date ASC
    LIMIT 1
  `;

  const workflowResult = await getDb().query(workflowQuery, [assetId]);

  return workflowResult.rows.length > 0
    ? workflowResult.rows[0].act_sch_date
    : null;
};

// Get upcoming maintenance date with recommendation for an asset
const getUpcomingMaintenanceWithRecommendation = async (assetId) => {
  const maintenanceDate = await getUpcomingMaintenanceDate(assetId);

  if (!maintenanceDate) {
    return {
      upcoming_maintenance_date: null,
      create_maintenance_recommendation: "Yes", // Default to Yes if no maintenance scheduled
    };
  }

  // Calculate days difference
  const currentDate = new Date();
  const maintenanceDateTime = new Date(maintenanceDate);
  const timeDifference = maintenanceDateTime.getTime() - currentDate.getTime();
  const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

  // If difference is less than 30 days, recommend "No", otherwise "Yes"
  const recommendation = daysDifference < 30 ? "No" : "Yes";

  return {
    upcoming_maintenance_date: maintenanceDate,
    create_maintenance_recommendation: recommendation,
    days_until_maintenance: daysDifference,
  };
};

// Extracted workflow triggering logic - reusable for both create and update
const triggerBreakdownWorkflow = async (
  client,
  {
    asset_id,
    decision_code,
    reported_by,
    org_id,
    abr_id,
    assetRow,
    existingSchedule,
  },
) => {
  const nowDate = new Date();
  const nowISODateOnly = new Date().toISOString().split("T")[0];
  let maintenanceResult = null;

  // Determine if workflow applies (by asset type)
  let hasWorkflow = false;
  if (assetRow && assetRow.asset_type_id) {
    hasWorkflow = await msModel.checkAssetTypeWorkflow(assetRow.asset_type_id);
  }

  const appendWorkOrderNote = (currentWo, suffix) => {
    const base = currentWo ? String(currentWo) : "";
    return base && base.length > 0 ? `${base} - ${suffix}` : `${suffix}`;
  };

  if (decision_code === "BF01") {
    // Prepone: create workflow if required, or direct schedule if no workflow
    // Always create workflow even if existing schedule exists (for approval process)
    if (hasWorkflow) {
      // Create workflow H/D entries for BF01
      // Determine frequency/maint_type if available
      let at_main_freq_id = null;
      let maint_type_id = null;
      if (assetRow && assetRow.asset_type_id) {
        const freqRes = await msModel.getMaintenanceFrequency(
          assetRow.asset_type_id,
        );
        if (freqRes.rows && freqRes.rows.length > 0) {
          at_main_freq_id = freqRes.rows[0].at_main_freq_id;
          maint_type_id = freqRes.rows[0].maint_type_id;
        }
      }
      const wfamsh_id = await msModel.getNextWFAMSHId();
      const headerRes = await msModel.insertWorkflowMaintenanceScheduleHeader({
        wfamsh_id,
        at_main_freq_id,
        maint_type_id: "MT004",
        asset_id,
        group_id: null,
        vendor_id: assetRow ? assetRow.service_vendor_id : null,
        pl_sch_date: nowDate,
        act_sch_date: nowDate,
        status: "IP",
        created_by: reported_by,
        org_id,
        branch_code: assetRow ? assetRow.branch_code : null,
        isBreakdown: true,
      });
      // Create first detail step as AP (Approval Pending), others IN (Inactive)
      const seqsRes = await msModel.getWorkflowAssetSequences(
        assetRow.asset_type_id,
      );
      for (let i = 0; i < seqsRes.rows.length; i++) {
        const seq = seqsRes.rows[i];
        const wfamsd_id = await msModel.getNextWFAMSDId();
        // Fetch approvers for step
        const jobRolesRes = await msModel.getWorkflowJobRoles(seq.wf_steps_id);
        const firstDetailStatus = i === 0 ? "AP" : "IN";
        // Add BF01 marker to notes to identify this as a prepone breakdown
        const noteText = existingSchedule
          ? `BF01-Breakdown-${abr_id}-ExistingSchedule-${existingSchedule.ams_id}`
          : `BF01-Breakdown-${abr_id}`;
        await msModel.insertWorkflowMaintenanceScheduleDetail({
          wfamsd_id,
          wfamsh_id: headerRes.rows[0].wfamsh_id,
          job_role_id: jobRolesRes.rows[0]?.job_role_id || null,
          user_id: jobRolesRes.rows[0]?.emp_int_id || null,
          dept_id: jobRolesRes.rows[0]?.dept_id || null,
          sequence: seq.seqs_no,
          status: firstDetailStatus,
          notes: noteText,
          created_by: reported_by,
          org_id,
        });
      }
      maintenanceResult = headerRes.rows[0];
    } else if (existingSchedule) {
      // No workflow but existing schedule: update the existing schedule directly
      // Note: wo_id is not updated, only the maintenance date is preponed
      const updateRes = await client.query(
        `UPDATE "tblAssetMaintSch"
         SET act_maint_st_date = $1,
             branch_code = COALESCE($2, branch_code),
             changed_on = CURRENT_TIMESTAMP
         WHERE ams_id = $3
         RETURNING *`,
        [
          nowISODateOnly,
          assetRow ? assetRow.branch_code : null,
          existingSchedule.ams_id,
        ],
      );
      maintenanceResult = updateRes.rows[0];
    } else {
      // No workflow and no existing schedule: create direct schedule in AMS
      const ams_id = await msModel.getNextAMSId();
      // Determine maintained_by based on service_vendor_id (similar to BF02 logic)
      const maintainedBy =
        assetRow && assetRow.service_vendor_id ? "Vendor" : "Inhouse";
      const insertDirectRes = await msModel.insertDirectMaintenanceSchedule({
        ams_id,
        asset_id,
        maint_type_id: "MT004", // Set MT004 for breakdown maintenance
        vendor_id: assetRow ? assetRow.service_vendor_id : null,
        at_main_freq_id: null,
        maintained_by: maintainedBy,
        notes: `Breakdown Maintenance - ${abr_id}`,
        status: "IN",
        act_maint_st_date: nowISODateOnly,
        created_by: reported_by,
        org_id,
      });
      maintenanceResult = insertDirectRes.rows[0];
    }
  } else if (decision_code === "BF02") {
    // Separate breakdown fix, do not modify existing schedule
    if (hasWorkflow) {
      // Create workflow H/D entries
      let at_main_freq_id = null;
      let maint_type_id = null;
      if (assetRow && assetRow.asset_type_id) {
        const freqRes = await msModel.getMaintenanceFrequency(
          assetRow.asset_type_id,
        );
        if (freqRes.rows && freqRes.rows.length > 0) {
          at_main_freq_id = freqRes.rows[0].at_main_freq_id;
          maint_type_id = freqRes.rows[0].maint_type_id;
        }
      }
      const wfamsh_id = await msModel.getNextWFAMSHId();
      const headerRes = await msModel.insertWorkflowMaintenanceScheduleHeader({
        wfamsh_id,
        at_main_freq_id,
        maint_type_id: "MT004",
        asset_id,
        group_id: null,
        vendor_id: assetRow ? assetRow.service_vendor_id : null,
        pl_sch_date: nowDate,
        act_sch_date: nowDate,
        status: "IP",
        created_by: reported_by,
        org_id,
        branch_code: assetRow ? assetRow.branch_code : null,
        isBreakdown: true,
      });
      const seqsRes = await msModel.getWorkflowAssetSequences(
        assetRow.asset_type_id,
      );
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
          status: i === 0 ? "AP" : "IN",
          notes: `Breakdown ${abr_id}`,
          created_by: reported_by,
          org_id,
        });
      }
      maintenanceResult = headerRes.rows[0];
    } else {
      // Create a new AMS line, do not touch existing
      const ams_id = await msModel.getNextAMSId();
      // Determine maintained_by based on service_vendor_id (similar to workflow logic)
      const maintainedBy =
        assetRow && assetRow.service_vendor_id ? "Vendor" : "Inhouse";
      const insertDirectRes = await msModel.insertDirectMaintenanceSchedule({
        ams_id,
        asset_id,
        maint_type_id: "MT004", // Set MT004 for breakdown maintenance
        vendor_id: assetRow ? assetRow.service_vendor_id : null,
        at_main_freq_id: null,
        maintained_by: maintainedBy,
        notes: `Breakdown Maintenance - ${abr_id}`,
        status: "IN",
        act_maint_st_date: nowISODateOnly,
        created_by: reported_by,
        org_id,
      });
      maintenanceResult = insertDirectRes.rows[0];
    }
  } else if (decision_code === "BF03") {
    // Postpone: Create workflow for approval without immediate changes to schedule
    if (hasWorkflow) {
      // Create workflow for BF03 postpone breakdown
      let at_main_freq_id = null;
      let maint_type_id = null;
      if (assetRow && assetRow.asset_type_id) {
        const freqRes = await msModel.getMaintenanceFrequency(
          assetRow.asset_type_id,
        );
        if (freqRes.rows && freqRes.rows.length > 0) {
          at_main_freq_id = freqRes.rows[0].at_main_freq_id;
          maint_type_id = freqRes.rows[0].maint_type_id;
        }
      }

      const wfamsh_id = await msModel.getNextWFAMSHId();

      // Create workflow header with BF03 postpone information
      const noteText = existingSchedule
        ? `BF03-Breakdown-${abr_id}-ExistingSchedule-${existingSchedule.ams_id}`
        : `BF03-Breakdown-${abr_id}`;

      const headerRes = await msModel.insertWorkflowMaintenanceScheduleHeader({
        wfamsh_id,
        at_main_freq_id,
        maint_type_id: "MT004", // Breakdown maintenance
        asset_id,
        group_id: null,
        vendor_id: assetRow ? assetRow.service_vendor_id : null,
        pl_sch_date: nowDate,
        act_sch_date: nowDate,
        status: "IP",
        created_by: reported_by,
        org_id,
        branch_code: assetRow ? assetRow.branch_code : null,
        isBreakdown: true,
      });

      // Create workflow details for each approver
      const seqsRes = await msModel.getWorkflowAssetSequences(
        assetRow.asset_type_id,
      );
      for (let i = 0; i < seqsRes.rows.length; i++) {
        const seq = seqsRes.rows[i];
        const wfamsd_id = await msModel.getNextWFAMSDId();
        const jobRolesRes = await msModel.getWorkflowJobRoles(seq.wf_steps_id);
        const firstDetailStatus = i === 0 ? "AP" : "IN";

        await msModel.insertWorkflowMaintenanceScheduleDetail({
          wfamsd_id,
          wfamsh_id: headerRes.rows[0].wfamsh_id,
          job_role_id: jobRolesRes.rows[0]?.job_role_id || null,
          user_id: jobRolesRes.rows[0]?.emp_int_id || null,
          dept_id: jobRolesRes.rows[0]?.dept_id || null,
          sequence: seq.seqs_no,
          status: firstDetailStatus,
          notes: noteText,
          created_by: reported_by,
          org_id,
        });
      }
      maintenanceResult = headerRes.rows[0];
    } else {
      // No workflow: Just return existing schedule without changes
      if (existingSchedule) {
        maintenanceResult = existingSchedule;
      }
    }
  }

  return maintenanceResult;
};

// Create a new breakdown report with workflow integration and schedule handling
const createBreakdownReport = async (breakdownData) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    const {
      asset_id,
      atbrrc_id,
      reported_by,
      description,
      decision_code, // BF01 | BF02 | BF03 (optional on create, can be set later)
      org_id,
    } = breakdownData;

    // Validate decision code value if provided
    const validDecisionCodes = ["BF01", "BF02", "BF03"];
    if (decision_code && !validDecisionCodes.includes(decision_code)) {
      throw new Error("Invalid decision code. Must be BF01, BF02, or BF03");
    }

    // Use a placeholder value if decision_code is not provided (to satisfy NOT NULL constraint)
    // This allows decision_code to be set later via update endpoint
    // Note: If the database column should be nullable, a migration should be created
    const finalDecisionCode = decision_code || "BF03"; // Default to BF03 (Postpone) if not provided

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
      finalDecisionCode,
      "CR",
      description,
      org_id,
    ];
    const breakdownInsert = await client.query(insertQuery, insertValues);
    const breakdownRecord = breakdownInsert.rows[0];

    // Helper: fetch asset_type_id and basic info
    const assetQuery = `
      SELECT a.asset_id, a.asset_type_id, a.service_vendor_id, a.org_id, a.branch_id, b.branch_code
      FROM "tblAssets" a
      LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
      WHERE a.asset_id = $1
    `;
    const assetRes = await client.query(assetQuery, [asset_id]);
    const assetRow = assetRes.rows[0] || null;

    // Upcoming maintenance info
    const upcomingMaintenance =
      await getUpcomingMaintenanceWithRecommendation(asset_id);

    // Check existing IN schedule
    const existingSchRes = await client.query(
      `SELECT ams_id, status, act_maint_st_date, wo_id
       FROM "tblAssetMaintSch"
       WHERE asset_id = $1 AND status = 'IN'
       ORDER BY act_maint_st_date ASC
       LIMIT 1`,
      [asset_id],
    );
    const existingSchedule = existingSchRes.rows[0] || null;

    // Trigger workflow only if decision_code was explicitly provided by the user
    // If not provided, it defaults to BF03 but workflow is not triggered (can be set later via update)
    let maintenanceResult = null;
    if (decision_code) {
      maintenanceResult = await triggerBreakdownWorkflow(client, {
        asset_id,
        decision_code: finalDecisionCode,
        reported_by,
        org_id,
        abr_id,
        assetRow,
        existingSchedule,
      });
    }

    await client.query("COMMIT");

    return {
      breakdown: breakdownRecord,
      maintenance: maintenanceResult,
      upcoming_maintenance: upcomingMaintenance,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error in createBreakdownReport:", {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column,
      stack: err.stack,
    });
    throw err;
  } finally {
    client.release();
  }
};

// Update breakdown report
const updateBreakdownReport = async (abrId, updateData) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    const {
      atbrrc_id,
      description,
      reported_by_type,
      decision_code,
      priority,
      reported_by_user_id,
      reported_by_dept_id,
    } = updateData;

    // Validate required fields (decision_code is optional)
    if (!atbrrc_id || !description) {
      throw new Error("Missing required fields: atbrrc_id, description");
    }

    // Validate decision code (only if provided)
    const validDecisionCodes = ["BF01", "BF02", "BF03"];
    if (decision_code && !validDecisionCodes.includes(decision_code)) {
      throw new Error("Invalid decision code. Must be BF01, BF02, or BF03");
    }

    // Get current breakdown to check if decision_code is being set for first time
    const currentQuery = `SELECT * FROM "tblAssetBRDet" WHERE abr_id = $1`;
    const currentResult = await client.query(currentQuery, [abrId]);
    const currentBreakdown = currentResult.rows[0];

    if (!currentBreakdown) {
      throw new Error("Breakdown report not found");
    }

    // Check if decision_code is being set or changed
    // Trigger workflow if:
    // 1. decision_code is being set for the first time (null/empty -> BF01/BF02/BF03), OR
    // 2. decision_code is being changed to a different value
    const isDecisionCodeSet = !currentBreakdown.decision_code && decision_code;
    const isDecisionCodeChanged =
      currentBreakdown.decision_code &&
      decision_code &&
      currentBreakdown.decision_code !== decision_code;

    // Determine new status: if decision_code is being set/changed, update status from CR to IN
    // Do not update if status is already CO (Completed)
    let newStatus = null;
    if ((isDecisionCodeSet || isDecisionCodeChanged) && currentBreakdown.status !== "CO") {
      newStatus = "IN"; // Initiated
      console.log(`Setting status to "IN" (Initiated) for breakdown ${abrId} as decision code is being set/changed`);
    }

    const updateQuery = `
      UPDATE "tblAssetBRDet" 
      SET 
        atbrrc_id = $1,
        description = $2,
        decision_code = $3${newStatus ? ', status = $5' : ''}
      WHERE abr_id = $4
      RETURNING *
    `;

    const updateValues = [atbrrc_id, description, decision_code, abrId];
    if (newStatus) {
      updateValues.push(newStatus);
    }

    const result = await client.query(updateQuery, updateValues);
    const updatedBreakdown = result.rows[0];

    if (isDecisionCodeSet || isDecisionCodeChanged) {
      console.log(
        `Decision code set for breakdown ${abrId}: ${decision_code} - Triggering workflow`,
      );

      // Fetch asset details for workflow processing
      const assetQuery = `
        SELECT a.asset_id, a.asset_type_id, a.service_vendor_id, a.org_id, a.branch_id, b.branch_code
        FROM "tblAssets" a
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        WHERE a.asset_id = $1
      `;
      const assetRes = await client.query(assetQuery, [
        currentBreakdown.asset_id,
      ]);
      const assetRow = assetRes.rows[0] || null;

      // Check for existing maintenance schedule
      const existingSchRes = await client.query(
        `SELECT ams_id, status, act_maint_st_date, wo_id
         FROM "tblAssetMaintSch"
         WHERE asset_id = $1 AND status = 'IN'
         ORDER BY act_maint_st_date ASC
         LIMIT 1`,
        [currentBreakdown.asset_id],
      );
      const existingSchedule = existingSchRes.rows[0] || null;

      // Trigger the workflow
      await triggerBreakdownWorkflow(client, {
        asset_id: currentBreakdown.asset_id,
        decision_code: decision_code,
        reported_by: currentBreakdown.reported_by,
        org_id: currentBreakdown.org_id,
        abr_id: abrId,
        assetRow,
        existingSchedule,
      });

      console.log(`Workflow triggered successfully for breakdown ${abrId}`);
    }

    await client.query("COMMIT");
    return updatedBreakdown;
  } catch (err) {
    await client.query("ROLLBACK");
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
  updateBreakdownReport,
  confirmEmployeeReportBreakdown,
  reopenEmployeeReportBreakdown,
};