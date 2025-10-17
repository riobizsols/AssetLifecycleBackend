const fs = require('fs');
const path = require('path');
const TechnicalLogConfigModel = require('../models/technicalLogConfigModel');
const cron = require('node-cron');

/**
 * Event Logger Service
 * Centralized service for technical event logging to CSV files
 * Separate from audit logs - for developer/internal purposes
 */

class EventLogger {
    constructor() {
        this.logDirectory = path.join(__dirname, '../logs/events');
        this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        this.fileRetentionDays = 10;
        
        // Ensure log directory exists
        this.ensureLogDirectory();
        
        // Setup daily file rotation at midnight (00:00)
        this.setupFileRotation();
        
        // Setup daily cleanup of old files
        this.setupFileCleanup();
    }

    /**
     * Ensure log directory exists
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDirectory)) {
            fs.mkdirSync(this.logDirectory, { recursive: true });
        }
    }

    /**
     * Get log file path for specific app_id
     * Creates file with headers if it doesn't exist
     * @param {string} appId - Application/module ID
     * @returns {string} Full path to log file
     */
    getLogFileForApp(appId) {
        const fileName = `events_${appId}_${this.currentDate}.csv`;
        const filePath = path.join(this.logDirectory, fileName);
        
        // Create file with headers if it doesn't exist
        if (!fs.existsSync(filePath)) {
            const headers = 'Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID\n';
            fs.writeFileSync(filePath, headers, 'utf8');
        }
        
        return filePath;
    }

    /**
     * Check if event should be logged based on configuration
     * @param {string} appId - Application/module ID
     * @param {string} eventLevel - Event level (INFO, WARNING, ERROR, CRITICAL)
     * @returns {Promise<boolean>} Whether to log this event
     */
    async shouldLog(appId, eventLevel) {
        try {
            const requiredLevel = TechnicalLogConfigModel.getLogLevelCode(eventLevel);
            return await TechnicalLogConfigModel.shouldLog(appId, requiredLevel);
        } catch (error) {
            console.error('Error checking if should log:', error);
            return false;
        }
    }

    /**
     * Log event to CSV file
     * @param {Object} logData - Event data to log
     */
    async logEvent(logData) {
        const {
            appId,
            eventType,
            module,
            message,
            logLevel = 'INFO',
            requestData = null,
            responseData = null,
            duration = null,
            userId = null
        } = logData;

        try {
            // Check if this event should be logged
            const shouldLog = await this.shouldLog(appId, logLevel);
            if (!shouldLog) return;

            const timestamp = new Date().toISOString();
            
            // Format data field to safely include in CSV
            const formatDataForCSV = (data) => {
                if (!data) return 'N/A';
                try {
                    const jsonStr = JSON.stringify(data);
                    return `"${jsonStr.replace(/"/g, '""')}"`; // Escape quotes for CSV
                } catch (error) {
                    return `"${String(data).replace(/"/g, '""')}"`;
                }
            };

            // Create CSV row
            const csvRow = [
                timestamp,
                logLevel,
                eventType || 'UNKNOWN',
                module || 'UNKNOWN',
                `"${(message || '').replace(/"/g, '""')}"`, // Escape quotes
                formatDataForCSV(requestData),
                formatDataForCSV(responseData),
                duration || 'N/A',
                userId || 'N/A'
            ].join(',') + '\n';

            // Get app-specific log file and append
            const logFile = this.getLogFileForApp(appId);
            fs.appendFileSync(logFile, csvRow, 'utf8');

        } catch (error) {
            console.error('Error logging event:', error);
            // Don't throw error to avoid affecting main application flow
        }
    }

    /**
     * Log API call event
     * @param {Object} options - API call logging options
     */
    async logApiCall(options) {
        const {
            appId,
            method,
            url,
            statusCode,
            requestBody = null,
            responseBody = null,
            duration,
            userId = null,
            error = null
        } = options;

        let logLevel = 'INFO';
        let message = `${method} ${url}`;
        
        // Determine log level based on status code
        if (statusCode >= 500) {
            logLevel = 'CRITICAL';
            message += ` - Server Error (${statusCode})`;
        } else if (statusCode >= 400) {
            logLevel = 'ERROR';
            message += ` - Client Error (${statusCode})`;
        } else if (statusCode >= 300) {
            logLevel = 'WARNING';
            message += ` - Redirect (${statusCode})`;
        } else {
            logLevel = 'INFO';
            message += ` - Success (${statusCode})`;
        }

        // If there's an error, log as ERROR level
        if (error) {
            logLevel = 'ERROR';
            message += ` - Error: ${error.message}`;
        }

        await this.logEvent({
            appId,
            eventType: 'API_CALL',
            module: 'API',
            message,
            logLevel,
            requestData: requestBody,
            responseData: responseBody,
            duration,
            userId
        });
    }

    /**
     * Log database call event
     * @param {Object} options - Database call logging options
     */
    async logDbCall(options) {
        const {
            appId,
            query,
            duration,
            rowCount = null,
            error = null,
            userId = null
        } = options;

        let logLevel = 'INFO';
        let message = `Database Query - ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`;
        
        if (error) {
            logLevel = 'ERROR';
            message += ` - Error: ${error.message}`;
        } else {
            message += ` - ${rowCount || '0'} rows affected`;
        }

        await this.logEvent({
            appId,
            eventType: 'DB_QUERY',
            module: 'DATABASE',
            message,
            logLevel,
            requestData: { query: query.substring(0, 200) }, // Limit query length
            responseData: { rowCount, error: error?.message },
            duration,
            userId
        });
    }

    /**
     * Log login event
     * @param {Object} options - Login event options
     */
    async logLogin(options) {
        const {
            appId = 'LOGIN',
            email,
            success,
            userId = null,
            error = null,
            duration = null
        } = options;

        let logLevel = 'INFO';
        let message = `User ${success ? 'successfully logged in' : 'failed to login'}`;
        
        if (success) {
            logLevel = 'INFO';
            message += ` with email: ${email}`;
        } else {
            logLevel = 'WARNING';
            message += ` with email: ${email}`;
            if (error) {
                message += ` - Reason: ${error.message || error}`;
            }
        }

        await this.logEvent({
            appId,
            eventType: 'LOGIN',
            module: 'AUTH',
            message,
            logLevel,
            requestData: { email },
            responseData: { success, error: error?.message },
            duration,
            userId
        });
    }

    /**
     * Setup daily file rotation at midnight
     */
    setupFileRotation() {
        // Run every minute to check if date has changed
        cron.schedule('* * * * *', () => {
            const newDate = new Date().toISOString().split('T')[0];
            if (newDate !== this.currentDate) {
                this.currentDate = newDate;
                // Date changed - new files will be created automatically per app_id
            }
        });
    }

    /**
     * Setup daily cleanup of old files
     */
    setupFileCleanup() {
        // Run cleanup at 2 AM daily
        cron.schedule('0 2 * * *', () => {
            this.cleanupOldFiles();
        });
    }

    /**
     * Clean up log files older than retention period
     */
    cleanupOldFiles() {
        try {
            const files = fs.readdirSync(this.logDirectory);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.fileRetentionDays);

            files.forEach(file => {
                if (file.startsWith('events_') && file.endsWith('.csv')) {
                    const filePath = path.join(this.logDirectory, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old log file: ${file}`);
                    }
                }
            });
        } catch (error) {
            console.error('Error cleaning up log files:', error);
        }
    }
}

// Create singleton instance
const eventLogger = new EventLogger();

module.exports = eventLogger;
