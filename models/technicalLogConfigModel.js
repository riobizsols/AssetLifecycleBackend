const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


class TechnicalLogConfigModel {
    /**
     * Get log configuration for a specific app
     * @param {string} appId - Application/module ID
     * @returns {Promise<Object|null>} Log configuration object
     */
    static async getLogConfig(appId) {
        try {
            const query = `
                SELECT id, app_id, log_level, enabled, created_on, updated_on
                FROM "tblTechnicalLogConfig" 
                WHERE app_id = $1
            `;
            const dbPool = getDb();

            const result = await dbPool.query(query, [appId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting technical log config:', error);
            throw error;
        }
    }

    /**
     * Get all log configurations
     * @returns {Promise<Array>} Array of all log configurations
     */
    static async getAllLogConfigs() {
        try {
            const query = `
                SELECT id, app_id, log_level, enabled, created_on, updated_on
                FROM "tblTechnicalLogConfig" 
                ORDER BY app_id ASC
            `;
            const dbPool = getDb();

            const result = await dbPool.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error getting all technical log configs:', error);
            throw error;
        }
    }

    /**
     * Update log configuration for an app
     * @param {Object} configData - Configuration data
     * @param {string} configData.app_id - App ID
     * @param {string} configData.log_level - Log level (INFO, WARNING, ERROR, CRITICAL, NONE)
     * @param {boolean} configData.enabled - Whether logging is enabled
     * @returns {Promise<Object>} Updated configuration object
     */
    static async updateLogConfig(configData) {
        try {
            const { app_id, log_level, enabled } = configData;
            
            const query = `
                UPDATE "tblTechnicalLogConfig" 
                SET log_level = $2, 
                    enabled = $3,
                    updated_on = CURRENT_TIMESTAMP
                WHERE app_id = $1
                RETURNING *
            `;
            
            const dbPool = getDb();

            
            const result = await dbPool.query(query, [app_id, log_level, enabled]);
            
            if (result.rows.length === 0) {
                throw new Error(`App ID '${app_id}' not found in technical log configuration`);
            }
            
            return result.rows[0];
        } catch (error) {
            console.error('Error updating technical log config:', error);
            throw error;
        }
    }

    /**
     * Create or update log configuration for an app
     * @param {Object} configData - Configuration data
     * @returns {Promise<Object>} Configuration object
     */
    static async upsertLogConfig(configData) {
        try {
            const { app_id, log_level, enabled } = configData;
            
            const query = `
                INSERT INTO "tblTechnicalLogConfig" (app_id, log_level, enabled)
                VALUES ($1, $2, $3)
                ON CONFLICT (app_id) 
                DO UPDATE SET 
                    log_level = EXCLUDED.log_level,
                    enabled = EXCLUDED.enabled,
                    updated_on = CURRENT_TIMESTAMP
                RETURNING *
            `;
            
            const dbPool = getDb();

            
            const result = await dbPool.query(query, [app_id, log_level, enabled]);
            return result.rows[0];
        } catch (error) {
            console.error('Error upserting technical log config:', error);
            throw error;
        }
    }

    /**
     * Check if logging is enabled for an app and meets the log level requirement
     * @param {string} appId - Application/module ID
     * @param {number} requiredLevel - Required log level code (0-4)
     * @returns {Promise<boolean>} Whether to log this event
     */
    static async shouldLog(appId, requiredLevel = 0) {
        try {
            const config = await this.getLogConfig(appId);
            if (!config || !config.enabled) {
                return false;
            }
            
            // Get the configured log level code from the text value
            const configuredLevelCode = this.getLogLevelCode(config.log_level);
            
            // Hierarchical logging: Log if event level >= configured level
            // INFO (0) logs everything, WARNING (1) logs WARNING+ERROR+CRITICAL, etc.
            return requiredLevel >= configuredLevelCode;
        } catch (error) {
            console.error('Error checking if should log:', error);
            return false; // Default to not logging on error
        }
    }

    /**
     * Get log level code from level name
     * @param {string} levelName - Level name (INFO, WARNING, ERROR, CRITICAL, NONE)
     * @returns {number} Level code (0-4)
     */
    static getLogLevelCode(levelName) {
        const levelMap = {
            'INFO': 0,
            'WARNING': 1,
            'ERROR': 2,
            'CRITICAL': 3,
            'NONE': 4
        };
        return levelMap[levelName?.toUpperCase()] ?? 2; // Default to ERROR
    }

    /**
     * Get log level name from level code
     * @param {number} levelCode - Level code (0-4)
     * @returns {string} Level name
     */
    static getLogLevelName(levelCode) {
        const codeMap = {
            0: 'INFO',
            1: 'WARNING',
            2: 'ERROR',
            3: 'CRITICAL',
            4: 'NONE'
        };
        return codeMap[levelCode] ?? 'ERROR';
    }
}

module.exports = TechnicalLogConfigModel;
