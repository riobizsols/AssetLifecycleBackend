const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');
const { getOrgSetting, setOrgSetting } = require('../utils/orgSettingsUtils');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


/**
 * Depreciation Model
 * Handles all database operations related to depreciation
 */

class DepreciationModel {
    /**
     * Get asset depreciation information
     * @param {string} assetId - Asset ID
     * @returns {Promise<Object>} Asset depreciation data
     */
        static async getAssetDepreciationInfo(assetId) {
        const query = `
            SELECT
                a.asset_id,
                a.text as asset_name,
                a.purchased_cost,
                a.salvage_value,
                a.useful_life_years,
                a.depreciation_rate,
                a.current_book_value,
                a.accumulated_depreciation,
                a.last_depreciation_calc_date,
                a.purchased_on,
                a.org_id,
                at.depreciation_type as asset_type_depreciation_type
            FROM "tblAssets" a
            LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            WHERE a.asset_id = $1
        `;
        
        const dbPool = getDb();

        
        return await dbPool.query(query, [assetId]);
    }

    /**
     * Get all assets eligible for depreciation calculation
     * @param {string} orgId - Organization ID
     * @returns {Promise<Array>} Array of assets eligible for depreciation
     */
    static async getAssetsForDepreciation(orgId) {
        const query = `
            SELECT 
                a.asset_id,
                a.text as asset_name,
                a.purchased_cost,
                a.salvage_value,
                a.useful_life_years,
                a.depreciation_rate,
                a.current_book_value,
                a.accumulated_depreciation,
                a.last_depreciation_calc_date,
                a.purchased_on,
                a.org_id,
                at.depreciation_type as asset_type_depreciation_type
            FROM "tblAssets" a
            LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            WHERE a.org_id = $1 
            AND a.current_status != 'SCRAPPED'
            AND at.depreciation_type != 'ND'
            AND CAST(a.purchased_cost AS NUMERIC) > 0
            AND CAST(a.useful_life_years AS INTEGER) > 0
            AND (a.last_depreciation_calc_date IS NULL 
                 OR (EXTRACT(YEAR FROM a.last_depreciation_calc_date) < EXTRACT(YEAR FROM CURRENT_DATE))
                 OR (EXTRACT(YEAR FROM a.last_depreciation_calc_date) = EXTRACT(YEAR FROM CURRENT_DATE) 
                     AND EXTRACT(MONTH FROM a.last_depreciation_calc_date) < EXTRACT(MONTH FROM CURRENT_DATE)))
            ORDER BY a.last_depreciation_calc_date ASC NULLS FIRST, a.purchased_on ASC
        `;
        
        console.log(`[DEBUG] Querying assets for depreciation with org_id: ${orgId}`);
        const dbPool = getDb();

        const result = await dbPool.query(query, [orgId]);
        console.log(`[DEBUG] Found ${result.rows.length} assets eligible for depreciation`);
        if (result.rows.length > 0) {
            console.log(`[DEBUG] First asset:`, result.rows[0]);
        }
        return result;
    }

    /**
     * Insert depreciation record
     * @param {Object} depreciationData - Depreciation data
     * @returns {Promise<Object>} Insert result
     */
    static async insertDepreciationRecord(depreciationData) {
        const {
            asset_id,
            org_id,
            depreciation_amount,
            book_value_before,
            book_value_after,
            depreciation_rate,
            useful_life_years,
            created_by
        } = depreciationData;

        // Generate unique depreciation ID using asset_id and timestamp with milliseconds
        // Format: DEP-{asset_id}-{timestamp}
        const now = new Date();
        const timestamp = now.getTime().toString().slice(-9); // Last 9 digits of timestamp for uniqueness
        const depreciation_id = `DEP-${asset_id}-${timestamp}`;

        const query = `
            INSERT INTO "tblAssetDepHist" (
                depreciation_id,
                asset_id,
                org_id,
                depreciation_amount,
                book_value_before,
                book_value_after,
                depreciation_rate,
                useful_life_years,
                created_by,
                created_on
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            RETURNING *
        `;

        const values = [
            depreciation_id,
            asset_id,
            org_id,
            depreciation_amount,
            book_value_before,
            book_value_after,
            depreciation_rate,
            useful_life_years,
            created_by
        ];

        const dbPool = getDb();


        return await dbPool.query(query, values);
    }

    /**
     * Update asset depreciation values
     * @param {string} assetId - Asset ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Update result
     */
    static async updateAssetDepreciation(assetId, updateData) {
        const {
            current_book_value,
            accumulated_depreciation,
            last_depreciation_calc_date,
            depreciation_rate,
            changed_by
        } = updateData;

        const query = `
            UPDATE "tblAssets" 
            SET 
                current_book_value = $1,
                accumulated_depreciation = $2,
                last_depreciation_calc_date = $3,
                depreciation_rate = $4,
                changed_by = $5,
                changed_on = CURRENT_TIMESTAMP
            WHERE asset_id = $6
            RETURNING *
        `;

        const values = [
            current_book_value,
            accumulated_depreciation,
            last_depreciation_calc_date,
            depreciation_rate,
            changed_by,
            assetId
        ];

        const dbPool = getDb();


        return await dbPool.query(query, values);
    }

    /**
     * Get depreciation history for an asset
     * @param {string} assetId - Asset ID
     * @param {number} limit - Number of records to return
     * @returns {Promise<Array>} Array of depreciation records
     */
    static async getDepreciationHistory(assetId, limit = 50) {
        const query = `
            SELECT 
                depreciation_id,
                depreciation_date,
                depreciation_amount,
                book_value_before,
                book_value_after,
                depreciation_method,
                depreciation_rate,
                useful_life_years,
                salvage_value,
                original_cost,
                created_on
            FROM "tblAssetDepHist"
            WHERE asset_id = $1
            ORDER BY depreciation_date DESC, created_on DESC
            LIMIT $2
        `;

        const dbPool = getDb();


        return await dbPool.query(query, [assetId, limit]);
    }

    /**
     * Get depreciation summary for an organization
     * @param {string} orgId - Organization ID
     * @param {string} dateFrom - Start date (optional)
     * @param {string} dateTo - End date (optional)
     * @returns {Promise<Object>} Depreciation summary
     */
    static async getDepreciationSummary(orgId, dateFrom = null, dateTo = null) {
        let query = `
            SELECT 
                COUNT(DISTINCT ad.asset_id) as total_assets_depreciated,
                COUNT(ad.depreciation_id) as total_depreciation_records,
                SUM(ad.depreciation_amount) as total_depreciation_amount,
                AVG(ad.depreciation_amount) as average_depreciation_amount,
                MIN(ad.depreciation_date) as earliest_depreciation_date,
                MAX(ad.depreciation_date) as latest_depreciation_date
            FROM "tblAssetDepHist" ad
            WHERE ad.org_id = $1
        `;

        const values = [orgId];
        let paramCount = 1;

        if (dateFrom) {
            paramCount++;
            query += ` AND ad.depreciation_date >= $${paramCount}`;
            values.push(dateFrom);
        }

        if (dateTo) {
            paramCount++;
            query += ` AND ad.depreciation_date <= $${paramCount}`;
            values.push(dateTo);
        }

        const dbPool = getDb();


        return await dbPool.query(query, values);
    }

    /**
     * Get assets by depreciation method
     * @param {string} orgId - Organization ID
     * @param {string} depreciationMethod - Depreciation method
     * @returns {Promise<Array>} Array of assets
     */
    static async getAssetsByDepreciationMethod(orgId, depreciationMethod) {
        const query = `
            SELECT 
                a.asset_id,
                a.text as asset_name,
                a.purchased_cost,
                a.salvage_value,
                a.useful_life_years,
                a.depreciation_rate,
                a.current_book_value,
                a.accumulated_depreciation,
                a.last_depreciation_calc_date,
                a.purchased_on,
                at.text as asset_type_name
            FROM "tblAssets" a
            LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            WHERE a.org_id = $1 
            AND at.depreciation_type = $2
            AND a.current_status != 'SCRAPPED'
            ORDER BY a.text
        `;

        const dbPool = getDb();


        return await dbPool.query(query, [orgId, depreciationMethod]);
    }

    /**
     * Get depreciation settings for an organization
     * Now reads from tblOrgSettings instead of tblDepreciationSettings
     * @param {string} orgId - Organization ID
     * @returns {Promise<Object>} Depreciation settings
     */
    static async getDepreciationSettings(orgId) {
        const dbPool = getDb();
        
        // Get settings from tblOrgSettings
        const fiscalYearStartMonth = await getOrgSetting('fy_start_month', orgId, dbPool);
        const fiscalYearStartDay = await getOrgSetting('fy_start_day', orgId, dbPool);
        const depreciationCalcFreq = await getOrgSetting('dep_calc_freq', orgId, dbPool);
        const autoCalculateDep = await getOrgSetting('auto_calc_dep', orgId, dbPool);
        
        // Return in the same format as before for backward compatibility
        const settings = {
            org_id: orgId,
            fiscal_year_start_month: fiscalYearStartMonth ? parseInt(fiscalYearStartMonth) : 1,
            fiscal_year_start_day: fiscalYearStartDay ? parseInt(fiscalYearStartDay) : 1,
            depreciation_calculation_frequency: depreciationCalcFreq || 'MONTHLY',
            auto_calculate_depreciation: autoCalculateDep === 'true' || autoCalculateDep === '1' ? true : false
        };
        
        // Return in the same format as the original query result
        return {
            rows: [settings],
            rowCount: 1
        };
    }

    /**
     * Update depreciation settings
     * Now writes to tblOrgSettings instead of tblDepreciationSettings
     * @param {string} orgId - Organization ID (changed from settingId)
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Update result
     */
    static async updateDepreciationSettings(orgId, updateData) {
        const {
            fiscal_year_start_month,
            fiscal_year_start_day,
            depreciation_calculation_frequency,
            auto_calculate_depreciation,
            changed_by
        } = updateData;

        const dbPool = getDb();
        
        try {
            // Update each setting in tblOrgSettings
            await setOrgSetting('fy_start_month', fiscal_year_start_month.toString(), orgId, dbPool);
            await setOrgSetting('fy_start_day', fiscal_year_start_day.toString(), orgId, dbPool);
            await setOrgSetting('dep_calc_freq', depreciation_calculation_frequency, orgId, dbPool);
            await setOrgSetting('auto_calc_dep', auto_calculate_depreciation ? '1' : '0', orgId, dbPool);
            
            // Return updated settings in the same format as before
            const updatedSettings = {
                org_id: orgId,
                fiscal_year_start_month,
                fiscal_year_start_day,
                depreciation_calculation_frequency,
                auto_calculate_depreciation,
                changed_by,
                changed_on: new Date()
            };
            
            return {
                rows: [updatedSettings],
                rowCount: 1
            };
        } catch (error) {
            console.error('Error updating depreciation settings:', error);
            throw error;
        }
    }

    /**
     * Get assets that need depreciation calculation
     * @param {string} orgId - Organization ID
     * @param {Date} calculationDate - Date for calculation
     * @returns {Promise<Array>} Array of assets needing depreciation
     */
    static async getAssetsNeedingDepreciation(orgId, calculationDate) {
        const query = `
            SELECT 
                a.asset_id,
                a.text as asset_name,
                a.purchased_cost,
                a.salvage_value,
                a.useful_life_years,
                a.depreciation_rate,
                a.current_book_value,
                a.accumulated_depreciation,
                a.last_depreciation_calc_date,
                a.purchased_on,
                a.org_id,
                at.depreciation_type as asset_type_depreciation_type
            FROM "tblAssets" a
            LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            WHERE a.org_id = $1 
            AND a.current_status != 'SCRAPPED'
            AND at.depreciation_type != 'ND'
            AND a.purchased_cost > 0
            AND a.useful_life_years > 0
            AND (
                a.last_depreciation_calc_date IS NULL 
                OR a.last_depreciation_calc_date < $2
            )
            ORDER BY a.last_depreciation_calc_date ASC NULLS FIRST, a.purchased_on ASC
        `;

        const dbPool = getDb();


        return await dbPool.query(query, [orgId, calculationDate]);
    }

    /**
     * Bulk update asset depreciation values
     * @param {Array} assets - Array of assets with updated values
     * @returns {Promise<Object>} Update result
     */
    static async bulkUpdateAssetDepreciation(assets) {
        const dbPool = getDb();

        const client = await dbPool.connect();
        
        try {
            await client.query('BEGIN');
            
            const results = [];
            
            for (const asset of assets) {
                const query = `
                    UPDATE "tblAssets" 
                    SET 
                        current_book_value = $1,
                        accumulated_depreciation = $2,
                        last_depreciation_calc_date = $3,
                        depreciation_rate = $4,
                        changed_by = $5,
                        changed_on = CURRENT_TIMESTAMP
                    WHERE asset_id = $6
                    RETURNING *
                `;

                const values = [
                    asset.current_book_value,
                    asset.accumulated_depreciation,
                    asset.last_depreciation_calc_date,
                    asset.depreciation_rate,
                    asset.changed_by,
                    asset.asset_id
                ];

                const result = await client.query(query, values);
                results.push(result.rows[0]);
            }
            
            await client.query('COMMIT');
            return results;
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = DepreciationModel;
