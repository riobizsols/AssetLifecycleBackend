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
            dept_id,
            emp_int_id
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
        org_id,
        isBreakdown = false
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
    
    // Only set MT004 when explicitly coming from breakdown screen (isBreakdown)
    const headerMaintTypeId = isBreakdown ? 'MT004' : maint_type_id;

    const values = [
        wfamsh_id,
        at_main_freq_id,
        headerMaintTypeId,
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

// Get all maintenance schedules from tblAssetMaintSch
const getAllMaintenanceSchedules = async (orgId = 'ORG001', branchId) => {
    console.log('=== Maintenance Schedule Model Debug ===');
    console.log('orgId:', orgId);
    console.log('branchId:', branchId);
    
    const query = `
        SELECT 
            ams.*,
            a.asset_type_id,
            a.serial_number,
            a.description as asset_description,
            at.text as asset_type_name,
            mt.text as maintenance_type_name,
            v.vendor_name,
            -- Calculate days until due (if act_maint_st_date is in the future)
            CASE 
                WHEN ams.act_maint_st_date > CURRENT_DATE THEN 
                    EXTRACT(DAY FROM (ams.act_maint_st_date - CURRENT_DATE))
                ELSE 0
            END as days_until_due
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.org_id = $1 AND a.org_id = $1 AND a.branch_id = $2
        ORDER BY ams.created_on DESC
    `;
    
    const result = await db.query(query, [orgId, branchId]);
    console.log('Query executed successfully, found rows:', result.rows.length);
    return result;
};

// Get maintenance schedule details by ID from tblAssetMaintSch
const getMaintenanceScheduleById = async (amsId, orgId = 'ORG001', branchId) => {
    const query = `
        SELECT 
            ams.*,
            COALESCE(a.asset_type_id, 'N/A') as asset_type_id,
            COALESCE(at.text, 'Unknown Asset Type') as asset_type_name
        FROM "tblAssetMaintSch" ams
        LEFT JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE ams.ams_id = $1 AND ams.org_id = $2 AND a.org_id = $2 AND a.branch_id = $3
    `;
    
    return await db.query(query, [amsId, orgId, branchId]);
};

// Update maintenance schedule in tblAssetMaintSch
const updateMaintenanceSchedule = async (amsId, updateData, orgId = 'ORG001') => {
    const {
        notes,
        status,
        po_number,
        invoice,
        technician_name,
        technician_email,
        technician_phno,
        changed_by,
        changed_on
    } = updateData;

    // Automatically set end date to current date when updating
    const currentDate = new Date().toISOString().split('T')[0];

    const query = `
        UPDATE "tblAssetMaintSch"
        SET
            notes = COALESCE($2, notes),
            status = COALESCE($3, status),
            act_main_end_date = $4,
            po_number = COALESCE($5, po_number),
            invoice = COALESCE($6, invoice),
            technician_name = COALESCE($7, technician_name),
            technician_email = COALESCE($8, technician_email),
            technician_phno = COALESCE($9, technician_phno),
            changed_by = $10,
            changed_on = $11
        WHERE ams_id = $1 AND org_id = $12
        RETURNING *
    `;

    const values = [
        amsId,
        notes,
        status,
        currentDate, // Automatically set to current date
        po_number,
        invoice,
        technician_name,
        technician_email,
        technician_phno,
        changed_by,
        changed_on,
        orgId
    ];
    return await db.query(query, values);
};

// Check if asset type requires workflow
const checkAssetTypeWorkflow = async (asset_type_id) => {
    const query = `
        SELECT COUNT(*) as workflow_count
        FROM "tblWFATSeqs"
        WHERE asset_type_id = $1
    `;
    
    const result = await db.query(query, [asset_type_id]);
    return result.rows[0].workflow_count > 0;
};

// Generate next AMS_ID for direct maintenance schedules
const getNextAMSId = async () => {
    const query = `
        SELECT MAX(
            CASE 
                WHEN ams_id ~ '^ams[0-9]+$' THEN CAST(SUBSTRING(ams_id FROM 4) AS INTEGER)
                WHEN ams_id ~ '^[0-9]+$' THEN CAST(ams_id AS INTEGER)
                ELSE 0
            END
        ) as max_num 
        FROM "tblAssetMaintSch"
    `;
    
    const result = await db.query(query);
    const nextId = (result.rows[0].max_num || 0) + 1;
    return `ams${nextId.toString().padStart(3, '0')}`;
};

// Generate work order ID for maintenance schedule
const generateWorkOrderId = (ams_id, wfamsh_id = null, abr_id = null, breakdown_reason = null) => {
    if (wfamsh_id && abr_id) {
        // Format: WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}
        let workOrderId = `WO-${wfamsh_id}-${abr_id}`;
        if (breakdown_reason) {
            workOrderId = `${workOrderId}-${breakdown_reason.substring(0, 20).replace(/\s/g, '_')}`;
        }
        return workOrderId;
    } else {
        // Format: WO-{AMS_ID} for direct schedules
        return `WO-${ams_id}`;
    }
};

// Insert direct maintenance schedule (bypassing workflow)
const insertDirectMaintenanceSchedule = async (scheduleData) => {
    const {
        ams_id,
        asset_id,
        maint_type_id,
        vendor_id,
        at_main_freq_id,
        maintained_by,
        notes,
        status,
        act_maint_st_date,
        created_by,
        org_id
    } = scheduleData;
    
    // Auto-generate work order ID
    const wo_id = generateWorkOrderId(ams_id);
    
    const query = `
        INSERT INTO "tblAssetMaintSch" (
            ams_id,
            wfamsh_id,
            wo_id,
            asset_id,
            maint_type_id,
            vendor_id,
            at_main_freq_id,
            maintained_by,
            notes,
            status,
            act_maint_st_date,
            created_by,
            created_on,
            org_id
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12)
        RETURNING *
    `;
    
    const values = [
        ams_id,
        wo_id,
        asset_id,
        maint_type_id,
        vendor_id,
        at_main_freq_id,
        maintained_by,
        notes,
        status,
        act_maint_st_date,
        created_by,
        org_id
    ];
    
    return await db.query(query, values);
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
    isMaintenanceDue,
    getAllMaintenanceSchedules,
    getMaintenanceScheduleById,
    updateMaintenanceSchedule,
    checkAssetTypeWorkflow,
    getNextAMSId,
    generateWorkOrderId,
    insertDirectMaintenanceSchedule
}; 