const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get all workflow steps
const getAllWorkflowSteps = async (org_id) => {
    const query = `
        SELECT 
            wf_steps_id,
            org_id,
            text
        FROM "tblWFSteps"
        WHERE org_id = $1
        ORDER BY text
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [org_id]);
};

// Create workflow step
const createWorkflowStep = async (org_id, text, created_by) => {
    const wf_steps_id = await generateCustomId('wfs', 3);
    
    const query = `
        INSERT INTO "tblWFSteps" (
            wf_steps_id,
            org_id,
            text
        ) VALUES ($1, $2, $3)
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id, org_id, text]);
};

// Update workflow step
const updateWorkflowStep = async (wf_steps_id, text) => {
    const query = `
        UPDATE "tblWFSteps"
        SET text = $1
        WHERE wf_steps_id = $2
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [text, wf_steps_id]);
};

// Delete workflow step
const deleteWorkflowStep = async (wf_steps_id) => {
    const query = `
        DELETE FROM "tblWFSteps"
        WHERE wf_steps_id = $1
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id]);
};

// Get workflow sequences for asset type
const getWorkflowSequencesByAssetType = async (asset_type_id, org_id) => {
    const query = `
        SELECT 
            wfas.wf_at_seqs_id,
            wfas.asset_type_id,
            wfas.wf_steps_id,
            wfas.seqs_no,
            wfas.org_id,
            ws.text as step_text
        FROM "tblWFATSeqs" wfas
        LEFT JOIN "tblWFSteps" ws ON wfas.wf_steps_id = ws.wf_steps_id
        WHERE wfas.asset_type_id = $1 AND wfas.org_id = $2
        ORDER BY CAST(wfas.seqs_no AS INTEGER)
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [asset_type_id, org_id]);
};

// Check if sequence already exists for asset type
const checkSequenceExists = async (asset_type_id, seqs_no, org_id, exclude_wf_at_seqs_id = null) => {
    let query = `
        SELECT wf_at_seqs_id
        FROM "tblWFATSeqs"
        WHERE asset_type_id = $1 AND seqs_no = $2 AND org_id = $3
    `;
    const params = [asset_type_id, seqs_no, org_id];
    
    if (exclude_wf_at_seqs_id) {
        query += ` AND wf_at_seqs_id != $4`;
        params.push(exclude_wf_at_seqs_id);
    }
    
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows.length > 0;
};

// Create workflow sequence
const createWorkflowSequence = async (asset_type_id, wf_steps_id, seqs_no, org_id) => {
    const wf_at_seqs_id = await generateCustomId('wfas', 3);
    
    const query = `
        INSERT INTO "tblWFATSeqs" (
            wf_at_seqs_id,
            asset_type_id,
            wf_steps_id,
            seqs_no,
            org_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id]);
};

// Update workflow sequence
const updateWorkflowSequence = async (wf_at_seqs_id, wf_steps_id, seqs_no, asset_type_id, org_id) => {
    const query = `
        UPDATE "tblWFATSeqs"
        SET 
            wf_steps_id = $1,
            seqs_no = $2
        WHERE wf_at_seqs_id = $3 AND asset_type_id = $4 AND org_id = $5
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id, seqs_no, wf_at_seqs_id, asset_type_id, org_id]);
};

// Delete workflow sequence
const deleteWorkflowSequence = async (wf_at_seqs_id) => {
    const query = `
        DELETE FROM "tblWFATSeqs"
        WHERE wf_at_seqs_id = $1
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_at_seqs_id]);
};

// Get job roles for workflow step
const getJobRolesByWorkflowStep = async (wf_steps_id, org_id) => {
    const query = `
        SELECT 
            wfjr.wf_job_role_id,
            wfjr.wf_steps_id,
            wfjr.job_role_id,
            wfjr.emp_int_id,
            wfjr.dept_id,
            wfjr.org_id,
            jr.text as job_role_name,
            d.text as department_name,
            e.full_name as employee_name
        FROM "tblWFJobRole" wfjr
        LEFT JOIN "tblJobRoles" jr ON wfjr.job_role_id = jr.job_role_id
        LEFT JOIN "tblDepartments" d ON wfjr.dept_id = d.dept_id
        LEFT JOIN "tblEmployees" e ON wfjr.emp_int_id = e.emp_int_id
        WHERE wfjr.wf_steps_id = $1 AND wfjr.org_id = $2
        ORDER BY wfjr.wf_job_role_id
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id, org_id]);
};

// Check if job role already assigned to workflow step
const checkJobRoleExists = async (wf_steps_id, job_role_id, org_id, exclude_wf_job_role_id = null) => {
    let query = `
        SELECT wf_job_role_id
        FROM "tblWFJobRole"
        WHERE wf_steps_id = $1 AND job_role_id = $2 AND org_id = $3
    `;
    const params = [wf_steps_id, job_role_id, org_id];
    
    if (exclude_wf_job_role_id) {
        query += ` AND wf_job_role_id != $4`;
        params.push(exclude_wf_job_role_id);
    }
    
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows.length > 0;
};

// Create workflow job role
const createWorkflowJobRole = async (wf_steps_id, job_role_id, emp_int_id, dept_id, org_id) => {
    const wf_job_role_id = await generateCustomId('wfjr', 3);
    
    const query = `
        INSERT INTO "tblWFJobRole" (
            wf_job_role_id,
            wf_steps_id,
            job_role_id,
            emp_int_id,
            dept_id,
            org_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_job_role_id, wf_steps_id, job_role_id, emp_int_id, dept_id, org_id]);
};

// Update workflow job role
const updateWorkflowJobRole = async (wf_job_role_id, job_role_id, emp_int_id, dept_id) => {
    const query = `
        UPDATE "tblWFJobRole"
        SET 
            job_role_id = $1,
            emp_int_id = $2,
            dept_id = $3
        WHERE wf_job_role_id = $4
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [job_role_id, emp_int_id, dept_id, wf_job_role_id]);
};

// Delete workflow job role
const deleteWorkflowJobRole = async (wf_job_role_id) => {
    const query = `
        DELETE FROM "tblWFJobRole"
        WHERE wf_job_role_id = $1
        RETURNING *
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_job_role_id]);
};

// Delete all job roles for a workflow step
const deleteJobRolesByWorkflowStep = async (wf_steps_id) => {
    const query = `
        DELETE FROM "tblWFJobRole"
        WHERE wf_steps_id = $1
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id]);
};

// Delete all sequences for a workflow step
const deleteSequencesByWorkflowStep = async (wf_steps_id) => {
    const query = `
        DELETE FROM "tblWFATSeqs"
        WHERE wf_steps_id = $1
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [wf_steps_id]);
};

module.exports = {
    getAllWorkflowSteps,
    createWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    getWorkflowSequencesByAssetType,
    checkSequenceExists,
    createWorkflowSequence,
    updateWorkflowSequence,
    deleteWorkflowSequence,
    getJobRolesByWorkflowStep,
    checkJobRoleExists,
    createWorkflowJobRole,
    updateWorkflowJobRole,
    deleteWorkflowJobRole,
    deleteJobRolesByWorkflowStep,
    deleteSequencesByWorkflowStep
};

