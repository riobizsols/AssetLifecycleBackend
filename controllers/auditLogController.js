const AuditLogModel = require('../models/auditLogModel');

class AuditLogController {
    /**
     * Record a user action (only if event is enabled)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async recordUserAction(req, res) {
        try {
            const { app_id, event_id, text } = req.body;
            const user_id = req.user.user_id;
            const org_id = req.user.org_id;

            // Validate required fields
            if (!app_id || !event_id || !text) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: app_id, event_id, and text are required',
                    data: null
                });
            }

            // Record the user action (this will check if event is enabled)
            const result = await AuditLogModel.recordUserAction({
                user_id,
                app_id,
                event_id,
                text,
                org_id
            });

            if (result.recorded) {
                res.status(201).json({
                    success: true,
                    message: result.message,
                    data: {
                        audit_log: result.data,
                        event_config: result.event_config
                    }
                });
            } else {
                res.status(200).json({
                    success: false,
                    message: result.message,
                    data: null,
                    recorded: false
                });
            }

        } catch (error) {
            console.error('Error in recordUserAction controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while recording user action',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get audit logs for the current user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getUserAuditLogs(req, res) {
        try {
            const user_id = req.user.user_id;
            const { 
                limit = 50, 
                offset = 0, 
                app_id, 
                event_id 
            } = req.query;

            // Validate limit and offset
            const parsedLimit = parseInt(limit);
            const parsedOffset = parseInt(offset);

            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid limit. Must be between 1 and 1000',
                    data: null
                });
            }

            if (isNaN(parsedOffset) || parsedOffset < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid offset. Must be 0 or greater',
                    data: null
                });
            }

            const auditLogs = await AuditLogModel.getUserAuditLogs(user_id, {
                limit: parsedLimit,
                offset: parsedOffset,
                app_id,
                event_id
            });

            const response = {
                success: true,
                message: `Found ${auditLogs.length} audit log entries for user`,
                data: {
                    user_id,
                    audit_logs: auditLogs,
                    pagination: {
                        limit: parsedLimit,
                        offset: parsedOffset,
                        count: auditLogs.length
                    }
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getUserAuditLogs controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching user audit logs',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get audit logs for a specific app
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAppAuditLogs(req, res) {
        try {
            const { appId } = req.params;
            const { 
                limit = 50, 
                offset = 0, 
                user_id, 
                event_id 
            } = req.query;

            // Validate appId
            if (!appId) {
                return res.status(400).json({
                    success: false,
                    message: 'App ID is required',
                    data: null
                });
            }

            // Validate limit and offset
            const parsedLimit = parseInt(limit);
            const parsedOffset = parseInt(offset);

            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid limit. Must be between 1 and 1000',
                    data: null
                });
            }

            if (isNaN(parsedOffset) || parsedOffset < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid offset. Must be 0 or greater',
                    data: null
                });
            }

            const auditLogs = await AuditLogModel.getAppAuditLogs(appId, {
                limit: parsedLimit,
                offset: parsedOffset,
                user_id,
                event_id
            });

            const response = {
                success: true,
                message: `Found ${auditLogs.length} audit log entries for app '${appId}'`,
                data: {
                    app_id: appId,
                    audit_logs: auditLogs,
                    pagination: {
                        limit: parsedLimit,
                        offset: parsedOffset,
                        count: auditLogs.length
                    }
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getAppAuditLogs controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching app audit logs',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get audit log statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAuditLogStats(req, res) {
        try {
            const { 
                app_id, 
                user_id, 
                event_id, 
                date_from, 
                date_to 
            } = req.query;

            // Validate date format if provided
            if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date_from format. Use YYYY-MM-DD',
                    data: null
                });
            }

            if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date_to format. Use YYYY-MM-DD',
                    data: null
                });
            }

            const stats = await AuditLogModel.getAuditLogStats({
                app_id,
                user_id,
                event_id,
                date_from,
                date_to
            });

            const response = {
                success: true,
                message: 'Audit log statistics retrieved successfully',
                data: {
                    statistics: stats,
                    filters: {
                        app_id,
                        user_id,
                        event_id,
                        date_from,
                        date_to
                    }
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getAuditLogStats controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching audit log statistics',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Check if an event is enabled for an app
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async checkEventEnabled(req, res) {
        try {
            const { appId, eventId } = req.params;

            if (!appId || !eventId) {
                return res.status(400).json({
                    success: false,
                    message: 'Both appId and eventId are required',
                    data: null
                });
            }

            const eventConfig = await AuditLogModel.isEventEnabled(appId, eventId);

            if (eventConfig) {
                res.status(200).json({
                    success: true,
                    message: `Event '${eventId}' is enabled for app '${appId}'`,
                    data: {
                        enabled: true,
                        event_config: eventConfig
                    }
                });
            } else {
                res.status(200).json({
                    success: false,
                    message: `Event '${eventId}' is not enabled for app '${appId}'`,
                    data: {
                        enabled: false,
                        event_config: null
                    }
                });
            }

        } catch (error) {
            console.error('Error in checkEventEnabled controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while checking event status',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = AuditLogController;
