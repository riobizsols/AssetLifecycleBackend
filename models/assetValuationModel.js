const db = require('../config/db');

class AssetValuationModel {
    /**
     * Get comprehensive asset valuation data with filtering
     * @param {Object} filters - Filter parameters
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Asset valuation data with totals
     */
    static async getAssetValuationData(filters, orgId) {
        try {
            // Validate required parameters
            if (!orgId) {
                throw new Error('Organization ID is required');
            }
            if (!filters) {
                throw new Error('Filters object is required');
            }

            const {
                branch_id,
                assetStatus,
                includeScrapAssets,
                currentValueMin,
                currentValueMax,
                category,
                location,
                department,
                acquisitionDateFrom,
                acquisitionDateTo,
                page,
                limit,
                sortBy,
                sortOrder,
                advancedConditions
            } = filters;

            // Build the base query
            let baseQuery = `
                SELECT 
                    a.asset_id as "Asset Code",
                    a.text as "Name",
                    at.text as "Category",
                    b.text as "Location",
                    'No Department' as "Department",
                    CASE 
                        WHEN a.current_status = 'SCRAPPED' THEN 'Scrap'
                        ELSE 'In-Use'
                    END as "Asset Status",
                    a.purchased_on as "Acquisition Date",
                    COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) as "Current Value",
                    COALESCE(CAST(a.purchased_cost AS NUMERIC), 0) as "Original Cost",
                    COALESCE(CAST(a.accumulated_depreciation AS NUMERIC), 0) as "Accumulated Depreciation",
                    COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) as "Net Book Value",
                    CASE 
                        WHEN at.depreciation_type = 'SL' THEN 'Straight Line (SL)'
                        WHEN at.depreciation_type = 'RB' THEN 'Reducing Balance (RB)'
                        WHEN at.depreciation_type = 'DD' THEN 'Double Declining (DD)'
                        WHEN at.depreciation_type = 'ND' THEN 'No Depreciation (ND)'
                        WHEN a.depreciation_rate > 0 THEN 'Depreciation Applied'
                        ELSE 'No Depreciation'
                    END as "Depreciation Method",
                    COALESCE(a.useful_life_years, 0) as "Useful Life",
                    a.serial_number,
                    a.description,
                    v.vendor_name as "Vendor",
                    a.purchased_by,
                    a.warranty_period,
                    a.expiry_date
                FROM "tblAssets" a
                LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
                LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
                LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
                LEFT JOIN "tblProdServs" ps ON a.prod_serv_id = ps.prod_serv_id
                WHERE a.org_id = $1
            `;

            const queryParams = [orgId];
            let paramIndex = 2;

            // Apply branch_id filter first
            if (branch_id) {
                baseQuery += ` AND a.branch_id = $${paramIndex}`;
                queryParams.push(branch_id);
                paramIndex++;
            }

            // Apply filters
            if (assetStatus && assetStatus !== 'All' && assetStatus !== null) {
                if (assetStatus === 'Scrap') {
                    baseQuery += ` AND a.current_status = 'SCRAPPED'`;
                } else if (assetStatus === 'In-Use') {
                    baseQuery += ` AND a.current_status != 'SCRAPPED'`;
                }
            } else if (!includeScrapAssets) {
                // If no specific status selected and includeScrapAssets is false, show only In-Use
                baseQuery += ` AND a.current_status != 'SCRAPPED'`;
            }
            // If includeScrapAssets is true and no specific status, show all assets (no filter)

            // Current value range filter
            if (currentValueMin !== null && currentValueMin !== undefined) {
                baseQuery += ` AND COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) >= $${paramIndex}`;
                queryParams.push(currentValueMin);
                paramIndex++;
            }
            if (currentValueMax !== null && currentValueMax !== undefined) {
                baseQuery += ` AND COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) <= $${paramIndex}`;
                queryParams.push(currentValueMax);
                paramIndex++;
            }

            // Category filter
            if (category && category.length > 0) {
                const categoryPlaceholders = category.map(() => `$${paramIndex++}`).join(',');
                baseQuery += ` AND at.text IN (${categoryPlaceholders})`;
                queryParams.push(...category);
            }

            // Location filter
            if (location && location.length > 0) {
                const locationPlaceholders = location.map(() => `$${paramIndex++}`).join(',');
                baseQuery += ` AND b.text IN (${locationPlaceholders})`;
                queryParams.push(...location);
            }

            // Department filter - disabled since no department data in assets table
            // if (department && department.length > 0) {
            //     const departmentPlaceholders = department.map(() => `$${paramIndex++}`).join(',');
            //     baseQuery += ` AND ps.description IN (${departmentPlaceholders})`;
            //     queryParams.push(...department);
            // }

            // Acquisition date range filter
            if (acquisitionDateFrom) {
                baseQuery += ` AND a.purchased_on >= $${paramIndex}`;
                queryParams.push(acquisitionDateFrom);
                paramIndex++;
            }
            if (acquisitionDateTo) {
                baseQuery += ` AND a.purchased_on <= $${paramIndex}`;
                queryParams.push(acquisitionDateTo);
                paramIndex++;
            }

            // Apply advanced conditions
            if (advancedConditions && Array.isArray(advancedConditions) && advancedConditions.length > 0) {
                for (const condition of advancedConditions) {
                    if (!condition.field || !condition.op || condition.val === null || condition.val === undefined) {
                        continue;
                    }
                    
                    // Skip empty arrays or empty strings
                    if (Array.isArray(condition.val) && condition.val.length === 0) continue;
                    if (typeof condition.val === 'string' && condition.val.trim() === '') continue;

                    const { field, op, val } = condition;
                    
                    // Map frontend field names to database columns
                    const fieldMapping = {
                        'assetCode': 'a.asset_id',
                        'name': 'a.text',
                        'originalCost': 'CAST(a.purchased_cost AS NUMERIC)',
                        'accumulatedDepreciation': 'CAST(a.accumulated_depreciation AS NUMERIC)',
                        'netBookValue': 'CAST(a.current_book_value AS NUMERIC)',
                        'depreciationMethod': 'at.depreciation_type',
                        'usefulLife': 'a.useful_life_years',
                        'branchId': 'a.branch_id'
                    };

                    const dbField = fieldMapping[field];
                    if (!dbField) continue;

                    // Apply the condition based on operator
                    switch (op) {
                        case '=':
                            if (Array.isArray(val)) {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                baseQuery += ` AND ${dbField} IN (${placeholders})`;
                                queryParams.push(...val);
                            } else {
                                baseQuery += ` AND ${dbField} = $${paramIndex}`;
                                queryParams.push(val);
                                paramIndex++;
                            }
                            break;
                        case '!=':
                            if (Array.isArray(val)) {
                                const placeholders = val.map(() => `$${paramIndex++}`).join(',');
                                baseQuery += ` AND ${dbField} NOT IN (${placeholders})`;
                                queryParams.push(...val);
                            } else {
                                baseQuery += ` AND ${dbField} != $${paramIndex}`;
                                queryParams.push(val);
                                paramIndex++;
                            }
                            break;
                        case '>':
                            baseQuery += ` AND ${dbField} > $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                            break;
                        case '>=':
                            baseQuery += ` AND ${dbField} >= $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                            break;
                        case '<':
                            baseQuery += ` AND ${dbField} < $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                            break;
                        case '<=':
                            baseQuery += ` AND ${dbField} <= $${paramIndex}`;
                            queryParams.push(val);
                            paramIndex++;
                            break;
                        case 'contains':
                            baseQuery += ` AND ${dbField}::text ILIKE $${paramIndex}`;
                            queryParams.push(`%${val}%`);
                            paramIndex++;
                            break;
                        case 'starts_with':
                            baseQuery += ` AND ${dbField}::text ILIKE $${paramIndex}`;
                            queryParams.push(`${val}%`);
                            paramIndex++;
                            break;
                        case 'ends_with':
                            baseQuery += ` AND ${dbField}::text ILIKE $${paramIndex}`;
                            queryParams.push(`%${val}`);
                            paramIndex++;
                            break;
                    }
                }
            }

            // Add ordering
            const validSortColumns = [
                'asset_id', 'text', 'Category', 'Location', 'Department', 
                'Asset Status', 'purchased_on', 'Current Value', 'Original Cost',
                'Accumulated Depreciation', 'Net Book Value', 'Depreciation Method', 'Useful Life'
            ];
            const sortColumn = (sortBy && validSortColumns.includes(sortBy)) ? sortBy : 'asset_id';
            const orderDirection = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
            
            baseQuery += ` ORDER BY "${sortColumn}" ${orderDirection}`;

            // Add pagination
            const offset = (page - 1) * limit;
            baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            queryParams.push(limit, offset);

            // Execute the main query
            const result = await db.query(baseQuery, queryParams);

            // Get total count for pagination
            let countQuery = `
                SELECT COUNT(*) as total
                FROM "tblAssets" a
                LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
                LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
                LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
                LEFT JOIN "tblProdServs" ps ON a.prod_serv_id = ps.prod_serv_id
                WHERE a.org_id = $1
            `;

            const countParams = [orgId];
            let countParamIndex = 2;

            // Apply branch_id filter first
            if (branch_id) {
                countQuery += ` AND a.branch_id = $${countParamIndex}`;
                countParams.push(branch_id);
                countParamIndex++;
            }

            // Apply same filters for count
            if (!includeScrapAssets) {
                countQuery += ` AND a.current_status != 'SCRAPPED'`;
            } else if (assetStatus && assetStatus !== 'All') {
                if (assetStatus === 'Scrap') {
                    countQuery += ` AND a.current_status = 'SCRAPPED'`;
                } else if (assetStatus === 'In-Use') {
                    countQuery += ` AND a.current_status != 'SCRAPPED'`;
                }
            }

            if (currentValueMin !== null && currentValueMin !== undefined) {
                countQuery += ` AND COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) >= $${countParamIndex}`;
                countParams.push(currentValueMin);
                countParamIndex++;
            }
            if (currentValueMax !== null && currentValueMax !== undefined) {
                countQuery += ` AND COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0) <= $${countParamIndex}`;
                countParams.push(currentValueMax);
                countParamIndex++;
            }

            if (category && category.length > 0) {
                const categoryPlaceholders = category.map(() => `$${countParamIndex++}`).join(',');
                countQuery += ` AND at.text IN (${categoryPlaceholders})`;
                countParams.push(...category);
            }

            if (location && location.length > 0) {
                const locationPlaceholders = location.map(() => `$${countParamIndex++}`).join(',');
                countQuery += ` AND b.text IN (${locationPlaceholders})`;
                countParams.push(...location);
            }

            if (department && department.length > 0) {
                const departmentPlaceholders = department.map(() => `$${countParamIndex++}`).join(',');
                countQuery += ` AND ps.description IN (${departmentPlaceholders})`;
                countParams.push(...department);
            }

            if (acquisitionDateFrom) {
                countQuery += ` AND a.purchased_on >= $${countParamIndex}`;
                countParams.push(acquisitionDateFrom);
                countParamIndex++;
            }
            if (acquisitionDateTo) {
                countQuery += ` AND a.purchased_on <= $${countParamIndex}`;
                countParams.push(acquisitionDateTo);
                countParamIndex++;
            }

            // Apply advanced conditions to count query
            if (advancedConditions && Array.isArray(advancedConditions) && advancedConditions.length > 0) {
                for (const condition of advancedConditions) {
                    if (!condition.field || !condition.op || condition.val === null || condition.val === undefined) {
                        continue;
                    }
                    
                    // Skip empty arrays or empty strings
                    if (Array.isArray(condition.val) && condition.val.length === 0) continue;
                    if (typeof condition.val === 'string' && condition.val.trim() === '') continue;

                    const { field, op, val } = condition;
                    
                    // Map frontend field names to database columns
                    const fieldMapping = {
                        'assetCode': 'a.asset_id',
                        'name': 'a.text',
                        'originalCost': 'CAST(a.purchased_cost AS NUMERIC)',
                        'accumulatedDepreciation': 'CAST(a.accumulated_depreciation AS NUMERIC)',
                        'netBookValue': 'CAST(a.current_book_value AS NUMERIC)',
                        'depreciationMethod': 'at.depreciation_type',
                        'usefulLife': 'a.useful_life_years',
                        'branchId': 'a.branch_id'
                    };

                    const dbField = fieldMapping[field];
                    if (!dbField) continue;

                    // Apply the condition based on operator
                    switch (op) {
                        case '=':
                            if (Array.isArray(val)) {
                                const placeholders = val.map(() => `$${countParamIndex++}`).join(',');
                                countQuery += ` AND ${dbField} IN (${placeholders})`;
                                countParams.push(...val);
                            } else {
                                countQuery += ` AND ${dbField} = $${countParamIndex}`;
                                countParams.push(val);
                                countParamIndex++;
                            }
                            break;
                        case '!=':
                            if (Array.isArray(val)) {
                                const placeholders = val.map(() => `$${countParamIndex++}`).join(',');
                                countQuery += ` AND ${dbField} NOT IN (${placeholders})`;
                                countParams.push(...val);
                            } else {
                                countQuery += ` AND ${dbField} != $${countParamIndex}`;
                                countParams.push(val);
                                countParamIndex++;
                            }
                            break;
                        case '>':
                            countQuery += ` AND ${dbField} > $${countParamIndex}`;
                            countParams.push(val);
                            countParamIndex++;
                            break;
                        case '>=':
                            countQuery += ` AND ${dbField} >= $${countParamIndex}`;
                            countParams.push(val);
                            countParamIndex++;
                            break;
                        case '<':
                            countQuery += ` AND ${dbField} < $${countParamIndex}`;
                            countParams.push(val);
                            countParamIndex++;
                            break;
                        case '<=':
                            countQuery += ` AND ${dbField} <= $${countParamIndex}`;
                            countParams.push(val);
                            countParamIndex++;
                            break;
                        case 'contains':
                            countQuery += ` AND ${dbField}::text ILIKE $${countParamIndex}`;
                            countParams.push(`%${val}%`);
                            countParamIndex++;
                            break;
                        case 'starts_with':
                            countQuery += ` AND ${dbField}::text ILIKE $${countParamIndex}`;
                            countParams.push(`${val}%`);
                            countParamIndex++;
                            break;
                        case 'ends_with':
                            countQuery += ` AND ${dbField}::text ILIKE $${countParamIndex}`;
                            countParams.push(`%${val}`);
                            countParamIndex++;
                            break;
                    }
                }
            }

            const countResult = await db.query(countQuery, countParams);
            const totalCount = parseInt(countResult.rows[0].total);

            // Calculate totals
            const totals = this.calculateTotals(result.rows);

            return {
                assets: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                },
                totals,
                filters: filters
            };

        } catch (error) {
            console.error('Error in getAssetValuationData:', error);
            throw error;
        }
    }

    /**
     * Calculate totals for in-use and scrap assets
     * @param {Array} assets - Array of asset data
     * @returns {Object} Totals object
     */
    static calculateTotals(assets) {
        const totals = {
            inUse: {
                count: 0,
                totalCurrentValue: 0,
                totalOriginalCost: 0,
                totalAccumulatedDepreciation: 0,
                totalNetBookValue: 0
            },
            scrap: {
                count: 0,
                totalCurrentValue: 0,
                totalOriginalCost: 0,
                totalAccumulatedDepreciation: 0,
                totalNetBookValue: 0
            },
            overall: {
                count: 0,
                totalCurrentValue: 0,
                totalOriginalCost: 0,
                totalAccumulatedDepreciation: 0,
                totalNetBookValue: 0
            }
        };

        assets.forEach(asset => {
            const currentValue = parseFloat(asset['Current Value']) || 0;
            const originalCost = parseFloat(asset['Original Cost']) || 0;
            const accumulatedDepreciation = parseFloat(asset['Accumulated Depreciation']) || 0;
            const netBookValue = parseFloat(asset['Net Book Value']) || 0;

            // Update overall totals
            totals.overall.count++;
            totals.overall.totalCurrentValue += currentValue;
            totals.overall.totalOriginalCost += originalCost;
            totals.overall.totalAccumulatedDepreciation += accumulatedDepreciation;
            totals.overall.totalNetBookValue += netBookValue;

            // Update status-specific totals
            if (asset['Asset Status'] === 'Scrap') {
                totals.scrap.count++;
                totals.scrap.totalCurrentValue += currentValue;
                totals.scrap.totalOriginalCost += originalCost;
                totals.scrap.totalAccumulatedDepreciation += accumulatedDepreciation;
                totals.scrap.totalNetBookValue += netBookValue;
            } else {
                totals.inUse.count++;
                totals.inUse.totalCurrentValue += currentValue;
                totals.inUse.totalOriginalCost += originalCost;
                totals.inUse.totalAccumulatedDepreciation += accumulatedDepreciation;
                totals.inUse.totalNetBookValue += netBookValue;
            }
        });

        // Round all totals to 2 decimal places
        Object.keys(totals).forEach(status => {
            Object.keys(totals[status]).forEach(key => {
                if (key !== 'count') {
                    totals[status][key] = Math.round(totals[status][key] * 100) / 100;
                }
            });
        });

        return totals;
    }

    /**
     * Get asset valuation summary for dashboard
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Summary data
     */
    static async getAssetValuationSummary(orgId) {
        try {
            // Validate required parameters
            if (!orgId) {
                throw new Error('Organization ID is required');
            }
            const query = `
                SELECT 
                    CASE 
                        WHEN a.current_status = 'SCRAPPED' THEN 'Scrap'
                        ELSE 'In-Use'
                    END as asset_status,
                    COUNT(*) as asset_count,
                    SUM(COALESCE(CAST(a.current_book_value AS NUMERIC), CAST(a.purchased_cost AS NUMERIC), 0)) as total_current_value,
                    SUM(COALESCE(CAST(a.purchased_cost AS NUMERIC), 0)) as total_original_cost,
                    SUM(COALESCE(CAST(a.accumulated_depreciation AS NUMERIC), 0)) as total_accumulated_depreciation
                FROM "tblAssets" a
                WHERE a.org_id = $1
                GROUP BY 
                    CASE 
                        WHEN a.current_status = 'SCRAPPED' THEN 'Scrap'
                        ELSE 'In-Use'
                    END
                ORDER BY asset_status
            `;

            const result = await db.query(query, [orgId]);
            
            const summary = {
                inUse: { asset_count: 0, total_current_value: 0, total_original_cost: 0, total_accumulated_depreciation: 0 },
                scrap: { asset_count: 0, total_current_value: 0, total_original_cost: 0, total_accumulated_depreciation: 0 },
                overall: { asset_count: 0, total_current_value: 0, total_original_cost: 0, total_accumulated_depreciation: 0 }
            };

            result.rows.forEach(row => {
                let status;
                if (row.asset_status === 'In-Use') {
                    status = 'inUse';
                } else if (row.asset_status === 'Scrap') {
                    status = 'scrap';
                }
                
                if (summary[status]) {
                    summary[status].asset_count = parseInt(row.asset_count);
                    summary[status].total_current_value = parseFloat(row.total_current_value) || 0;
                    summary[status].total_original_cost = parseFloat(row.total_original_cost) || 0;
                    summary[status].total_accumulated_depreciation = parseFloat(row.total_accumulated_depreciation) || 0;
                }
            });

            // Calculate overall totals
            summary.overall.asset_count = summary.inUse.asset_count + summary.scrap.asset_count;
            summary.overall.total_current_value = summary.inUse.total_current_value + summary.scrap.total_current_value;
            summary.overall.total_original_cost = summary.inUse.total_original_cost + summary.scrap.total_original_cost;
            summary.overall.total_accumulated_depreciation = summary.inUse.total_accumulated_depreciation + summary.scrap.total_accumulated_depreciation;

            return summary;

        } catch (error) {
            console.error('Error in getAssetValuationSummary:', error);
            throw error;
        }
    }

    /**
     * Get available filter options for the frontend
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Filter options
     */
    static async getFilterOptions(orgId) {
        try {
            // Validate required parameters
            if (!orgId) {
                throw new Error('Organization ID is required');
            }
            const queries = {
                categories: `
                    SELECT DISTINCT at.text as category
                    FROM "tblAssets" a
                    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
                    WHERE a.org_id = $1 AND at.text IS NOT NULL
                    ORDER BY at.text
                `,
                locations: `
                    SELECT DISTINCT b.text as location
                    FROM "tblAssets" a
                    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
                    WHERE a.org_id = $1 AND b.text IS NOT NULL
                    ORDER BY b.text
                `,
                // departments: disabled since no department data in assets table
                // departments: `
                //     SELECT DISTINCT ps.description as department
                //     FROM "tblAssets" a
                //     LEFT JOIN "tblProdServs" ps ON a.prod_serv_id = ps.prod_serv_id
                //     WHERE a.org_id = $1 AND ps.description IS NOT NULL
                //     ORDER BY ps.description
                // `,
                vendors: `
                    SELECT DISTINCT v.vendor_name as vendor
                    FROM "tblAssets" a
                    LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
                    WHERE a.org_id = $1 AND v.vendor_name IS NOT NULL
                    ORDER BY v.vendor_name
                `
            };

            const results = {};
            const fieldMapping = {
                categories: 'category',
                locations: 'location', 
                // departments: 'department', // disabled since no department data
                vendors: 'vendor'
            };
            
            for (const [key, query] of Object.entries(queries)) {
                const result = await db.query(query, [orgId]);
                const fieldName = fieldMapping[key];
                results[key] = result.rows.map(row => row[fieldName]);
            }

            return results;

        } catch (error) {
            console.error('Error in getFilterOptions:', error);
            throw error;
        }
    }
}

module.exports = AssetValuationModel;
