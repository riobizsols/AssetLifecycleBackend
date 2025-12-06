const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get maintenance history with filtering capabilities
const getMaintenanceHistory = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply branch_id filter first
    // Apply branch_id filter only if hasSuperAccess is false
    if (filters.branch_id && !filters.hasSuperAccess) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    // Apply filters
    if (filters.asset_id) {
        query += ` AND ams.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND ams.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.wo_id) {
        query += ` AND ams.wo_id = $${paramIndex}`;
        queryParams.push(filters.wo_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND LOWER(ams.notes) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND ams.act_maint_st_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND ams.act_maint_st_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND ams.act_main_end_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND ams.act_main_end_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.status) {
        query += ` AND ams.status = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
    }
    
    if (filters.maintenance_type_id) {
        query += ` AND ams.maint_type_id = $${paramIndex}`;
        queryParams.push(filters.maintenance_type_id);
        paramIndex++;
    }
    
    // Process advanced conditions
    if (filters.advancedConditions && Array.isArray(filters.advancedConditions) && filters.advancedConditions.length > 0) {
        console.log('🔍 [MaintenanceHistoryModel] Processing advanced conditions:', filters.advancedConditions);
        filters.advancedConditions.forEach((condition, index) => {
            console.log(`🔍 [MaintenanceHistoryModel] Processing condition ${index + 1}:`, condition);
            if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
                const { field, op, val } = condition;
                
                // Map frontend field names to database column names
                let dbField = field;
                console.log(`🔍 [MaintenanceHistoryModel] Original field: ${field}, op: ${op}, val: ${val}`);
                if (field === 'assetName') {
                    dbField = 'a.description';
                } else if (field === 'assetType') {
                    dbField = 'at.text';
                } else if (field === 'vendorName') {
                    dbField = 'v.vendor_name';
                } else if (field === 'maintenanceType') {
                    dbField = 'mt.text';
                } else if (field === 'workOrderStatus') {
                    dbField = 'ams.status';
                    // Map full words to short codes for work order status
                    if (val === 'Completed') val = 'CO';
                    else if (val === 'Initiated') val = 'IN';
                    else if (val === 'Open') val = 'OP';
                    else if (val === 'In Progress') val = 'IP';
                    else if (val === 'Cancelled') val = 'CA';
                    else if (val === 'On Hold') val = 'OH';
                    // Keep existing short codes as is
                    else if (val === 'CO' || val === 'IN' || val === 'OP' || val === 'IP' || val === 'CA' || val === 'OH') {
                        // Already in correct format, no change needed
                    }
                } else if (field === 'notes') {
                    dbField = 'ams.notes';
                } else if (field === 'assetId') {
                    dbField = 'ams.asset_id';
                } else if (field === 'workOrderId') {
                    dbField = 'ams.wo_id';
                } else if (field === 'vendorId') {
                    dbField = 'ams.vendor_id';
                } else if (field === 'cost') {
                    // Cost in frontend is actually po_number, not purchased_cost
                    // Handle null values by treating them as 0 for comparison
                    dbField = 'COALESCE(CAST(ams.po_number AS NUMERIC), 0)';
                } else if (field === 'purchasedCost') {
                    dbField = 'CAST(a.purchased_cost AS NUMERIC)';
                } else if (field === 'serialNumber') {
                    dbField = 'a.serial_number';
                } else if (field === 'assetStatus') {
                    dbField = 'a.current_status';
                } else if (field === 'purchasedOn') {
                    dbField = 'a.purchased_on';
                } else if (field === 'downtime') {
                    // Downtime is calculated as: 8 if technician_name exists, otherwise N/A
                    // For filtering, we need to handle both numeric and 'N/A' cases
                    if (op === '=' && val === 'N/A') {
                        query += ` AND ams.technician_name IS NULL`;
                    } else if (op === '!=' && val === 'N/A') {
                        query += ` AND ams.technician_name IS NOT NULL`;
                    } else if (op === '=' && val === 8) {
                        query += ` AND ams.technician_name IS NOT NULL`;
                    } else if (op === '!=' && val === 8) {
                        query += ` AND ams.technician_name IS NULL`;
                    } else if (op === '=' && val > 8) {
                        // No records have downtime = val if val > 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '>' && val >= 8) {
                        // No records have downtime > val if val >= 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '>=' && val > 8) {
                        // No records have downtime >= val if val > 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '<' && val <= 8) {
                        // All records with technician have downtime < val if val > 8
                        if (val > 8) {
                            query += ` AND ams.technician_name IS NOT NULL`;
                        } else {
                            query += ` AND ams.technician_name IS NULL`;
                        }
                    } else if (op === '<=' && val >= 8) {
                        // All records with technician have downtime <= val if val >= 8
                        if (val >= 8) {
                            query += ` AND ams.technician_name IS NOT NULL`;
                        } else {
                            query += ` AND ams.technician_name IS NULL`;
                        }
                    } else {
                        // For other cases, skip
                        console.log('⚠️ [MaintenanceHistoryModel] Unsupported downtime filter:', op, val);
                        return;
                    }
                    return;
                } else if (field === 'poNumber') {
                    dbField = 'ams.po_number';
                } else if (field === 'invoice') {
                    dbField = 'ams.invoice';
                } else if (field === 'technicianName') {
                    dbField = 'ams.technician_name';
                } else if (field === 'technicianEmail') {
                    dbField = 'ams.technician_email';
                } else if (field === 'technicianPhone') {
                    dbField = 'ams.technician_phno';
                } else if (field === 'maintainedBy') {
                    dbField = 'ams.maintained_by';
                } else if (field === 'createdBy') {
                    dbField = 'ams.created_by';
                } else if (field === 'changedBy') {
                    dbField = 'ams.changed_by';
                } else if (field === 'maintenanceStartDate') {
                    dbField = 'ams.act_maint_st_date';
                } else if (field === 'maintenanceEndDate') {
                    dbField = 'ams.act_main_end_date';
                } else if (field === 'vendorContactPerson') {
                    dbField = 'v.contact_person_name';
                } else if (field === 'vendorEmail') {
                    dbField = 'v.contact_person_email';
                } else if (field === 'vendorPhone') {
                    dbField = 'v.contact_person_number';
                } else if (field === 'vendorAddress') {
                    dbField = 'CONCAT(v.address_line1, \', \', v.city, \', \', v.state, \' \', v.pincode)';
                } else if (field === 'branchId') {
                    dbField = 'a.branch_id';
                } else {
                    // Unknown field - skip this condition to prevent errors
                    console.log('⚠️ [MaintenanceHistoryModel] Unknown field in advanced condition:', field, '- skipping condition');
                    return;
                }
                
                console.log(`🔍 [MaintenanceHistoryModel] Mapped field: ${field} -> ${dbField}, final val: ${val}`);
                
                // Build the condition based on operator
                switch (op) {
                    case '=':
                        // Handle array values for multiselect fields
                        if (Array.isArray(val)) {
                            if (val.length === 0) {
                                // Empty array - no results
                                query += ` AND 1=0`;
                            } else {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${dbField} IN (${placeholders})`;
                                queryParams.push(...val);
                            }
                        } else {
                            query += ` AND ${dbField} = $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                        }
                        break;
                    case '!=':
                        // Handle array values for multiselect fields
                        if (Array.isArray(val)) {
                            if (val.length === 0) {
                                // Empty array - all results
                                // No condition added
                            } else {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${dbField} NOT IN (${placeholders})`;
                                queryParams.push(...val);
                            }
                        } else {
                            query += ` AND ${dbField} != $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                        }
                        break;
                    case 'contains':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}%`);
                        paramIndex++;
                        break;
                    case 'not_contains':
                        query += ` AND LOWER(${dbField}) NOT LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}%`);
                        paramIndex++;
                        break;
                    case 'starts_with':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`${val}%`);
                        paramIndex++;
                        break;
                    case 'ends_with':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}`);
                        paramIndex++;
                        break;
                    case '>':
                        query += ` AND ${dbField} > $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '>=':
                        query += ` AND ${dbField} >= $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '<':
                        query += ` AND ${dbField} < $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '<=':
                        query += ` AND ${dbField} <= $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case 'in':
                        if (Array.isArray(val) && val.length > 0) {
                            const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                            query += ` AND ${dbField} IN (${placeholders})`;
                            queryParams.push(...val);
                        }
                        break;
                    case 'not_in':
                        if (Array.isArray(val) && val.length > 0) {
                            const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                            query += ` AND ${dbField} NOT IN (${placeholders})`;
                            queryParams.push(...val);
                        }
                        break;
                }
            }
        });
    }
    
    // Add ordering
    query += ` ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC`;
    
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
    
    const dbPool = getDb();

    
    return await dbPool.query(query, queryParams);
};

// Get maintenance history count for pagination
const getMaintenanceHistoryCount = async (filters = {}, orgId = 'ORG001') => {
    let query = `
        SELECT COUNT(*) as total_count
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.org_id = $1
    `;
    
    const queryParams = [orgId];
    let paramIndex = 2;
    
    // Apply branch_id filter first
    // Apply branch_id filter only if hasSuperAccess is false
    if (filters.branch_id && !filters.hasSuperAccess) {
        query += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(filters.branch_id);
        paramIndex++;
    }
    
    // Apply the same filters as the main query
    if (filters.asset_id) {
        query += ` AND ams.asset_id = $${paramIndex}`;
        queryParams.push(filters.asset_id);
        paramIndex++;
    }
    
    if (filters.vendor_id) {
        query += ` AND ams.vendor_id = $${paramIndex}`;
        queryParams.push(filters.vendor_id);
        paramIndex++;
    }
    
    if (filters.wo_id) {
        query += ` AND ams.wo_id = $${paramIndex}`;
        queryParams.push(filters.wo_id);
        paramIndex++;
    }
    
    if (filters.notes) {
        query += ` AND LOWER(ams.notes) LIKE LOWER($${paramIndex})`;
        queryParams.push(`%${filters.notes}%`);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_from) {
        query += ` AND ams.act_maint_st_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_start_date_to) {
        query += ` AND ams.act_maint_st_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_start_date_to);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_from) {
        query += ` AND ams.act_main_end_date >= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_from);
        paramIndex++;
    }
    
    if (filters.maintenance_end_date_to) {
        query += ` AND ams.act_main_end_date <= $${paramIndex}`;
        queryParams.push(filters.maintenance_end_date_to);
        paramIndex++;
    }
    
    if (filters.status) {
        query += ` AND ams.status = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
    }
    
    if (filters.maintenance_type_id) {
        query += ` AND ams.maint_type_id = $${paramIndex}`;
        queryParams.push(filters.maintenance_type_id);
        paramIndex++;
    }
    
    // Process advanced conditions (same logic as in getMaintenanceHistory)
    if (filters.advancedConditions && Array.isArray(filters.advancedConditions) && filters.advancedConditions.length > 0) {
        filters.advancedConditions.forEach(condition => {
            if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
                const { field, op, val } = condition;
                
                // Map frontend field names to database column names
                let dbField = field;
                console.log(`🔍 [MaintenanceHistoryModel] Original field: ${field}, op: ${op}, val: ${val}`);
                if (field === 'assetName') {
                    dbField = 'a.description';
                } else if (field === 'assetType') {
                    dbField = 'at.text';
                } else if (field === 'vendorName') {
                    dbField = 'v.vendor_name';
                } else if (field === 'maintenanceType') {
                    dbField = 'mt.text';
                } else if (field === 'workOrderStatus') {
                    dbField = 'ams.status';
                    // Map full words to short codes for work order status
                    if (val === 'Completed') val = 'CO';
                    else if (val === 'Initiated') val = 'IN';
                    else if (val === 'Open') val = 'OP';
                    else if (val === 'In Progress') val = 'IP';
                    else if (val === 'Cancelled') val = 'CA';
                    else if (val === 'On Hold') val = 'OH';
                    // Keep existing short codes as is
                    else if (val === 'CO' || val === 'IN' || val === 'OP' || val === 'IP' || val === 'CA' || val === 'OH') {
                        // Already in correct format, no change needed
                    }
                } else if (field === 'notes') {
                    dbField = 'ams.notes';
                } else if (field === 'assetId') {
                    dbField = 'ams.asset_id';
                } else if (field === 'workOrderId') {
                    dbField = 'ams.wo_id';
                } else if (field === 'vendorId') {
                    dbField = 'ams.vendor_id';
                } else if (field === 'cost') {
                    // Cost in frontend is actually po_number, not purchased_cost
                    // Handle null values by treating them as 0 for comparison
                    dbField = 'COALESCE(CAST(ams.po_number AS NUMERIC), 0)';
                } else if (field === 'purchasedCost') {
                    dbField = 'CAST(a.purchased_cost AS NUMERIC)';
                } else if (field === 'serialNumber') {
                    dbField = 'a.serial_number';
                } else if (field === 'assetStatus') {
                    dbField = 'a.current_status';
                } else if (field === 'purchasedOn') {
                    dbField = 'a.purchased_on';
                } else if (field === 'downtime') {
                    // Downtime is calculated as: 8 if technician_name exists, otherwise N/A
                    // For filtering, we need to handle both numeric and 'N/A' cases
                    if (op === '=' && val === 'N/A') {
                        query += ` AND ams.technician_name IS NULL`;
                    } else if (op === '!=' && val === 'N/A') {
                        query += ` AND ams.technician_name IS NOT NULL`;
                    } else if (op === '=' && val === 8) {
                        query += ` AND ams.technician_name IS NOT NULL`;
                    } else if (op === '!=' && val === 8) {
                        query += ` AND ams.technician_name IS NULL`;
                    } else if (op === '=' && val > 8) {
                        // No records have downtime = val if val > 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '>' && val >= 8) {
                        // No records have downtime > val if val >= 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '>=' && val > 8) {
                        // No records have downtime >= val if val > 8 (since max is 8)
                        query += ` AND 1=0`;
                    } else if (op === '<' && val <= 8) {
                        // All records with technician have downtime < val if val > 8
                        if (val > 8) {
                            query += ` AND ams.technician_name IS NOT NULL`;
                        } else {
                            query += ` AND ams.technician_name IS NULL`;
                        }
                    } else if (op === '<=' && val >= 8) {
                        // All records with technician have downtime <= val if val >= 8
                        if (val >= 8) {
                            query += ` AND ams.technician_name IS NOT NULL`;
                        } else {
                            query += ` AND ams.technician_name IS NULL`;
                        }
                    } else {
                        // For other cases, skip
                        console.log('⚠️ [MaintenanceHistoryModel] Unsupported downtime filter:', op, val);
                        return;
                    }
                    return;
                } else if (field === 'poNumber') {
                    dbField = 'ams.po_number';
                } else if (field === 'invoice') {
                    dbField = 'ams.invoice';
                } else if (field === 'technicianName') {
                    dbField = 'ams.technician_name';
                } else if (field === 'technicianEmail') {
                    dbField = 'ams.technician_email';
                } else if (field === 'technicianPhone') {
                    dbField = 'ams.technician_phno';
                } else if (field === 'maintainedBy') {
                    dbField = 'ams.maintained_by';
                } else if (field === 'createdBy') {
                    dbField = 'ams.created_by';
                } else if (field === 'changedBy') {
                    dbField = 'ams.changed_by';
                } else if (field === 'maintenanceStartDate') {
                    dbField = 'ams.act_maint_st_date';
                } else if (field === 'maintenanceEndDate') {
                    dbField = 'ams.act_main_end_date';
                } else if (field === 'vendorContactPerson') {
                    dbField = 'v.contact_person_name';
                } else if (field === 'vendorEmail') {
                    dbField = 'v.contact_person_email';
                } else if (field === 'vendorPhone') {
                    dbField = 'v.contact_person_number';
                } else if (field === 'vendorAddress') {
                    dbField = 'CONCAT(v.address_line1, \', \', v.city, \', \', v.state, \' \', v.pincode)';
                } else if (field === 'branchId') {
                    dbField = 'a.branch_id';
                } else {
                    // Unknown field - skip this condition to prevent errors
                    console.log('⚠️ [MaintenanceHistoryModel] Unknown field in advanced condition:', field, '- skipping condition');
                    return;
                }
                
                console.log(`🔍 [MaintenanceHistoryModel] Mapped field: ${field} -> ${dbField}, final val: ${val}`);
                
                // Build the condition based on operator
                switch (op) {
                    case '=':
                        // Handle array values for multiselect fields
                        if (Array.isArray(val)) {
                            if (val.length === 0) {
                                // Empty array - no results
                                query += ` AND 1=0`;
                            } else {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${dbField} IN (${placeholders})`;
                                queryParams.push(...val);
                            }
                        } else {
                            query += ` AND ${dbField} = $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                        }
                        break;
                    case '!=':
                        // Handle array values for multiselect fields
                        if (Array.isArray(val)) {
                            if (val.length === 0) {
                                // Empty array - all results
                                // No condition added
                            } else {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                query += ` AND ${dbField} NOT IN (${placeholders})`;
                                queryParams.push(...val);
                            }
                        } else {
                            query += ` AND ${dbField} != $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                        }
                        break;
                    case 'contains':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}%`);
                        paramIndex++;
                        break;
                    case 'not_contains':
                        query += ` AND LOWER(${dbField}) NOT LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}%`);
                        paramIndex++;
                        break;
                    case 'starts_with':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`${val}%`);
                        paramIndex++;
                        break;
                    case 'ends_with':
                        query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
                        queryParams.push(`%${val}`);
                        paramIndex++;
                        break;
                    case '>':
                        query += ` AND ${dbField} > $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '>=':
                        query += ` AND ${dbField} >= $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '<':
                        query += ` AND ${dbField} < $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case '<=':
                        query += ` AND ${dbField} <= $${paramIndex}`;
                        queryParams.push(val);
                        paramIndex++;
                        break;
                    case 'in':
                        if (Array.isArray(val) && val.length > 0) {
                            const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                            query += ` AND ${dbField} IN (${placeholders})`;
                            queryParams.push(...val);
                        }
                        break;
                    case 'not_in':
                        if (Array.isArray(val) && val.length > 0) {
                            const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                            query += ` AND ${dbField} NOT IN (${placeholders})`;
                            queryParams.push(...val);
                        }
                        break;
                }
            }
        });
    }
    
    const dbPool = getDb();

    
    return await dbPool.query(query, queryParams);
};

// Get maintenance history by asset ID
const getMaintenanceHistoryByAsset = async (assetId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.asset_id = $1 AND ams.org_id = $2
        ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [assetId, orgId]);
};

// Get maintenance history by work order ID
const getMaintenanceHistoryByWorkOrder = async (woId, orgId = 'ORG001') => {
    const query = `
        SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.vendor_id,
            ams.act_maint_st_date,
            ams.act_main_end_date,
            ams.notes,
            ams.status,
            ams.maintained_by,
            ams.po_number,
            ams.invoice,
            ams.technician_name,
            ams.technician_email,
            ams.technician_phno,
            ams.created_by,
            ams.created_on,
            ams.changed_by,
            ams.changed_on,
            ams.org_id,
            -- Asset Information
            a.serial_number,
            a.description as asset_description,
            a.current_status as asset_status,
            a.purchased_on,
            a.purchased_cost,
            -- Asset Type Information
            at.asset_type_id,
            at.text as asset_type_name,
            -- Maintenance Type Information
            mt.text as maintenance_type_name,
            -- Vendor Information
            v.vendor_name,
            v.contact_person_name,
            v.contact_person_email as vendor_email,
            v.contact_person_number as vendor_phone,
            CONCAT(v.address_line1, ', ', v.city, ', ', v.state, ' ', v.pincode) as vendor_address
        FROM "tblAssetMaintSch" ams
        INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
        LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
        WHERE ams.wo_id = $1 AND ams.org_id = $2
        ORDER BY ams.act_maint_st_date DESC, ams.created_on DESC
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [woId, orgId]);
};

// Get maintenance history summary statistics
const getMaintenanceHistorySummary = async (orgId = 'ORG001') => {
    const query = `
        SELECT 
            COUNT(*) as total_maintenance_records,
            COUNT(CASE WHEN status = 'CO' THEN 1 END) as completed_maintenance,
            COUNT(CASE WHEN status = 'IN' THEN 1 END) as in_progress_maintenance,
            COUNT(CASE WHEN status = 'CA' THEN 1 END) as cancelled_maintenance,
            COUNT(CASE WHEN act_maint_st_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as maintenance_last_30_days,
            COUNT(CASE WHEN act_maint_st_date >= CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as maintenance_last_90_days,
            COUNT(DISTINCT asset_id) as unique_assets_maintained,
            COUNT(DISTINCT vendor_id) as unique_vendors_used
        FROM "tblAssetMaintSch"
        WHERE org_id = $1
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [orgId]);
};

// Get available filter options for dropdowns
const getFilterOptions = async (orgId = 'ORG001') => {
    // Get asset options
    const assetQuery = `
        SELECT DISTINCT a.asset_id, a.serial_number, a.description
        FROM "tblAssets" a 
        WHERE a.org_id = $1
        ORDER BY a.asset_id
    `;
    
    // Get vendor options
    const vendorQuery = `
        SELECT DISTINCT v.vendor_id, v.vendor_name
        FROM "tblVendors" v 
        WHERE v.org_id = $1
        ORDER BY v.vendor_name
    `;
    
    // Get work order options
    const workOrderQuery = `
        SELECT DISTINCT ams.wo_id
        FROM "tblAssetMaintSch" ams 
        WHERE ams.org_id = $1 AND ams.wo_id IS NOT NULL
        ORDER BY ams.wo_id
    `;
    
    // Get maintenance type options
    const maintenanceTypeQuery = `
        SELECT DISTINCT mt.maint_type_id, mt.text as maintenance_type_name
        FROM "tblMaintTypes" mt 
        WHERE mt.org_id = $1
        ORDER BY mt.text
    `;
    
    // Get status options
    const statusQuery = `
        SELECT DISTINCT ams.status
        FROM "tblAssetMaintSch" ams 
        WHERE ams.org_id = $1 AND ams.status IS NOT NULL
        ORDER BY ams.status
    `;
    
    const dbPool = getDb();
    const [assetResult, vendorResult, workOrderResult, maintenanceTypeResult, statusResult] = await Promise.all([
        dbPool.query(assetQuery, [orgId]),
        dbPool.query(vendorQuery, [orgId]),
        dbPool.query(workOrderQuery, [orgId]),
        dbPool.query(maintenanceTypeQuery, [orgId]),
        dbPool.query(statusQuery, [orgId])
    ]);
    
    return {
        rows: [{
            asset_options: assetResult.rows,
            vendor_options: vendorResult.rows,
            work_order_options: workOrderResult.rows,
            maintenance_type_options: maintenanceTypeResult.rows,
            status_options: statusResult.rows
        }]
    };
};

module.exports = {
    getMaintenanceHistory,
    getMaintenanceHistoryCount,
    getMaintenanceHistoryByAsset,
    getMaintenanceHistoryByWorkOrder,
    getMaintenanceHistorySummary,
    getFilterOptions
};
