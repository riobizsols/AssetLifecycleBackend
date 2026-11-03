const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

let wfInspJobRoleDeptNullableEnsured = false;
const ensureWfInspJobRoleDeptNullable = async () => {
    if (wfInspJobRoleDeptNullableEnsured) {
        return;
    }
    const dbPool = getDb();
    const result = await dbPool.query(`
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblWFInspJobRole'
          AND column_name = 'dept_id'
        LIMIT 1
    `);
    if (result.rows.length > 0 && result.rows[0].is_nullable === 'NO') {
        await dbPool.query(`ALTER TABLE "tblWFInspJobRole" ALTER COLUMN dept_id DROP NOT NULL`);
    }
    wfInspJobRoleDeptNullableEnsured = true;
};

let seqSchemaCache = null;
const getSeqSchema = async () => {
    if (seqSchemaCache) {
        return seqSchemaCache;
    }
    const dbPool = getDb();
    const result = await dbPool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tblWFATInspSeqs'
    `);
    const cols = new Set(result.rows.map((r) => r.column_name));
    const idCol = cols.has('wfatis_id')
        ? 'wfatis_id'
        : (cols.has('wf_at_insp_seqs_id') ? 'wf_at_insp_seqs_id' : 'wfatis_id');
    const atCol = cols.has('at_id') ? 'at_id' : 'asset_type_id';
    const stepCol = cols.has('wf_insp_steps_id') ? 'wf_insp_steps_id' : 'wf_steps_id';
    const allowed = new Set(['wfatis_id', 'wf_at_insp_seqs_id', 'at_id', 'asset_type_id', 'wf_insp_steps_id', 'wf_steps_id']);
    if (!allowed.has(idCol) || !allowed.has(atCol) || !allowed.has(stepCol)) {
        throw new Error('Unexpected tblWFATInspSeqs column mapping');
    }
    seqSchemaCache = {
        idCol,
        atCol,
        stepCol,
        hasJobRole: cols.has('job_role_id'),
    };
    return seqSchemaCache;
};

const getAllWorkflowSteps = async (org_id) => {
    const query = `
        SELECT
            wf_insp_steps_id,
            org_id,
            text
        FROM "tblWFInspSteps"
        WHERE org_id = $1
        ORDER BY text
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [org_id]);
};

const createWorkflowStep = async (org_id, text) => {
    const wf_insp_steps_id = await generateCustomId('wfis', 3);
    const query = `
        INSERT INTO "tblWFInspSteps" (
            wf_insp_steps_id,
            org_id,
            text
        ) VALUES ($1, $2, $3)
        RETURNING *
    `;
    const dbPool = getDb();
    return dbPool.query(query, [wf_insp_steps_id, org_id, text]);
};

const updateWorkflowStep = async (wf_insp_steps_id, text) => {
    const query = `
        UPDATE "tblWFInspSteps"
        SET text = $1
        WHERE wf_insp_steps_id = $2
        RETURNING *
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [text, wf_insp_steps_id]);
};

const deleteWorkflowStep = async (wf_insp_steps_id) => {
    const query = `
        DELETE FROM "tblWFInspSteps"
        WHERE wf_insp_steps_id = $1
        RETURNING *
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_steps_id]);
};

const getWorkflowSequencesByAssetType = async (asset_type_id, org_id) => {
    const schema = await getSeqSchema();
    const query = `
        SELECT
            seq."${schema.idCol}" AS wfatis_id,
            seq."${schema.atCol}" AS at_id,
            seq."${schema.stepCol}" AS wf_insp_steps_id,
            seq.seqs_no,
            seq.org_id,
            st.text AS step_text
        FROM "tblWFATInspSeqs" seq
        LEFT JOIN "tblWFInspSteps" st
            ON seq."${schema.stepCol}" = st.wf_insp_steps_id
        WHERE seq."${schema.atCol}" = $1 AND seq.org_id = $2
        ORDER BY CAST(seq.seqs_no AS INTEGER)
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [asset_type_id, org_id]);
};

const checkSequenceExists = async (asset_type_id, seqs_no, org_id, exclude_wfatis_id = null) => {
    const schema = await getSeqSchema();
    let query = `
        SELECT "${schema.idCol}"
        FROM "tblWFATInspSeqs"
        WHERE "${schema.atCol}" = $1 AND seqs_no = $2 AND org_id = $3
    `;
    const params = [asset_type_id, seqs_no, org_id];
    if (exclude_wfatis_id) {
        query += ` AND "${schema.idCol}" != $4`;
        params.push(exclude_wfatis_id);
    }
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows.length > 0;
};

const createWorkflowSequence = async (asset_type_id, wf_insp_steps_id, seqs_no, org_id) => {
    const schema = await getSeqSchema();
    const wfatis_id = await generateCustomId('wfatis', 3);
    const columns = [schema.idCol, schema.atCol, schema.stepCol, 'seqs_no', 'org_id'];
    const values = [wfatis_id, asset_type_id, wf_insp_steps_id, seqs_no, org_id];
    const query = `
        INSERT INTO "tblWFATInspSeqs" (
            ${columns.map((c) => `"${c}"`).join(', ')}
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING
            "${schema.idCol}" AS wfatis_id,
            "${schema.atCol}" AS at_id,
            "${schema.stepCol}" AS wf_insp_steps_id,
            seqs_no,
            org_id
    `;
    const dbPool = getDb();
    return await dbPool.query(query, values);
};

const updateWorkflowSequence = async (wfatis_id, wf_insp_steps_id, seqs_no, asset_type_id, org_id) => {
    const schema = await getSeqSchema();
    const query = `
        UPDATE "tblWFATInspSeqs"
        SET
            "${schema.stepCol}" = $1,
            seqs_no = $2
        WHERE "${schema.idCol}" = $3
          AND "${schema.atCol}" = $4
          AND org_id = $5
        RETURNING
            "${schema.idCol}" AS wfatis_id,
            "${schema.atCol}" AS at_id,
            "${schema.stepCol}" AS wf_insp_steps_id,
            seqs_no,
            org_id
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_steps_id, seqs_no, wfatis_id, asset_type_id, org_id]);
};

const deleteWorkflowSequence = async (wfatis_id) => {
    const schema = await getSeqSchema();
    const query = `
        DELETE FROM "tblWFATInspSeqs"
        WHERE "${schema.idCol}" = $1
        RETURNING "${schema.idCol}" AS wfatis_id
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wfatis_id]);
};

const getJobRolesByWorkflowStep = async (wf_insp_steps_id, org_id) => {
    const query = `
        SELECT
            wfjr.wf_insp_job_role_id,
            wfjr.wf_insp_steps_id,
            wfjr.job_role_id,
            wfjr.emp_int_id,
            wfjr.org_id,
            jr.text AS job_role_name,
            e.full_name AS employee_name
        FROM "tblWFInspJobRole" wfjr
        LEFT JOIN "tblJobRoles" jr ON wfjr.job_role_id = jr.job_role_id
        LEFT JOIN "tblEmployees" e ON wfjr.emp_int_id = e.emp_int_id
        WHERE wfjr.wf_insp_steps_id = $1 AND wfjr.org_id = $2
        ORDER BY wfjr.wf_insp_job_role_id
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_steps_id, org_id]);
};

const checkJobRoleExists = async (wf_insp_steps_id, job_role_id, org_id, exclude_wf_insp_job_role_id = null) => {
    let query = `
        SELECT wf_insp_job_role_id
        FROM "tblWFInspJobRole"
        WHERE wf_insp_steps_id = $1 AND job_role_id = $2 AND org_id = $3
    `;
    const params = [wf_insp_steps_id, job_role_id, org_id];
    if (exclude_wf_insp_job_role_id) {
        query += ` AND wf_insp_job_role_id != $4`;
        params.push(exclude_wf_insp_job_role_id);
    }
    const dbPool = getDb();
    const result = await dbPool.query(query, params);
    return result.rows.length > 0;
};

const createWorkflowJobRole = async (wf_insp_steps_id, job_role_id, emp_int_id, org_id, dept_id = null) => {
    await ensureWfInspJobRoleDeptNullable();
    const wf_insp_job_role_id = await generateCustomId('wfijr', 3);
    const query = `
        INSERT INTO "tblWFInspJobRole" (
            wf_insp_job_role_id,
            wf_insp_steps_id,
            job_role_id,
            emp_int_id,
            dept_id,
            org_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [
        wf_insp_job_role_id,
        wf_insp_steps_id,
        job_role_id,
        emp_int_id,
        dept_id,
        org_id,
    ]);
};

const updateWorkflowJobRole = async (wf_insp_job_role_id, job_role_id, emp_int_id) => {
    const query = `
        UPDATE "tblWFInspJobRole"
        SET
            job_role_id = $1,
            emp_int_id = $2
        WHERE wf_insp_job_role_id = $3
        RETURNING *
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [job_role_id, emp_int_id, wf_insp_job_role_id]);
};

const deleteWorkflowJobRole = async (wf_insp_job_role_id) => {
    const query = `
        DELETE FROM "tblWFInspJobRole"
        WHERE wf_insp_job_role_id = $1
        RETURNING *
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_job_role_id]);
};

const deleteJobRolesByWorkflowStep = async (wf_insp_steps_id) => {
    const query = `
        DELETE FROM "tblWFInspJobRole"
        WHERE wf_insp_steps_id = $1
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_steps_id]);
};

const deleteSequencesByWorkflowStep = async (wf_insp_steps_id) => {
    const schema = await getSeqSchema();
    const query = `
        DELETE FROM "tblWFATInspSeqs"
        WHERE "${schema.stepCol}" = $1
    `;
    const dbPool = getDb();
    return await dbPool.query(query, [wf_insp_steps_id]);
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
    deleteSequencesByWorkflowStep,
};
