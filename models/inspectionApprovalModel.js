const pool = require('../config/db');

const pickColumn = (columnMap, candidates) => {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (columnMap[key]) return columnMap[key];
  }
  return null;
};

const getTableColumns = async (tableName) => {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  return result.rows.reduce((acc, row) => {
    acc[row.column_name.toLowerCase()] = row.column_name;
    return acc;
  }, {});
};

const qId = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

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
  try {
    const rows = [];
    const addRows = (list) => {
      if (Array.isArray(list) && list.length > 0) rows.push(...list);
    };

    // Newer maintenance certificate mapping path
    try {
      const mapCols = await getTableColumns('tblATMaintCert');
      const empCertCols = await getTableColumns('tblEmpTechCert');
      const empCols = await getTableColumns('tblEmployees');
      const certCols = await getTableColumns('tblTechCert');

      const mapAssetTypeId = pickColumn(mapCols, ['asset_type_id', 'assettype_id']);
      const mapTcId = pickColumn(mapCols, ['tc_id']);
      const mapOrg = pickColumn(mapCols, ['org_id', 'orgid']);

      const empCertEmpId = pickColumn(empCertCols, ['emp_int_id', 'emp_intid', 'employee_int_id']);
      const empCertTcId = pickColumn(empCertCols, ['tc_id']);
      const empCertStatus = pickColumn(empCertCols, ['status']);
      const empCertOrg = pickColumn(empCertCols, ['org_id', 'orgid']);

      const empId = pickColumn(empCols, ['emp_int_id', 'emp_intid', 'employee_int_id']);
      const empName = pickColumn(empCols, ['full_name', 'name']);
      const empEmail = pickColumn(empCols, ['email_id']);
      const empPhone = pickColumn(empCols, ['phone_number']);
      const empOrg = pickColumn(empCols, ['org_id', 'orgid']);
      const empIntStatus = pickColumn(empCols, ['int_status']);

      const certId = pickColumn(certCols, ['tc_id']);
      const certName = pickColumn(certCols, ['certificate_name', 'cert_name']);
      const certNumber = pickColumn(certCols, ['certificate_no', 'cert_number', 'cert_no']);

      if (mapAssetTypeId && mapTcId && empCertEmpId && empCertTcId && empId && empName && certId) {
        const params = [assetTypeId];
        const where = [`atmc.${qId(mapAssetTypeId)} = $1`];

        if (mapOrg) {
          params.push(orgId);
          where.push(`atmc.${qId(mapOrg)} = $${params.length}`);
        }
        if (empCertOrg) {
          params.push(orgId);
          where.push(`etc.${qId(empCertOrg)} = $${params.length}`);
        }
        if (empOrg) {
          params.push(orgId);
          where.push(`e.${qId(empOrg)} = $${params.length}`);
        }
        if (empIntStatus) where.push(`e.${qId(empIntStatus)} = 1`);
        if (empCertStatus) {
          where.push(`(etc.${qId(empCertStatus)} IS NULL OR UPPER(etc.${qId(empCertStatus)}) IN ('APPROVED', 'CONFIRMED'))`);
        }

        const query = `
          SELECT DISTINCT
            e.${qId(empId)} AS emp_int_id,
            e.${qId(empName)} AS full_name,
            ${empEmail ? `e.${qId(empEmail)} AS email_id,` : 'NULL AS email_id,'}
            ${empPhone ? `e.${qId(empPhone)} AS phone_number,` : 'NULL AS phone_number,'}
            atmc.${qId(mapTcId)} AS tc_id,
            ${certName ? `tc.${qId(certName)} AS cert_name,` : 'NULL AS cert_name,'}
            ${certNumber ? `tc.${qId(certNumber)} AS cert_number` : 'NULL AS cert_number'}
          FROM "tblATMaintCert" atmc
          INNER JOIN "tblEmpTechCert" etc ON atmc.${qId(mapTcId)} = etc.${qId(empCertTcId)}
          INNER JOIN "tblEmployees" e ON etc.${qId(empCertEmpId)} = e.${qId(empId)}
          LEFT JOIN "tblTechCert" tc ON atmc.${qId(mapTcId)} = tc.${qId(certId)}
          WHERE ${where.join('\n            AND ')}
        `;
        const result = await pool.query(query, params);
        addRows(result.rows);
      }
    } catch (error) {
      console.warn('Maintenance technician lookup skipped:', error.message);
    }

    // Legacy inspection mapping path (to avoid regression on inspection screens)
    try {
      const legacyQuery = `
        SELECT DISTINCT
          e.emp_int_id,
          e.full_name,
          e.email_id,
          e.phone_number,
          tc.tc_id,
          tc.certificate_name AS cert_name,
          tc.certificate_no AS cert_number
        FROM "tblATInspCerts" atic
        INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
        INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
        INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
        INNER JOIN "tblAATInspCheckList" aatic ON atic.aatic_id = aatic.aatic_id
        WHERE aatic.at_id = $1
          AND e.org_id = $2
          AND e.int_status = 1
          AND (etc.status IS NULL OR UPPER(etc.status) IN ('APPROVED', 'CONFIRMED'))
      `;
      const result = await pool.query(legacyQuery, [assetTypeId, orgId]);
      addRows(result.rows);
    } catch (error) {
      console.warn('Legacy inspection technician lookup skipped:', error.message);
    }

    // Merge duplicates from both paths
    const dedup = new Map();
    for (const row of rows) {
      const key = row.emp_int_id;
      if (!key) continue;
      if (!dedup.has(key)) {
        dedup.set(key, row);
      } else {
        const existing = dedup.get(key);
        dedup.set(key, {
          ...existing,
          email_id: existing.email_id || row.email_id || null,
          phone_number: existing.phone_number || row.phone_number || null,
          tc_id: existing.tc_id || row.tc_id || null,
          cert_name: existing.cert_name || row.cert_name || null,
          cert_number: existing.cert_number || row.cert_number || null
        });
      }
    }

    return Array.from(dedup.values()).sort((a, b) =>
      String(a.full_name || '').localeCompare(String(b.full_name || ''))
    );
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
  try {
    const assetTypeTechSet = new Map();
    const addPair = (assetTypeId, assetTypeName, empIntId) => {
      if (!assetTypeId || !empIntId) return;
      if (!assetTypeTechSet.has(assetTypeId)) {
        assetTypeTechSet.set(assetTypeId, {
          asset_type_id: assetTypeId,
          asset_type_name: assetTypeName || null,
          technicians: new Set()
        });
      }
      const entry = assetTypeTechSet.get(assetTypeId);
      if (!entry.asset_type_name && assetTypeName) entry.asset_type_name = assetTypeName;
      entry.technicians.add(empIntId);
    };

    // Newer maintenance certificate mapping path
    try {
      const mapCols = await getTableColumns('tblATMaintCert');
      const empCertCols = await getTableColumns('tblEmpTechCert');
      const empCols = await getTableColumns('tblEmployees');
      const assetTypeCols = await getTableColumns('tblAssetTypes');

      const mapAssetTypeId = pickColumn(mapCols, ['asset_type_id', 'assettype_id']);
      const mapTcId = pickColumn(mapCols, ['tc_id']);
      const mapOrg = pickColumn(mapCols, ['org_id', 'orgid']);

      const empCertEmpId = pickColumn(empCertCols, ['emp_int_id', 'emp_intid', 'employee_int_id']);
      const empCertTcId = pickColumn(empCertCols, ['tc_id']);
      const empCertStatus = pickColumn(empCertCols, ['status']);
      const empCertOrg = pickColumn(empCertCols, ['org_id', 'orgid']);

      const empId = pickColumn(empCols, ['emp_int_id', 'emp_intid', 'employee_int_id']);
      const empOrg = pickColumn(empCols, ['org_id', 'orgid']);
      const empIntStatus = pickColumn(empCols, ['int_status']);

      const atId = pickColumn(assetTypeCols, ['asset_type_id']);
      const atText = pickColumn(assetTypeCols, ['text']);

      if (mapAssetTypeId && mapTcId && empCertEmpId && empCertTcId && empId && atId) {
        const params = [];
        const where = [];

        if (mapOrg) {
          params.push(orgId);
          where.push(`atmc.${qId(mapOrg)} = $${params.length}`);
        }
        if (empCertOrg) {
          params.push(orgId);
          where.push(`etc.${qId(empCertOrg)} = $${params.length}`);
        }
        if (empOrg) {
          params.push(orgId);
          where.push(`e.${qId(empOrg)} = $${params.length}`);
        }
        if (empIntStatus) where.push(`e.${qId(empIntStatus)} = 1`);
        if (empCertStatus) {
          where.push(`(etc.${qId(empCertStatus)} IS NULL OR UPPER(etc.${qId(empCertStatus)}) IN ('APPROVED', 'CONFIRMED'))`);
        }

        const whereClause = where.length ? `WHERE ${where.join('\n          AND ')}` : '';
        const query = `
          SELECT DISTINCT
            atmc.${qId(mapAssetTypeId)} AS asset_type_id,
            ${atText ? `at.${qId(atText)} AS asset_type_name,` : 'NULL AS asset_type_name,'}
            etc.${qId(empCertEmpId)} AS emp_int_id
          FROM "tblATMaintCert" atmc
          INNER JOIN "tblEmpTechCert" etc ON atmc.${qId(mapTcId)} = etc.${qId(empCertTcId)}
          INNER JOIN "tblEmployees" e ON etc.${qId(empCertEmpId)} = e.${qId(empId)}
          LEFT JOIN "tblAssetTypes" at ON atmc.${qId(mapAssetTypeId)} = at.${qId(atId)}
          ${whereClause}
        `;
        const result = await pool.query(query, params);
        result.rows.forEach((r) => addPair(r.asset_type_id, r.asset_type_name, r.emp_int_id));
      }
    } catch (error) {
      console.warn('Maintenance asset-type technician lookup skipped:', error.message);
    }

    // Legacy inspection mapping path
    try {
      const legacyQuery = `
        SELECT DISTINCT
          aat.at_id AS asset_type_id,
          at.text AS asset_type_name,
          etc.emp_int_id
        FROM "tblATInspCerts" atic
        INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
        INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
        INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
        INNER JOIN "tblAATInspCheckList" aat ON atic.aatic_id = aat.aatic_id
        LEFT JOIN "tblAssetTypes" at ON aat.at_id = at.asset_type_id
        WHERE e.org_id = $1
          AND e.int_status = 1
          AND (etc.status IS NULL OR UPPER(etc.status) IN ('APPROVED', 'CONFIRMED'))
      `;
      const result = await pool.query(legacyQuery, [orgId]);
      result.rows.forEach((r) => addPair(r.asset_type_id, r.asset_type_name, r.emp_int_id));
    } catch (error) {
      console.warn('Legacy inspection asset-type technician lookup skipped:', error.message);
    }

    return Array.from(assetTypeTechSet.values())
      .map((entry) => ({
        asset_type_id: entry.asset_type_id,
        asset_type_name: entry.asset_type_name,
        certified_technician_count: entry.technicians.size
      }))
      .sort((a, b) =>
        String(a.asset_type_name || a.asset_type_id || '').localeCompare(
          String(b.asset_type_name || b.asset_type_id || '')
        )
      );
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
