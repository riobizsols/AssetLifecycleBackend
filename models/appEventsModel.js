const db = require('../config/db');

class AppEventsModel {
    /**
     * Get enabled events for a specific app
     * @param {string} appId - The app ID from tblApps table
     * @returns {Promise<Array>} Array of enabled events with event details
     */
    static async getEnabledEventsForApp(appId) {
        try {
            const query = `
                SELECT 
                    e.event_id,
                    e.text as event_text,
                    alc.enabled,
                    alc.reporting_required,
                    alc.reporting_email,
                    alc.description as config_description
                FROM "tblAuditLogConfig" alc
                INNER JOIN "tblEvents" e ON alc.event_id = e.event_id
                WHERE alc.app_id = $1 
                AND alc.enabled = true
                ORDER BY e.text ASC
            `;
            
            const result = await db.query(query, [appId]);
            return result.rows;
        } catch (error) {
            console.error('Error in getEnabledEventsForApp:', error);
            throw error;
        }
    }

    /**
     * Get all events for a specific app (both enabled and disabled)
     * @param {string} appId - The app ID from tblApps table
     * @returns {Promise<Array>} Array of all events with their configuration
     */
    static async getAllEventsForApp(appId) {
        try {
            const query = `
                SELECT 
                    e.event_id,
                    e.text as event_text,
                    alc.enabled,
                    alc.reporting_required,
                    alc.reporting_email,
                    alc.description as config_description
                FROM "tblAuditLogConfig" alc
                INNER JOIN "tblEvents" e ON alc.event_id = e.event_id
                WHERE alc.app_id = $1
                ORDER BY e.text ASC
            `;
            
            const result = await db.query(query, [appId]);
            return result.rows;
        } catch (error) {
            console.error('Error in getAllEventsForApp:', error);
            throw error;
        }
    }

    /**
     * Get app information
     * @param {string} appId - The app ID
     * @returns {Promise<Object>} App information
     */
    static async getAppInfo(appId) {
        try {
            const query = `
                SELECT 
                    app_id,
                    text as app_name,
                    int_status,
                    org_id
                FROM "tblApps"
                WHERE app_id = $1
            `;
            
            const result = await db.query(query, [appId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error in getAppInfo:', error);
            throw error;
        }
    }

    /**
     * Get all available apps
     * @returns {Promise<Array>} Array of all apps
     */
    static async getAllApps() {
        try {
            const query = `
                SELECT 
                    app_id,
                    text as app_name,
                    int_status,
                    org_id
                FROM "tblApps"
                WHERE int_status = true
                ORDER BY text ASC
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error in getAllApps:', error);
            throw error;
        }
    }

    /**
     * Get all available events
     * @returns {Promise<Array>} Array of all events
     */
    static async getAllEvents() {
        try {
            const query = `
                SELECT 
                    event_id,
                    text as event_text
                FROM "tblEvents"
                ORDER BY text ASC
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error in getAllEvents:', error);
            throw error;
        }
    }

    /**
     * Get all unique events directly from tblEvents table
     * @returns {Promise<Array>} Array of unique events
     */
    static async getUniqueEvents() {
        try {
            const query = `
                SELECT DISTINCT
                    event_id,
                    text as event_text
                FROM "tblEvents"
                ORDER BY text ASC
            `;
            
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            console.error('Error in getUniqueEvents:', error);
            throw error;
        }
    }
}

module.exports = AppEventsModel;
