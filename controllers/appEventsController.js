const AppEventsModel = require('../models/appEventsModel');

class AppEventsController {
    /**
     * Get enabled events for a specific app
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getEnabledEventsForApp(req, res) {
        try {
            const { appId } = req.params;

            // Validate appId parameter
            if (!appId) {
                return res.status(400).json({
                    success: false,
                    message: 'App ID is required',
                    data: null
                });
            }

            // Get app information first to validate if app exists
            const appInfo = await AppEventsModel.getAppInfo(appId);
            if (!appInfo) {
                return res.status(404).json({
                    success: false,
                    message: `App with ID '${appId}' not found`,
                    data: null
                });
            }

            // Get enabled events for the app
            const enabledEvents = await AppEventsModel.getEnabledEventsForApp(appId);

            // Format the response
            const response = {
                success: true,
                message: `Found ${enabledEvents.length} enabled events for app '${appInfo.app_name}'`,
                data: {
                    app: {
                        app_id: appInfo.app_id,
                        app_name: appInfo.app_name,
                        org_id: appInfo.org_id
                    },
                    enabled_events: enabledEvents.map(event => ({
                        event_id: event.event_id,
                        text: event.event_text,
                        enabled: event.enabled,
                        reporting_required: event.reporting_required,
                        reporting_email: event.reporting_email,
                        config_description: event.config_description
                    }))
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getEnabledEventsForApp controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching enabled events',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get all events for a specific app (both enabled and disabled)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAllEventsForApp(req, res) {
        try {
            const { appId } = req.params;

            // Validate appId parameter
            if (!appId) {
                return res.status(400).json({
                    success: false,
                    message: 'App ID is required',
                    data: null
                });
            }

            // Get app information first to validate if app exists
            const appInfo = await AppEventsModel.getAppInfo(appId);
            if (!appInfo) {
                return res.status(404).json({
                    success: false,
                    message: `App with ID '${appId}' not found`,
                    data: null
                });
            }

            // Get all events for the app
            const allEvents = await AppEventsModel.getAllEventsForApp(appId);

            // Separate enabled and disabled events
            const enabledEvents = allEvents.filter(event => event.enabled);
            const disabledEvents = allEvents.filter(event => !event.enabled);

            // Format the response
            const response = {
                success: true,
                message: `Found ${allEvents.length} total events for app '${appInfo.app_name}' (${enabledEvents.length} enabled, ${disabledEvents.length} disabled)`,
                data: {
                    app: {
                        app_id: appInfo.app_id,
                        app_name: appInfo.app_name,
                        org_id: appInfo.org_id
                    },
                    enabled_events: enabledEvents.map(event => ({
                        event_id: event.event_id,
                        text: event.event_text,
                        enabled: event.enabled,
                        reporting_required: event.reporting_required,
                        reporting_email: event.reporting_email,
                        config_description: event.config_description
                    })),
                    disabled_events: disabledEvents.map(event => ({
                        event_id: event.event_id,
                        text: event.event_text,
                        enabled: event.enabled,
                        reporting_required: event.reporting_required,
                        reporting_email: event.reporting_email,
                        config_description: event.config_description
                    }))
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getAllEventsForApp controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching all events',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get all available apps
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAllApps(req, res) {
        try {
            const apps = await AppEventsModel.getAllApps();

            const response = {
                success: true,
                message: `Found ${apps.length} available apps`,
                data: {
                    apps: apps.map(app => ({
                        app_id: app.app_id,
                        app_name: app.app_name,
                        org_id: app.org_id,
                        status: app.int_status
                    }))
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getAllApps controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching apps',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }

    /**
     * Get all available events
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAllEvents(req, res) {
        try {
            const events = await AppEventsModel.getAllEvents();

            const response = {
                success: true,
                message: `Found ${events.length} available events`,
                data: {
                    events: events.map(event => ({
                        event_id: event.event_id,
                        text: event.event_text
                    }))
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('Error in getAllEvents controller:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error while fetching events',
                data: null,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = AppEventsController;
