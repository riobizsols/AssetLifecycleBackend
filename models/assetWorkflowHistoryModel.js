const db = require('../config/db');

// Get asset workflow history with filtering capabilities
const getAssetWorkflowHistory = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT 
            -- Workflow Header Information
            wfh.wfamsh_id,
            wfh.at_main_freq_id,
            wfh.maint_type_id,
            wfh.asset_id,
            wfh.group_id,
            wfh.vendor_id,
            wfh.pl_sch_date as planned_schedule_date,
            wfh.act_sch_date as actual_schedule_date,
            wfh.status as workflow_status,
            wfh.created_by as workflow_created_by,
            wfh.created_on as workflow_created_on,
            wfh.changed_by as workflow_changed_by,
            wfh.changed_on as workflow_changed_on,
            wfh.org_id,
            
            -- Workflow Detail Information (Latest status for each user)
            wfd.wfamsd_id,
            wfd.user_id,
            wfd.job_role_id,
            wfd.dept_id,
            wfd.sequence,
            wfd.status as step_status,
            wfd.notes as step_notes,
            wfd.changed_by as step_changed_by,
            wfd.changed_on as step_changed_on,
            
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            a.service_vendor_id,
            
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            at.maint_lead_type,
            
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address,
            
            -- User Information
            u.full_name as user_name,
            u.email as user_email,
            
            -- Department Information
            d.text as department_name,
            
            -- Job Role Information
            jr.text as job_role_name,
            
            -- Workflow History Count
            (SELECT COUNT(*) FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id) as history_count,
            
            -- Latest History Action
            (SELECT wh.action FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action,
            (SELECT wh.action_on FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action_date,
            (SELECT u2.full_name FROM "tblWFAssetMaintHist" wh LEFT JOIN "tblUsers" u2 ON wh.action_by = u2.user_id WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action_by
            
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON wfh.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON wfh.vendor_id = v.vendor_id
        LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
        LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
        LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
        LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
        WHERE wfh.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply branch_id filter first
    if (filters.branch_id) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    // Apply filters
    if (filters.asset_id) {
        query += ` AND wfh.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND wfh.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.work_order_id) {
        query += ` AND wfh.wfamsh_id = $${paramIndex}`;
        queryParams.push(filters.work_order_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND (LOWER(wfd.notes) LIKE LOWER($${paramIndex}) OR LOWER(wfh.notes) LIKE LOWER($${paramIndex}))`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND wfh.act_sch_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND wfh.act_sch_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND wfh.act_sch_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND wfh.act_sch_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.workflow_status) {
        query += ` AND wfh.status = $${paramIndex}`;
        queryParams.push(filters.workflow_status);
        paramIndex++;
    }
    
    if (filters.step_status) {
        query += ` AND wfd.status = $${paramIndex}`;
        queryParams.push(filters.step_status);
        paramIndex++;
    }
    
    if (filters.user_id) {
        query += ` AND wfd.user_id = $${paramIndex}`;
        queryParams.push(filters.user_id);
        paramIndex++;
    }
    
    if (filters.department_id) {
        query += ` AND wfd.dept_id = $${paramIndex}`;
        queryParams.push(filters.department_id);
        paramIndex++;
    }
    
    // Handle advanced conditions
    if (filters.advancedConditions && Array.isArray(filters.advancedConditions)) {
        console.log('🔍 [Model] Processing advanced conditions:', JSON.stringify(filters.advancedConditions, null, 2));
        console.log('🔍 [Model] Query before advanced conditions:', query);
        filters.advancedConditions.forEach(condition => {
            console.log('🔍 [Model] Processing condition:', { field: condition.field, operator: condition.operator || condition.op, val: condition.val });
            if (condition.field && (condition.operator || condition.op) && condition.val !== undefined && condition.val !== null && condition.val !== '') {
                let fieldName = '';
                let tableAlias = '';
                
                // Map frontend field names to database columns
                switch (condition.field) {
                    case 'assetName':
                        fieldName = 'a.description';
                        tableAlias = 'a';
                        break;
                    case 'vendorName':
                        fieldName = 'v.vendor_name';
                        tableAlias = 'v';
                        break;
                    case 'workflowStatus':
                        fieldName = 'wfh.status';
                        tableAlias = 'wfh';
                        break;
                    case 'stepStatus':
                        fieldName = 'wfd.status';
                        tableAlias = 'wfd';
                        break;
                    case 'maintenanceType':
                        fieldName = 'mt.text';
                        tableAlias = 'mt';
                        break;
                    case 'assignedTo':
                        fieldName = 'wfd.user_id';
                        tableAlias = 'wfd';
                        console.log('🔍 [Model] Mapped assignedTo to wfd.user_id');
                        break;
                    case 'department':
                        fieldName = 'd.text';
                        tableAlias = 'd';
                        break;
                    case 'branchId':
                        fieldName = 'a.branch_id';
                        tableAlias = 'a';
                        break;
                    case 'serialNumber':
                        fieldName = 'a.serial_number';
                        tableAlias = 'a';
                        break;
                    case 'assetStatus':
                        fieldName = 'a.current_status';
                        tableAlias = 'a';
                        break;
                    case 'assetType':
                        fieldName = 'at.text';
                        tableAlias = 'at';
                        break;
                    case 'purchasedCost':
                        fieldName = 'a.purchased_cost';
                        tableAlias = 'a';
                        break;
                    case 'workflowCreatedDateRange':
                        fieldName = 'wfh.created_on';
                        tableAlias = 'wfh';
                        break;
                    case 'notes':
                        fieldName = 'wfd.notes';
                        tableAlias = 'wfd';
                        console.log('🔍 [Model] Mapped notes to wfd.notes');
                        break;
                    default:
                        return; // Skip unknown fields
                }
                
                console.log('🔍 [Model] Field mapping result:', { fieldName, tableAlias, operator: condition.operator || condition.op, val: condition.val });
                
                if (fieldName && tableAlias) {
                    const operator = condition.operator || condition.op;
                    switch (operator) {
                        case 'equals':
                            if (Array.isArray(condition.val)) {
                                const placeholders = condition.val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} IN (${placeholders})`;
                                queryParams.push(...condition.val);
                            } else {
                                query += ` AND ${fieldName} = $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                        case 'not_equals':
                            if (Array.isArray(condition.val)) {
                                const placeholders = condition.val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} NOT IN (${placeholders})`;
                                queryParams.push(...condition.val);
                            } else {
                                query += ` AND ${fieldName} != $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                        case 'contains':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'not_contains':
                            query += ` AND LOWER(${fieldName}) NOT LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'starts_with':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'ends_with':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}`);
                            paramIndex++;
                            break;
                        case 'greater_than':
                            query += ` AND ${fieldName} > $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'less_than':
                            query += ` AND ${fieldName} < $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'greater_than_or_equal':
                            query += ` AND ${fieldName} >= $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'less_than_or_equal':
                            query += ` AND ${fieldName} <= $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'between':
                        case 'in_range':
                            if (Array.isArray(condition.val) && condition.val.length === 2) {
                                console.log('🔍 [Model] Processing between/in_range date range:', {
                                    fieldName: fieldName,
                                    operator: operator,
                                    values: condition.val,
                                    startDate: condition.val[0],
                                    endDate: condition.val[1]
                                });
                                query += ` AND ${fieldName} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
                                queryParams.push(condition.val[0], condition.val[1]);
                                paramIndex += 2;
                            }
                            break;
                        case 'is_empty':
                            query += ` AND (${fieldName} IS NULL OR ${fieldName} = '')`;
                            break;
                        case 'is_not_empty':
                            query += ` AND (${fieldName} IS NOT NULL AND ${fieldName} != '')`;
                            break;
                        case 'has any':
                            if (Array.isArray(condition.val)) {
                                // Extract values from objects if they have value property
                                const values = condition.val.map(item => 
                                    typeof item === 'object' && item.value ? item.value : item
                                );
                                const placeholders = values.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} = ANY(ARRAY[${placeholders}])`;
                                queryParams.push(...values);
                            } else {
                                query += ` AND ${fieldName} = $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                    }
                }
            }
        });
        console.log('🔍 [Model] Query after advanced conditions:', query);
        console.log('🔍 [Model] Query parameters after advanced conditions:', queryParams);
    }
    
    // Add ordering
    query += ` ORDER BY wfh.created_on DESC, wfd.sequence ASC`;
    
    // Add pagination if specified
    if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(filters.limit);
        paramIndex++;
        
        if (filters.offset) {
            query += ` OFFSET $${paramIndex}`;
            queryParams.push(filters.offset);
        }
    }
    
    return await db.query(query, queryParams);
};

// Get asset workflow history count for pagination
const getAssetWorkflowHistoryCount = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT COUNT(DISTINCT wfh.wfamsh_id) as total_count
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON wfh.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON wfh.vendor_id = v.vendor_id
        LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
        LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
        LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
        LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
        WHERE wfh.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply branch_id filter first
    if (filters.branch_id) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    // Apply the same filters as the main query
    if (filters.asset_id) {
        query += ` AND wfh.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND wfh.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.work_order_id) {
        query += ` AND wfh.wfamsh_id = $${paramIndex}`;
        queryParams.push(filters.work_order_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND (LOWER(wfd.notes) LIKE LOWER($${paramIndex}) OR LOWER(wfh.notes) LIKE LOWER($${paramIndex}))`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND wfh.act_sch_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND wfh.act_sch_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND wfh.act_sch_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND wfh.act_sch_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.workflow_status) {
        query += ` AND wfh.status = $${paramIndex}`;
        queryParams.push(filters.workflow_status);
        paramIndex++;
    }
    
    if (filters.step_status) {
        query += ` AND wfd.status = $${paramIndex}`;
        queryParams.push(filters.step_status);
        paramIndex++;
    }
    
    if (filters.user_id) {
        query += ` AND wfd.user_id = $${paramIndex}`;
        queryParams.push(filters.user_id);
        paramIndex++;
    }
    
    if (filters.department_id) {
        query += ` AND wfd.dept_id = $${paramIndex}`;
        queryParams.push(filters.department_id);
        paramIndex++;
    }
    
    // Handle advanced conditions (same logic as main query)
    if (filters.advancedConditions && Array.isArray(filters.advancedConditions)) {
        filters.advancedConditions.forEach(condition => {
            console.log('🔍 [Model] Processing condition:', { field: condition.field, operator: condition.operator || condition.op, val: condition.val });
            if (condition.field && (condition.operator || condition.op) && condition.val !== undefined && condition.val !== null && condition.val !== '') {
                let fieldName = '';
                let tableAlias = '';
                
                // Map frontend field names to database columns
                switch (condition.field) {
                    case 'assetName':
                        fieldName = 'a.description';
                        tableAlias = 'a';
                        break;
                    case 'vendorName':
                        fieldName = 'v.vendor_name';
                        tableAlias = 'v';
                        break;
                    case 'workflowStatus':
                        fieldName = 'wfh.status';
                        tableAlias = 'wfh';
                        break;
                    case 'stepStatus':
                        fieldName = 'wfd.status';
                        tableAlias = 'wfd';
                        break;
                    case 'maintenanceType':
                        fieldName = 'mt.text';
                        tableAlias = 'mt';
                        break;
                    case 'assignedTo':
                        fieldName = 'wfd.user_id';
                        tableAlias = 'wfd';
                        console.log('🔍 [Model] Mapped assignedTo to wfd.user_id');
                        break;
                    case 'department':
                        fieldName = 'd.text';
                        tableAlias = 'd';
                        break;
                    case 'branchId':
                        fieldName = 'a.branch_id';
                        tableAlias = 'a';
                        break;
                    case 'serialNumber':
                        fieldName = 'a.serial_number';
                        tableAlias = 'a';
                        break;
                    case 'assetStatus':
                        fieldName = 'a.current_status';
                        tableAlias = 'a';
                        break;
                    case 'assetType':
                        fieldName = 'at.text';
                        tableAlias = 'at';
                        break;
                    case 'purchasedCost':
                        fieldName = 'a.purchased_cost';
                        tableAlias = 'a';
                        break;
                    case 'workflowCreatedDateRange':
                        fieldName = 'wfh.created_on';
                        tableAlias = 'wfh';
                        break;
                    case 'notes':
                        fieldName = 'wfd.notes';
                        tableAlias = 'wfd';
                        console.log('🔍 [Model] Mapped notes to wfd.notes');
                        break;
                    default:
                        return; // Skip unknown fields
                }
                
                console.log('🔍 [Model] Field mapping result:', { fieldName, tableAlias, operator: condition.operator || condition.op, val: condition.val });
                
                if (fieldName && tableAlias) {
                    const operator = condition.operator || condition.op;
                    switch (operator) {
                        case 'equals':
                            if (Array.isArray(condition.val)) {
                                const placeholders = condition.val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} IN (${placeholders})`;
                                queryParams.push(...condition.val);
                            } else {
                                query += ` AND ${fieldName} = $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                        case 'not_equals':
                            if (Array.isArray(condition.val)) {
                                const placeholders = condition.val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} NOT IN (${placeholders})`;
                                queryParams.push(...condition.val);
                            } else {
                                query += ` AND ${fieldName} != $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                        case 'contains':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'not_contains':
                            query += ` AND LOWER(${fieldName}) NOT LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'starts_with':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`${condition.val}%`);
                            paramIndex++;
                            break;
                        case 'ends_with':
                            query += ` AND LOWER(${fieldName}) LIKE LOWER($${paramIndex})`;
                            queryParams.push(`%${condition.val}`);
                            paramIndex++;
                            break;
                        case 'greater_than':
                            query += ` AND ${fieldName} > $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'less_than':
                            query += ` AND ${fieldName} < $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'greater_than_or_equal':
                            query += ` AND ${fieldName} >= $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'less_than_or_equal':
                            query += ` AND ${fieldName} <= $${paramIndex}`;
                            queryParams.push(condition.val);
                            paramIndex++;
                            break;
                        case 'between':
                        case 'in_range':
                            if (Array.isArray(condition.val) && condition.val.length === 2) {
                                console.log('🔍 [Model] Processing between/in_range date range:', {
                                    fieldName: fieldName,
                                    operator: operator,
                                    values: condition.val,
                                    startDate: condition.val[0],
                                    endDate: condition.val[1]
                                });
                                query += ` AND ${fieldName} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
                                queryParams.push(condition.val[0], condition.val[1]);
                                paramIndex += 2;
                            }
                            break;
                        case 'is_empty':
                            query += ` AND (${fieldName} IS NULL OR ${fieldName} = '')`;
                            break;
                        case 'is_not_empty':
                            query += ` AND (${fieldName} IS NOT NULL AND ${fieldName} != '')`;
                            break;
                        case 'has any':
                            if (Array.isArray(condition.val)) {
                                // Extract values from objects if they have value property
                                const values = condition.val.map(item => 
                                    typeof item === 'object' && item.value ? item.value : item
                                );
                                const placeholders = values.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${fieldName} = ANY(ARRAY[${placeholders}])`;
                                queryParams.push(...values);
                            } else {
                                query += ` AND ${fieldName} = $${paramIndex}`;
                                queryParams.push(condition.val);
                                paramIndex++;
                            }
                            break;
                    }
                }
            }
        });
    }
    
    return await db.query(query, queryParams);
};

// Get asset workflow history by asset ID
const getAssetWorkflowHistoryByAsset = async (assetId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            -- Workflow Header Information
            wfh.wfamsh_id,
            wfh.at_main_freq_id,
            wfh.maint_type_id,
            wfh.asset_id,
            wfh.group_id,
            wfh.vendor_id,
            wfh.pl_sch_date as planned_schedule_date,
            wfh.act_sch_date as actual_schedule_date,
            wfh.status as workflow_status,
            wfh.created_by as workflow_created_by,
            wfh.created_on as workflow_created_on,
            wfh.changed_by as workflow_changed_by,
            wfh.changed_on as workflow_changed_on,
            wfh.org_id,
            
            -- Workflow Detail Information (Latest status for each user)
            wfd.wfamsd_id,
            wfd.user_id,
            wfd.job_role_id,
            wfd.dept_id,
            wfd.sequence,
            wfd.status as step_status,
            wfd.notes as step_notes,
            wfd.changed_by as step_changed_by,
            wfd.changed_on as step_changed_on,
            
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            a.service_vendor_id,
            
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            at.maint_lead_type,
            
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address,
            
            -- User Information
            u.full_name as user_name,
            u.email as user_email,
            
            -- Department Information
            d.text as department_name,
            
            -- Job Role Information
            jr.text as job_role_name,
            
            -- Workflow History Count
            (SELECT COUNT(*) FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id) as history_count,
            
            -- Latest History Action
            (SELECT wh.action FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action,
            (SELECT wh.action_on FROM "tblWFAssetMaintHist" wh WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action_date,
            (SELECT u2.full_name FROM "tblWFAssetMaintHist" wh LEFT JOIN "tblUsers" u2 ON wh.action_by = u2.user_id WHERE wh.wfamsh_id = wfh.wfamsh_id ORDER BY wh.action_on DESC LIMIT 1) as latest_action_by
            
        FROM "tblWFAssetMaintSch_H" wfh
        INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON wfh.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON wfh.vendor_id = v.vendor_id
        LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
        LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
        LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
        LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
        WHERE wfh.asset_id = $1 AND wfh.org_id = $2
        ORDER BY wfh.created_on DESC, wfd.sequence ASC
    `;
    
    return await db.query(query, [assetId, orgId]);
};

// Get workflow history details for a specific workflow
const getWorkflowHistoryDetails = async (wfamshId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            wh.wfamhis_id,
            wh.wfamsh_id,
            wh.wfamsd_id,
            wh.action_by,
            wh.action_on,
            wh.action,
            wh.notes as history_notes,
            wh.org_id,
            
            -- User who performed the action
            u.full_name as action_by_name,
            u.email as action_by_email,
            
            -- Workflow step details
            wfd.sequence,
            wfd.status as step_status,
            wfd.user_id as step_user_id,
            wfd.job_role_id,
            wfd.dept_id,
            
            -- Step user details
            u2.full_name as step_user_name,
            u2.email as step_user_email,
            
            -- Department details
            d.text as department_name,
            
            -- Job role details
            jr.text as job_role_name
            
        FROM "tblWFAssetMaintHist" wh
        LEFT JOIN "tblUsers" u ON wh.action_by = u.user_id
        LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
        LEFT JOIN "tblUsers" u2 ON wfd.user_id = u2.user_id
        LEFT JOIN "tblDepartments" d ON wfd.dept_id = d.dept_id
        LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
        WHERE wh.wfamsh_id = $1 AND wh.org_id = $2
        ORDER BY wh.action_on DESC
    `;
    
    return await db.query(query, [wfamshId, orgId]);
};

// Get asset workflow history summary statistics
const getAssetWorkflowHistorySummary = async (orgId = 'ORG001') => {
    const query = `
        SELECT 
            COUNT(DISTINCT wfh.wfamsh_id) as total_workflow_records,
            COUNT(CASE WHEN wfh.status = 'CO' THEN 1 END) as completed_workflows,
            COUNT(CASE WHEN wfh.status = 'IN' THEN 1 END) as in_progress_workflows,
            COUNT(CASE WHEN wfh.status = 'IP' THEN 1 END) as in_process_workflows,
            COUNT(CASE WHEN wfh.status = 'CA' THEN 1 END) as cancelled_workflows,
            COUNT(CASE WHEN wfh.act_sch_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as workflows_last_30_days,
            COUNT(CASE WHEN wfh.act_sch_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as workflows_last_90_days,
            COUNT(DISTINCT wfh.asset_id) as unique_assets_in_workflow,
            COUNT(DISTINCT wfh.vendor_id) as unique_vendors_in_workflow,
            COUNT(DISTINCT wfd.user_id) as unique_users_in_workflow
        FROM "tblWFAssetMaintSch_H" wfh
        LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
        WHERE wfh.org_id = $1
    `;
    
    return await db.query(query, [orgId]);
};

// Get available filter options for dropdowns
const getWorkflowFilterOptions = async (orgId = 'ORG001') => {
    // Get asset options
    const assetQuery = `
        SELECT DISTINCT a.asset_id, a.serial_number, a.description
        FROM "tblAssets" a 
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON a.asset_id = wfh.asset_id
        WHERE a.org_id = $1
        ORDER BY a.asset_id
    `;
    
    // Get vendor options
    const vendorQuery = `
        SELECT DISTINCT v.vendor_id, v.vendor_name
        FROM "tblVendors" v 
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON v.vendor_id = wfh.vendor_id
        WHERE v.org_id = $1
        ORDER BY v.vendor_name
    `;
    
    // Get work order options
    const workOrderQuery = `
        SELECT DISTINCT wfh.wfamsh_id as work_order_id
        FROM "tblWFAssetMaintSch_H" wfh 
        WHERE wfh.org_id = $1
        ORDER BY wfh.wfamsh_id
    `;
    
    // Get maintenance type options
    const maintenanceTypeQuery = `
        SELECT DISTINCT mt.maint_type_id, mt.text as maintenance_type_name
        FROM "tblMaintTypes" mt 
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON mt.maint_type_id = wfh.maint_type_id
        WHERE mt.org_id = $1
        ORDER BY mt.text
    `;
    
    // Get workflow status options
    const workflowStatusQuery = `
        SELECT DISTINCT wfh.status as workflow_status
        FROM "tblWFAssetMaintSch_H" wfh 
        WHERE wfh.org_id = $1 AND wfh.status IS NOT NULL
        ORDER BY wfh.status
    `;
    
    // Get step status options
    const stepStatusQuery = `
        SELECT DISTINCT wfd.status as step_status
        FROM "tblWFAssetMaintSch_D" wfd 
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
        WHERE wfh.org_id = $1 AND wfd.status IS NOT NULL
        ORDER BY wfd.status
    `;
    
    // Get user options
    const userQuery = `
        SELECT DISTINCT u.user_id, u.full_name
        FROM "tblUsers" u 
        INNER JOIN "tblWFAssetMaintSch_D" wfd ON u.user_id = wfd.user_id
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
        WHERE u.org_id = $1
        ORDER BY u.full_name
    `;
    
    // Get department options
    const departmentQuery = `
        SELECT DISTINCT d.dept_id, d.text as department_name
        FROM "tblDepartments" d 
        INNER JOIN "tblWFAssetMaintSch_D" wfd ON d.dept_id = wfd.dept_id
        INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
        WHERE d.org_id = $1
        ORDER BY d.text
    `;
    
    const [assetResult, vendorResult, workOrderResult, maintenanceTypeResult, workflowStatusResult, stepStatusResult, userResult, departmentResult] = await Promise.all([
        db.query(assetQuery, [orgId]),
        db.query(vendorQuery, [orgId]),
        db.query(workOrderQuery, [orgId]),
        db.query(maintenanceTypeQuery, [orgId]),
        db.query(workflowStatusQuery, [orgId]),
        db.query(stepStatusQuery, [orgId]),
        db.query(userQuery, [orgId]),
        db.query(departmentQuery, [orgId])
    ]);
    
    return {
        rows: [{
            asset_options: assetResult.rows,
            vendor_options: vendorResult.rows,
            work_order_options: workOrderResult.rows,
            maintenance_type_options: maintenanceTypeResult.rows,
            workflow_status_options: workflowStatusResult.rows,
            step_status_options: stepStatusResult.rows,
            user_options: userResult.rows,
            department_options: departmentResult.rows
        }]
    };
};

module.exports = {
    getAssetWorkflowHistory,
    getAssetWorkflowHistoryCount,
    getAssetWorkflowHistoryByAsset,
    getWorkflowHistoryDetails,
    getAssetWorkflowHistorySummary,
    getWorkflowFilterOptions
};
