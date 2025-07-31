const db = require('../config/db');

// 1. Get asset types that require maintenance
const getAssetTypesRequiringMaintenance = async () => {
    const query = `
        SELECT asset_type_id, text, maint_required
        FROM "tblAssetTypes"
        WHERE maint_required = true AND int_status = 1
        ORDER BY asset_type_id
    `;
    
    return await db.query(query);
};

// 2. Get assets for a specific asset type
const getAssetsByAssetType = async (asset_type_id) => {
    const query = `
        SELECT 
            a.asset_id,
            a.asset_type_id,
            a.purchased_on,
            a.service_vendor_id,
            a.org_id,
            a.text as asset_name
        FROM "tblAssets" a
        WHERE a.asset_type_id = $1
        ORDER BY a.asset_id
    `;
    
    return await db.query(query, [asset_type_id]);
};

// 3. Get maintenance frequency for asset type
const getMaintenanceFrequency = async (asset_type_id) => {
    const query = `
        SELECT 
            at_main_freq_id,
            asset_type_id,
            maint_type_id,
            frequency,
            uom
        FROM "tblATMaintFreq"
        WHERE asset_type_id = $1
        ORDER BY at_main_freq_id
    `;
    
    return await db.query(query, [asset_type_id]);
};

// 4. Check existing maintenance schedules for an asset
const checkExistingMaintenanceSchedules = async (asset_id) => {
    const query = `
        SELECT 
            ams_id,
            asset_id,
            status,
            act_maint_st_date
        FROM "tblAssetMaintSch"
        WHERE asset_id = $1
        ORDER BY created_on DESC
    `;
    
    return await db.query(query, [asset_id]);
};

// 5. Check existing workflow maintenance schedules for an asset
const checkExistingWorkflowMaintenanceSchedules = async (asset_id) => {
    const query = `
        SELECT 
            wfamsh_id,
            asset_id,
            status,
            act_sch_date
        FROM "tblWFAssetMaintSch_H"
        WHERE asset_id = $1
        ORDER BY created_on DESC
    `;
    
    return await db.query(query, [asset_id]);
};

// 6. Get workflow asset sequences for asset type
const getWorkflowAssetSequences = async (asset_type_id) => {
    const query = `
        SELECT 
            wf_at_seqs_id,
            asset_type_id,
            wf_steps_id,
            seqs_no,
            org_id
        FROM "tblWFATSeqs"
        WHERE asset_type_id = $1
        ORDER BY seqs_no
    `;
    
    return await db.query(query, [asset_type_id]);
};

// 7. Get workflow job roles for workflow step
const getWorkflowJobRoles = async (wf_steps_id) => {
    const query = `
        SELECT 
            wf_job_role_id,
            wf_steps_id,
            job_role_id,
            dept_id
        FROM "tblWFJobRole"
        WHERE wf_steps_id = $1
        ORDER BY wf_job_role_id
    `;
    
    return await db.query(query, [wf_steps_id]);
};

// 8. Generate next WFAMSH_ID
const getNextWFAMSHId = async () => {
    const query = `
        SELECT "wfamsh_id" 
        FROM "tblWFAssetMaintSch_H" 
        ORDER BY CAST(SUBSTRING("wfamsh_id" FROM '\\d+$') AS INTEGER) DESC 
        LIMIT 1
    `;
    
    const result = await db.query(query);
    
    if (result.rows.length === 0) {
        return 'WFAMSH_01';
    }
    
    const lastId = result.rows[0].wfamsh_id;
    const match = lastId.match(/\d+/);
    if (match) {
        const nextNum = parseInt(match[0]) + 1;
        return `WFAMSH_${String(nextNum).padStart(2, '0')}`;
    }
    
    return 'WFAMSH_01';
};

// 9. Generate next WFAMSD_ID
const getNextWFAMSDId = async () => {
    const query = `
        SELECT wfamsd_id 
        FROM "tblWFAssetMaintSch_D" 
        ORDER BY CAST(SUBSTRING(wfamsd_id FROM '\\d+$') AS INTEGER) DESC 
        LIMIT 1
    `;
    
    const result = await db.query(query);
    
    if (result.rows.length === 0) {
        return 'WFAMSD_01';
    }
    
    const lastId = result.rows[0].wfamsd_id;
    const match = lastId.match(/\d+/);
    if (match) {
        const nextNum = parseInt(match[0]) + 1;
        return `WFAMSD_${String(nextNum).padStart(2, '0')}`;
    }
    
    return 'WFAMSD_01';
};

// 10. Insert workflow maintenance schedule header
const insertWorkflowMaintenanceScheduleHeader = async (scheduleData) => {
    const {
        wfamsh_id,
        at_main_freq_id,
        maint_type_id,
        asset_id,
        group_id,
        vendor_id,
        pl_sch_date,
        act_sch_date,
        status,
        created_by,
        org_id
    } = scheduleData;
    
    const query = `
        INSERT INTO "tblWFAssetMaintSch_H" (
            "wfamsh_id",
            at_main_freq_id,
            maint_type_id,
            asset_id,
            group_id,
            vendor_id,
            pl_sch_date,
            act_sch_date,
            status,
            created_by,
            created_on,
            changed_by,
            changed_on,
            org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, NULL, NULL, $11)
        RETURNING *
    `;
    
    const values = [
        wfamsh_id,
        at_main_freq_id,
        maint_type_id,
        asset_id,
        group_id,
        vendor_id,
        pl_sch_date,
        act_sch_date,
        status,
        created_by,
        org_id
    ];
    
    return await db.query(query, values);
};

// 11. Insert workflow maintenance schedule detail
const insertWorkflowMaintenanceScheduleDetail = async (detailData) => {
    const {
        wfamsd_id,
        wfamsh_id,
        job_role_id,
        user_id,
        dept_id,
        sequence,
        status,
        notes,
        created_by,
        org_id
    } = detailData;
    
    const query = `
        INSERT INTO "tblWFAssetMaintSch_D" (
            wfamsd_id,
            wfamsh_id,
            job_role_id,
            user_id,
            dept_id,
            sequence,
            status,
            notes,
            created_by,
            created_on,
            changed_by,
            changed_on,
            org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, NULL, NULL, $10)
        RETURNING *
    `;
    
    const values = [
        wfamsd_id,
        wfamsh_id,
        job_role_id,
        user_id,
        dept_id,
        sequence,
        status,
        notes,
        created_by,
        org_id
    ];
    
    return await db.query(query, values);
};

// 12. Calculate planned schedule date based on frequency and UOM
const calculatePlannedScheduleDate = (purchasedDate, frequency, uom) => {
    const date = new Date(purchasedDate);
    
    switch (uom.toLowerCase()) {
        case 'days':
            date.setDate(date.getDate() + frequency);
            break;
        case 'weeks':
            date.setDate(date.getDate() + (frequency * 7));
            break;
        case 'months':
            date.setMonth(date.getMonth() + frequency);
            break;
        case 'years':
            date.setFullYear(date.getFullYear() + frequency);
            break;
        default:
            // Default to days
            date.setDate(date.getDate() + frequency);
    }
    
    return date;
};

// 13. Check if maintenance is due
const isMaintenanceDue = (lastMaintenanceDate, frequency, uom) => {
    const today = new Date();
    const nextMaintenanceDate = calculatePlannedScheduleDate(lastMaintenanceDate, frequency, uom);
    
    return today >= nextMaintenanceDate;
};

module.exports = {
    getAssetTypesRequiringMaintenance,
    getAssetsByAssetType,
    getMaintenanceFrequency,
    checkExistingMaintenanceSchedules,
    checkExistingWorkflowMaintenanceSchedules,
    getWorkflowAssetSequences,
    getWorkflowJobRoles,
    getNextWFAMSHId,
    getNextWFAMSDId,
    insertWorkflowMaintenanceScheduleHeader,
    insertWorkflowMaintenanceScheduleDetail,
    calculatePlannedScheduleDate,
    isMaintenanceDue
}; 