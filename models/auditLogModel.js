const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


class AuditLogModel {
    /**
     * Generate a sequential ID in format AL001, AL002, etc.
     * @returns {Promise<string>} Generated sequential ID
     */
    static async generateSequentialId() {
        try {
            // Get the highest existing al_id that matches the new format (AL001, AL002, etc.)
            const dbPool = getDb();

            const result = await dbPool.query(`
                SELECT al_id 
                FROM "tblAuditLogs" 
                WHERE al_id ~ '^AL[0-9]{3}$'
                ORDER BY CAST(SUBSTRING(al_id FROM 3) AS INTEGER) DESC 
                LIMIT 1
            `);
            
            let nextNumber = 1;
            if (result.rows.length > 0) {
                const lastId = result.rows[0].al_id;
                const lastNumber = parseInt(lastId.substring(2));
                nextNumber = lastNumber + 1;
            }
            
            // Format as AL001, AL002, etc. (pad with zeros to 3 digits)
            return `AL${nextNumber.toString().padStart(3, '0')}`;
        } catch (error) {
            console.error('Error in generateSequentialId:', error);
            // Fallback to timestamp-based ID if sequential generation fails
            return 'AL' + Date.now().toString().slice(-6);
        }
    }

    /**
     * Check if an event is enabled for a specific app
     * @param {string} appId - The app ID
     * @param {string} eventId - The event ID
     * @returns {Promise<Object|null>} Configuration object if enabled, null if disabled
     */
    static async isEventEnabled(appId, eventId) {
        try {
            const query = `
                SELECT 
                    alc_id,
                    app_id,
                    event_id,
                    enabled,
                    reporting_required,
                    description
                FROM "tblAuditLogConfig"
                WHERE app_id = $1 
                AND event_id = $2 
                AND enabled = true
            `;
            
            const dbPool = getDb();

            
            const result = await dbPool.query(query, [appId, eventId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in isEventEnabled:', error);
            throw error;
        }
    }

    /**
     * Record an audit log entry
     * @param {Object} auditData - The audit log data
     * @param {string} auditData.user_id - User ID
     * @param {string} auditData.app_id - App ID
     * @param {string} auditData.event_id - Event ID
     * @param {string} auditData.text - Event description
     * @param {string} auditData.org_id - Organization ID
     * @returns {Promise<Object>} Created audit log entry
     */
    static async createAuditLog(auditData) {
        try {
            const { user_id, app_id, event_id, text, org_id } = auditData;
            // Generate a sequential ID in format AL001, AL002, etc.
            const al_id = await this.generateSequentialId();
            
            // Truncate text if it's too long (max 100 characters)
            const truncatedText = text.length > 100 ? text.substring(0, 97) + '...' : text;
            

            const query = `
                INSERT INTO "tblAuditLogs" (
                    al_id,
                    user_id,
                    app_id,
                    event_id,
                    text,
                    created_on,
                    org_id
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
                RETURNING *
            `;
            
            const dbPool = getDb();

            
            const result = await dbPool.query(query, [al_id, user_id, app_id, event_id, truncatedText, org_id]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in createAuditLog:', error);
            throw error;
        }
    }

    /**
     * Record user action with event validation
     * @param {Object} actionData - The action data
     * @param {string} actionData.user_id - User ID
     * @param {string} actionData.app_id - App ID
     * @param {string} actionData.event_id - Event ID
     * @param {string} actionData.text - Event description
     * @param {string} actionData.org_id - Organization ID
     * @returns {Promise<Object>} Result object with success status and data
     */
    static async recordUserAction(actionData) {
        try {
            const { user_id, app_id, event_id, text, org_id } = actionData;
            
            // First, check if the event is enabled for this app
            const eventConfig = await this.isEventEnabled(app_id, event_id);
            
            if (!eventConfig) {
                return {
                    success: false,
                    message: `Event '${event_id}' is not enabled for app '${app_id}'`,
                    data: null,
                    recorded: false
                };
            }

            // If enabled, record the audit log
            const auditLog = await this.createAuditLog({
                user_id,
                app_id,
                event_id,
                text,
                org_id
            });

            return {
                success: true,
                message: 'User action recorded successfully',
                data: auditLog,
                recorded: true,
                event_config: eventConfig
            };

        } catch (error) {
            console.error('Error in recordUserAction:', error);
            throw error;
        }
    }

    /**
     * Get audit logs for a specific user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of records to return
     * @param {number} options.offset - Number of records to skip
     * @param {string} options.app_id - Filter by app ID
     * @param {string} options.event_id - Filter by event ID
     * @returns {Promise<Array>} Array of audit log entries
     */
    static async getUserAuditLogs(userId, options = {}) {
        try {
            const { limit = 50, offset = 0, app_id, event_id } = options;
            
            let query = `
                SELECT 
                    al.al_id,
                    al.user_id,
                    al.app_id,
                    al.event_id,
                    al.text,
                    al.created_on,
                    al.org_id,
                    a.text as app_name,
                    e.text as event_name
                FROM "tblAuditLogs" al
                LEFT JOIN "tblApps" a ON al.app_id = a.app_id
                LEFT JOIN "tblEvents" e ON al.event_id = e.event_id
                WHERE al.user_id = $1
            `;
            
            const queryParams = [userId];
            let paramCount = 1;

            if (app_id) {
                paramCount++;
                query += ` AND al.app_id = $${paramCount}`;
                queryParams.push(app_id);
            }

            if (event_id) {
                paramCount++;
                query += ` AND al.event_id = $${paramCount}`;
                queryParams.push(event_id);
            }

            query += ` ORDER BY al.created_on DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            queryParams.push(limit, offset);

            const dbPool = getDb();


            const result = await dbPool.query(query, queryParams);
            return result.rows;
        } catch (error) {
            console.error('Error in getUserAuditLogs:', error);
            throw error;
        }
    }

    /**
     * Get audit logs for a specific app
     * @param {string} appId - App ID
     * @param {Object} options - Query options
     * @param {number} options.limit - Number of records to return
     * @param {number} options.offset - Number of records to skip
     * @param {string} options.user_id - Filter by user ID
     * @param {string} options.event_id - Filter by event ID
     * @returns {Promise<Array>} Array of audit log entries
     */
    static async getAppAuditLogs(appId, options = {}) {
        try {
            const { limit = 50, offset = 0, user_id, event_id } = options;
            
            let query = `
                SELECT 
                    al.al_id,
                    al.user_id,
                    al.app_id,
                    al.event_id,
                    al.text,
                    al.created_on,
                    al.org_id,
                    a.text as app_name,
                    e.text as event_name
                FROM "tblAuditLogs" al
                LEFT JOIN "tblApps" a ON al.app_id = a.app_id
                LEFT JOIN "tblEvents" e ON al.event_id = e.event_id
                WHERE al.app_id = $1
            `;
            
            const queryParams = [appId];
            let paramCount = 1;

            if (user_id) {
                paramCount++;
                query += ` AND al.user_id = $${paramCount}`;
                queryParams.push(user_id);
            }

            if (event_id) {
                paramCount++;
                query += ` AND al.event_id = $${paramCount}`;
                queryParams.push(event_id);
            }

            query += ` ORDER BY al.created_on DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            queryParams.push(limit, offset);

            const dbPool = getDb();


            const result = await dbPool.query(query, queryParams);
            return result.rows;
        } catch (error) {
            console.error('Error in getAppAuditLogs:', error);
            throw error;
        }
    }

    /**
     * Get audit log statistics
     * @param {Object} options - Query options
     * @param {string} options.app_id - Filter by app ID
     * @param {string} options.user_id - Filter by user ID
     * @param {string} options.event_id - Filter by event ID
     * @param {string} options.date_from - Start date (YYYY-MM-DD)
     * @param {string} options.date_to - End date (YYYY-MM-DD)
     * @returns {Promise<Object>} Statistics object
     */
    static async getAuditLogStats(options = {}) {
        try {
            const { app_id, user_id, event_id, date_from, date_to } = options;
            
            let query = `
                SELECT 
                    COUNT(*) as total_actions,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT app_id) as unique_apps,
                    COUNT(DISTINCT event_id) as unique_events
                FROM "tblAuditLogs"
                WHERE 1=1
            `;
            
            const queryParams = [];
            let paramCount = 0;

            if (app_id) {
                paramCount++;
                query += ` AND app_id = $${paramCount}`;
                queryParams.push(app_id);
            }

            if (user_id) {
                paramCount++;
                query += ` AND user_id = $${paramCount}`;
                queryParams.push(user_id);
            }

            if (event_id) {
                paramCount++;
                query += ` AND event_id = $${paramCount}`;
                queryParams.push(event_id);
            }

            if (date_from) {
                paramCount++;
                query += ` AND created_on >= $${paramCount}`;
                queryParams.push(date_from);
            }

            if (date_to) {
                paramCount++;
                query += ` AND created_on <= $${paramCount}`;
                queryParams.push(date_to);
            }

            const dbPool = getDb();


            const result = await dbPool.query(query, queryParams);
            return result.rows[0];
        } catch (error) {
            console.error('Error in getAuditLogStats:', error);
            throw error;
        }
    }

    /**
     * Get all audit logs with filtering and pagination
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Audit logs with pagination info
     */
    static async getAllAuditLogs(filters) {
        try {
            const { org_id, app_id, event_id, user_id, start_date, end_date, page, limit } = filters;
            
            // Build WHERE clause for filtering
            let whereConditions = ['al.org_id = $1'];
            let queryParams = [org_id];
            let paramIndex = 2;

            if (app_id) {
                whereConditions.push(`al.app_id = $${paramIndex}`);
                queryParams.push(app_id);
                paramIndex++;
            }

            if (event_id) {
                whereConditions.push(`al.event_id = $${paramIndex}`);
                queryParams.push(event_id);
                paramIndex++;
            }

            if (user_id) {
                whereConditions.push(`al.user_id = $${paramIndex}`);
                queryParams.push(user_id);
                paramIndex++;
            }

            if (start_date) {
                whereConditions.push(`al.created_on >= $${paramIndex}`);
                queryParams.push(start_date);
                paramIndex++;
            }

            if (end_date) {
                whereConditions.push(`al.created_on <= $${paramIndex}`);
                queryParams.push(end_date);
                paramIndex++;
            }

            const whereClause = whereConditions.join(' AND ');

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) as total_count
                FROM "tblAuditLogs" al
                WHERE ${whereClause}
            `;
            const dbPool = getDb();

            const countResult = await dbPool.query(countQuery, queryParams);
            const total_count = parseInt(countResult.rows[0].total_count);

            // Calculate offset for pagination
            const offset = (page - 1) * limit;

            // Get audit logs with pagination and joins for readable names
            const auditLogsQuery = `
                SELECT 
                    al.al_id,
                    al.user_id,
                    al.app_id,
                    al.event_id,
                    al.text,
                    al.created_on,
                    al.org_id,
                    u.full_name as user_name,
                    u.email as user_email,
                    a.text as app_name,
                    e.text as event_name
                FROM "tblAuditLogs" al
                LEFT JOIN "tblUsers" u ON al.user_id = u.user_id
                LEFT JOIN "tblApps" a ON al.app_id = a.app_id
                LEFT JOIN "tblEvents" e ON al.event_id = e.event_id
                WHERE ${whereClause}
                ORDER BY al.created_on DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            
            queryParams.push(limit, offset);
            const auditLogsResult = await dbPool.query(auditLogsQuery, queryParams);

            return {
                audit_logs: auditLogsResult.rows,
                total_count
            };
        } catch (error) {
            console.error('Error in getAllAuditLogs:', error);
            throw error;
        }
    }
}

module.exports = AuditLogModel;
