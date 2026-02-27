const pool = require('../config/db');

/**
 * CHUNK 2.1: BASIC APPROVAL QUERIES (READ OPERATIONS)
 * 
 * This model handles all read operations for inspection approvals:
 * - Get pending approvals for a job role
 * - Get detailed information about a specific inspection
 * - Get approval workflow history
 */

/**
 * Get all pending inspection approvals for a specific job role (or list of roles)
 * @param {string} orgId - Organization ID from token
 * @param {string} branchCode - Branch code from token
 * @param {string|string[]} jobRoles - Job role ID or array of IDs (e.g., 'JR001' or ['JR001', 'JR002'])
 * @returns {Array} List of pending approvals
 */
async function getPendingInspectionApprovals(orgId, jobRoles) {
  // Ensure jobRoles is an array
  const roles = Array.isArray(jobRoles) ? jobRoles : [jobRoles];
  
  if (roles.length === 0) return [];

  const query = `
    SELECT 
      d.wfaiisd_id,
      d.wfaiish_id,
      d.sequence as wf_level,
      d.job_role_id,
      d.status,
      d.changed_on as approval_date,
      d.changed_by as approved_by,
      
      h.asset_id,
      h.aatif_id,
      h.pl_sch_date,
      h.status as header_status,
      h.created_on as header_created_at,
      
      a.asset_type_id,
      a.asset_id as asset_code,
      a.serial_number,
      
      ast.text as asset_type_name,
      
      jr.text as job_role_name,
      
      b.text as branch_name
      
    FROM "tblWFAATInspSch_D" d
    INNER JOIN "tblWFAATInspSch_H" h ON d.wfaiish_id = h.wfaiish_id
    INNER JOIN "tblAssets" a ON h.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" ast ON a.asset_type_id = ast.asset_type_id
    INNER JOIN "tblJobRoles" jr ON d.job_role_id = jr.job_role_id
    LEFT JOIN "tblBranches" b ON h.branch_code = b.branch_code
    
    WHERE d.org_id = $1
      AND d.job_role_id = ANY($2::text[])
      AND UPPER(d.status) = 'AP'
      AND h.org_id = $1
    
    ORDER BY h.pl_sch_date ASC, d.sequence ASC;
  `;
  
  const values = [orgId, roles];
  
  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error getting pending inspection approvals:', error);
    throw error;
  }
}

/**
 * Get detailed information about a specific inspection approval
 * Includes asset details, checklist, workflow steps, and current approval status
 * @param {string} orgId - Organization ID
 * @param {string} inspSchHId - Inspection schedule header ID (wfaiish_id)
 * @returns {Object} Detailed inspection information
 */
async function getInspectionApprovalDetail(orgId, inspSchHId) {
  // Get header and asset information
  const headerQuery = `
    SELECT 
      h.wfaiish_id,
      h.aatif_id,
      h.asset_id,
      h.pl_sch_date,
      h.status,
      h.created_by,
      h.created_on,
      h.branch_code,
      h.emp_int_id,
      
      a.asset_type_id,
      a.asset_id as asset_code,
      a.serial_number,
      a.purchased_on,
      a.purchase_vendor_id,
      a.service_vendor_id,
      h.vendor_id,
      
      ast.text as asset_type_name,
      ast.asset_type_id,
      
      aif.freq as inspection_frequency,
      aif.uom as inspection_uom,
      COALESCE(uom.UOM, aif.uom) as inspection_uom_text,
      aif.maintained_by,

      b.text as branch_name,

      -- Vendor details (prefer header.vendor_id, fallback to asset.service_vendor_id)
      v.vendor_id as vendor_id,
      v.vendor_name as vendor_name,
      v.contact_person_name as vendor_contact_person,
      v.contact_person_email as vendor_contact_email,
      v.contact_person_number as vendor_contact_number,
      v.company_email as vendor_company_email,
      v.address_line1 as vendor_address_line1,
      v.contract_start_date as vendor_contract_start_date,
      v.contract_end_date as vendor_contract_end_date
      
    FROM "tblWFAATInspSch_H" h
    INNER JOIN "tblAssets" a ON h.asset_id = a.asset_id
    LEFT JOIN "tblVendors" v ON v.vendor_id = COALESCE(h.vendor_id, a.service_vendor_id)
    INNER JOIN "tblAssetTypes" ast ON a.asset_type_id = ast.asset_type_id
    LEFT JOIN "tblAAT_Insp_Freq" aif ON h.aatif_id = aif.aatif_id
    LEFT JOIN "tblUom" uom ON (uom.UOM_id::text = aif.uom::text OR uom.UOM = aif.uom)
    LEFT JOIN "tblBranches" b ON h.branch_code = b.branch_code
    
    WHERE h.org_id = $1
      AND h.wfaiish_id = $2;
  `;
  
  // Get all workflow detail records (approval levels)
  const detailQuery = `
    SELECT 
      d.wfaiisd_id,
      d.wfaiish_id,
      d.sequence as wf_level,
      d.job_role_id,
      d.status,
      d.changed_on as approval_date,
      d.changed_by as approved_by,
      d.created_on,
      
      jr.text as job_role_name,
      
      e.full_name as approved_by_name,
      e.email_id as approved_by_email
      
    FROM "tblWFAATInspSch_D" d
    INNER JOIN "tblJobRoles" jr ON d.job_role_id = jr.job_role_id
    LEFT JOIN "tblEmployees" e ON d.changed_by = e.emp_int_id
    
    WHERE d.org_id = $1
      AND d.wfaiish_id = $2
    
    ORDER BY d.sequence ASC;
  `;
  
  // Get workflow sequence configuration (from tblWFATInspSeqs)
  // NOTE: This table may not exist in all environments, so we handle it gracefully
  const workflowQuery = `
    SELECT 
      ws.wf_steps_id,
      ws.wf_level as sequence,
      ws.job_role_id,
      
      jr.text as job_role_name
      
    FROM "tblWFATInspSeqs" ws
    INNER JOIN "tblJobRoles" jr ON ws.job_role_id = jr.job_role_id
    
    WHERE ws.org_id = $1
      AND ws.at_id IN (
        SELECT a.asset_type_id 
        FROM "tblWFAATInspSch_H" h
        INNER JOIN "tblAssets" a ON h.asset_id = a.asset_id
        WHERE h.wfaiish_id = $2
      )
    
    ORDER BY ws.wf_level ASC;
  `;
  
  try {
    // Execute only header and detail queries for now (workflow query causing issues)
    const [headerResult, detailResult] = await Promise.all([
      pool.query(headerQuery, [orgId, inspSchHId]),
      pool.query(detailQuery, [orgId, inspSchHId])
    ]);
    
    if (headerResult.rows.length === 0) {
      return null;
    }
    
    return {
      header: headerResult.rows[0],
      approvalLevels: detailResult.rows,
      workflowConfiguration: [] // Empty for now to avoid table issues
    };
  } catch (error) {
    console.error('Error getting inspection approval detail:', error);
    throw error;
  }
}

/**
 * Get approval workflow history for a specific inspection
 * @param {string} orgId - Organization ID
 * @param {string} inspSchHId - Inspection schedule header ID (wfaiish_id)
 * @returns {Array} History records
 */
async function getInspectionWorkflowHistory(orgId, inspSchHId) {
  const query = `
    SELECT 
      h.wfaiishis_id as wfaihis_id,
      h.wfaiish_id,
      h.action,
      h.action_by,
      h.action_on,
      h.notes,
      
      e.full_name as action_by_name,
      e.email_id as action_by_email,
      e.employee_id as emp_code,
      
      d.sequence as wf_level,
      d.job_role_id,
      jr.text as job_role_name,
      
      CASE 
        WHEN h.action IN ('AP', 'UA') THEN 'Approved'
        WHEN h.action IN ('RE', 'UR') THEN 'Rejected'
        WHEN h.action = 'CR' THEN 'Created'
        ELSE h.action
      END as action_display
      
    FROM "tblWFAATInspHist" h
    LEFT JOIN "tblEmployees" e ON h.action_by = e.emp_int_id
    LEFT JOIN "tblWFAATInspSch_D" d ON h.wfaiisd_id = d.wfaiisd_id
    LEFT JOIN "tblJobRoles" jr ON d.job_role_id = jr.job_role_id
    
    WHERE h.org_id = $1
      AND h.wfaiish_id = $2
    
    ORDER BY h.action_on DESC;
  `;
  
  const values = [orgId, inspSchHId];
  
  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error getting inspection workflow history:', error);
    throw error;
  }
}

/**
 * Get all inspections (for a specific status or all)
 * Used for listing/searching inspections
 * @param {string} orgId - Organization ID
 * @param {string} branchCode - Branch code
 * @param {string} status - Optional status filter (IN, AP, CO, etc.)
 * @returns {Array} List of inspections
 */
async function getInspectionsByStatus(orgId, branchCode, status = null) {
  let query = `
    SELECT 
      h.wfaiish_id,
      h.aatif_id,
      h.asset_id,
      h.pl_sch_date,
      h.status,
      h.created_on,
      
      a.asset_type_id,
      a.asset_id as asset_code,
      a.serial_number,
      
      ast.text as asset_type_name,
      
      COUNT(d.wfaiisd_id) as total_approval_levels,
      SUM(CASE WHEN d.status = 'UA' THEN 1 ELSE 0 END) as approved_levels,
      SUM(CASE WHEN d.status = 'AP' THEN 1 ELSE 0 END) as pending_levels,
      SUM(CASE WHEN d.status = 'UR' THEN 1 ELSE 0 END) as rejected_levels
      
    FROM "tblWFAATInspSch_H" h
    INNER JOIN "tblAssets" a ON h.asset_id = a.asset_id
    INNER JOIN "tblAssetTypes" ast ON a.asset_type_id = ast.asset_type_id
    LEFT JOIN "tblWFAATInspSch_D" d ON h.wfaiish_id = d.wfaiish_id
    
    WHERE h.org_id = $1
      AND h.branch_code = $2
  `;
  
  const values = [orgId, branchCode];
  
  if (status) {
    query += ` AND UPPER(h.status) = $3`;
    values.push(status.toUpperCase());
  }
  
  query += `
    GROUP BY 
      h.wfaiish_id,
      h.aatif_id,
      h.asset_id,
      h.pl_sch_date,
      h.status,
      h.created_on,
      a.asset_type_id,
      a.asset_id,
      a.serial_number,
      ast.text
    
    ORDER BY h.pl_sch_date DESC;
  `;
  
  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error getting inspections by status:', error);
    throw error;
  }
}

// CHUNK 2.2: APPROVAL ACTIONS (WRITE OPERATIONS)

/**
 * Get a specific workflow step by ID
 * @param {string} orgId 
 * @param {string} wfaiisdId 
 */
async function getWorkflowStepById(orgId, wfaiisdId) {
  const query = `
    SELECT * FROM "tblWFAATInspSch_D"
    WHERE org_id = $1 AND wfaiisd_id = $2
  `;
  const result = await pool.query(query, [orgId, wfaiisdId]);
  return result.rows[0];
}

/**
 * Update the status of a specific workflow step
 * @param {string} orgId 
 * @param {string} wfaiisdId 
 * @param {string} status 
 * @param {string} userId - ID of the user performing the action
 * @param {string} notes - Optional notes/comments
 */
async function updateWorkflowStepStatus(orgId, wfaiisdId, status, userId, notes = '') {
  const query = `
    UPDATE "tblWFAATInspSch_D"
    SET 
      status = $3,
      changed_by = $4,
      changed_on = NOW(),
      notes = $5
    WHERE org_id = $1 AND wfaiisd_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [orgId, wfaiisdId, status, userId, notes]);
  return result.rows[0];
}

/**
 * Update the status of the inspection header
 * @param {string} orgId 
 * @param {string} wfaiishId 
 * @param {string} status 
 * @param {string} userId
 */
async function updateHeaderStatus(orgId, wfaiishId, status, userId) {
  const query = `
    UPDATE "tblWFAATInspSch_H"
    SET 
      status = $3,
      changed_by = $4,
      changed_on = NOW()
    WHERE org_id = $1 AND wfaiish_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [orgId, wfaiishId, status, userId]);
  return result.rows[0];
}

/**
 * Get the next workflow step in the sequence
 * @param {string} orgId 
 * @param {string} wfaiishId 
 * @param {number} currentSequence 
 */
async function getNextWorkflowStep(orgId, wfaiishId, currentSequence) {
  const query = `
    SELECT * FROM "tblWFAATInspSch_D"
    WHERE org_id = $1 
      AND wfaiish_id = $2 
      AND sequence > $3
    ORDER BY sequence ASC
    LIMIT 1
  `;
  const result = await pool.query(query, [orgId, wfaiishId, currentSequence]);
  return result.rows[0];
}

/**
 * Record history of workflow action
 * Uses custom ID generation: WFAIHIS_XX
 * @param {object} historyData 
 */
async function createWorkflowHistory(historyData) {
  try {
    // Generate new ID based on max existing ID (similar to Asset Maintenance History)
    // Extract number from WFAIHIS_XX
    const historyIdQuery = `SELECT MAX(CAST(SUBSTRING(wfaiishis_id FROM 9) AS INTEGER)) as max_num FROM "tblWFAATInspHist"`;
    const historyIdResult = await pool.query(historyIdQuery);
    const nextHistoryId = (historyIdResult.rows[0].max_num || 0) + 1;
    const wfaihisId = `WFAIHIS_${nextHistoryId.toString().padStart(2, '0')}`;
    
    const query = `
      INSERT INTO "tblWFAATInspHist" (
        wfaiishis_id,
        wfaiish_id,
        wfaiisd_id,
        action,
        action_by,
        action_on,
        notes,
        org_id
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      RETURNING *
    `;
    
    // Use the generated ID instead of passed one
    return await pool.query(query, [
      wfaihisId,
      historyData.wfaiish_id,
      historyData.wfaiisd_id,
      historyData.action,
      historyData.action_by,
      historyData.notes,
      historyData.org_id
    ]);
  } catch (error) {
    console.error('Error creating workflow history:', error);
    throw error;
  }
}

/**
 * Get the previous approved workflow step (for rejection pushback)
 * @param {string} orgId 
 * @param {string} wfaiishId 
 * @param {number} currentSequence 
 */
async function getPreviousApprovedValues(orgId, wfaiishId, currentSequence) {
  const query = `
    SELECT * FROM "tblWFAATInspSch_D"
    WHERE org_id = $1 
      AND wfaiish_id = $2 
      AND sequence < $3
      AND status = 'UA'
    ORDER BY sequence DESC
    LIMIT 1
  `;
  const result = await pool.query(query, [orgId, wfaiishId, currentSequence]);
  return result.rows[0];
}

/**
 * Update inspection header details (e.g. planned date)
 * @param {string} orgId 
 * @param {string} wfaiishId 
 * @param {Object} updates - Fields to update (e.g. { pl_sch_date })
 * @param {string} userId
 */
async function updateHeaderDetails(orgId, wfaiishId, updates, userId) {
  const { pl_sch_date, vendorId, technicianId } = updates;
  // Build dynamic SET clause
  const sets = [];
  const values = [orgId, wfaiishId];
  let idx = 3;

  if (pl_sch_date) {
    sets.push(`pl_sch_date = $${idx}`);
    values.push(pl_sch_date);
    idx++;
  }

  if (vendorId) {
    sets.push(`vendor_id = $${idx}`);
    values.push(vendorId);
    idx++;
  }

  if (technicianId) {
    sets.push(`emp_int_id = $${idx}`);
    values.push(technicianId);
    idx++;
  }

  if (sets.length === 0) return null; // Nothing to update

  // Always update changed_by and changed_on
  sets.push(`changed_by = $${idx}`);
  values.push(userId);
  idx++;

  const query = `
    UPDATE "tblWFAATInspSch_H"
    SET 
      ${sets.join(',\n      ')},
      changed_on = NOW()
    WHERE org_id = $1 AND wfaiish_id = $2
    RETURNING *
  `;

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating header details:', error);
    return null;
  }
}

/**
 * Create a completed inspection record in master table after workflow approval
 * @param {string} orgId 
 * @param {string} wfaiishId 
 * @param {string} userId - User completing the workflow
 */
async function createCompletedInspectionRecord(orgId, wfaiishId, userId, technicianId = null) {
  try {
    // 1. Get workflow header details along with branch_id
    const headerQuery = `
      SELECT h.*, b.branch_id
      FROM "tblWFAATInspSch_H" h
      LEFT JOIN "tblBranches" b ON h.branch_code = b.branch_code
      WHERE h.org_id = $1 AND h.wfaiish_id = $2
    `;
    const headerResult = await pool.query(headerQuery, [orgId, wfaiishId]);
    
    if (headerResult.rows.length === 0) {
      throw new Error(`Inspection header not found: ${wfaiishId}`);
    }
    
    const header = headerResult.rows[0];
    
    // Use technicianId if provided (from vendor selection), otherwise use emp_int_id from header (inhouse)
    const finalTechnicianId = technicianId || header.emp_int_id;

    // Determine maintained_by for this frequency; if vendor-maintained, do not persist emp_int_id
    let empIntToSave = finalTechnicianId;
    try {
      if (header.aatif_id) {
        const aifRes = await pool.query('SELECT maintained_by FROM "tblAAT_Insp_Freq" WHERE aatif_id = $1 LIMIT 1', [header.aatif_id]);
        const maintainedBy = aifRes.rows.length ? (aifRes.rows[0].maintained_by || '') : '';
        if (String(maintainedBy).toLowerCase() === 'vendor') {
          empIntToSave = null;
        }
      } else if (header.vendor_id) {
        // Fallback: if vendor_id present and no frequency, treat as vendor
        empIntToSave = null;
      }
    } catch (err) {
      empIntToSave = finalTechnicianId;
    }
    
    // 2. Generate new AIS ID (e.g. AIS_001)
    const idQuery = `SELECT MAX(CAST(SUBSTRING(ais_id FROM 5) AS INTEGER)) as max_num FROM "tblAAT_Insp_Sch"`;
    const idResult = await pool.query(idQuery);
    const nextNum = (idResult.rows[0].max_num || 0) + 1;
    const aisId = `AIS_${nextNum.toString().padStart(3, '0')}`;
    
    // 3. Insert into tblAAT_Insp_Sch
    const insertQuery = `
      INSERT INTO "tblAAT_Insp_Sch" (
        ais_id,
        wfaiish_id,
        asset_id,
        vendor_id,
        aatif_id,
        inspected_by,
        emp_int_id,
        status,
        act_insp_st_date,
        act_insp_end_date,
        created_by,
        created_on,
        changed_by,
        changed_on,
        org_id,
        branch_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'IN', $8, NOW(), 
        $9, NOW(), $10, NOW(), $11, $12
      )
      RETURNING *
    `;

    const values = [
      aisId,
      header.wfaiish_id,
      header.asset_id,
      header.vendor_id,
      header.aatif_id,
      finalTechnicianId, // inspected_by - either selected technician or emp_int_id from header
      empIntToSave, // emp_int_id - do not store for vendor-maintained inspections
      header.pl_sch_date || new Date(), // act_insp_st_date
      header.created_by, // created_by (original creator)
      userId, // changed_by (approver)
      orgId,
      header.branch_code
    ];
    
    const result = await pool.query(insertQuery, values);
    return result.rows[0];
    
  } catch (error) {
    console.error('Error creating completed inspection record:', error);
    // Don't throw to prevent rollback of workflow update (make it resilient)
    // Actually, throwing ensures consistency. Let's throw.
    throw error;
  }
}

/**
 * Get certified technicians for a specific asset type
 * @param {string} orgId - Organization ID
 * @param {string} assetTypeId - Asset Type ID
 * @returns {Array} List of certified technicians
 */
async function getCertifiedTechnicians(orgId, assetTypeId) {
  const query = `
    SELECT DISTINCT
      e.emp_int_id,
      e.full_name,
      e.email_id,
      e.phone_number,
      tc.tc_id,
      tc.certificate_name as cert_name,
      tc.certificate_no as cert_number
    FROM "tblATInspCerts" atic
    INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
    INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
    INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
    INNER JOIN "tblAATInspCheckList" aatic ON atic.aatic_id = aatic.aatic_id
    WHERE aatic.at_id = $1
      AND e.org_id = $2
      AND e.int_status = 1
      AND (etc.status IS NULL OR etc.status IN ('Approved','Confirmed'))
    ORDER BY e.full_name;
  `;
  
  try {
    const result = await pool.query(query, [assetTypeId, orgId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching certified technicians:', error);
    throw error;
  }
}

/**
 * Get asset types that have at least one certified technician (approved/confirmed cert for that asset type).
 * Used to know "for which asset type the technicians are available".
 */
async function getAssetTypesWithCertifiedTechnicians(orgId) {
  const query = `
    SELECT
      aat.at_id AS asset_type_id,
      at.text AS asset_type_name,
      COUNT(DISTINCT etc.emp_int_id) AS certified_technician_count
    FROM "tblATInspCerts" atic
    INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
    INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
    INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id AND e.org_id = $1 AND e.int_status = 1
    INNER JOIN "tblAATInspCheckList" aat ON atic.aatic_id = aat.aatic_id
    LEFT JOIN "tblAssetTypes" at ON aat.at_id = at.asset_type_id
    WHERE (etc.status IS NULL OR etc.status IN ('Approved','Confirmed'))
    GROUP BY aat.at_id, at.text
    ORDER BY at.text, aat.at_id;
  `;
  try {
    const result = await pool.query(query, [orgId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching asset types with certified technicians:', error);
    throw error;
  }
}

/**
 * Get technician details by emp_int_id from workflow header
 */
async function getTechnicianFromWorkflowHeader(orgId, empIntId) {
  const query = `
    SELECT 
      e.emp_int_id,
      e.full_name,
      e.email_id,
      e.phone_number
    FROM "tblEmployees" e
    WHERE e.emp_int_id = $1
      AND e.org_id = $2
      AND e.int_status = 1;
  `;
  
  try {
    const result = await pool.query(query, [empIntId, orgId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching technician from workflow header:', error);
    throw error;
  }
}

module.exports = {
  getPendingInspectionApprovals,
  getInspectionApprovalDetail,
  getInspectionWorkflowHistory,
  getInspectionsByStatus,
  getWorkflowStepById,
  updateWorkflowStepStatus,
  updateHeaderStatus,
  updateHeaderDetails,
  getNextWorkflowStep,
  createWorkflowHistory,
  getPreviousApprovedValues,
  createCompletedInspectionRecord,
  getCertifiedTechnicians,
  getAssetTypesWithCertifiedTechnicians,
  getTechnicianFromWorkflowHeader
};
