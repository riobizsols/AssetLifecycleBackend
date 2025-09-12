const AuditLogConfigModel = require('../models/auditLogConfigModel');

class AuditLogConfigController {
  // Get all audit log configurations
  static async getAll(req, res) {
    try {
      const configs = await AuditLogConfigModel.getAll();
      
      res.status(200).json({
        success: true,
        message: 'Audit log configurations retrieved successfully',
        data: configs
      });
    } catch (error) {
      console.error('Error in getAll audit log configs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log configurations',
        error: error.message
      });
    }
  }

  // Get audit log configuration by ID
  static async getById(req, res) {
    try {
      const { alcId } = req.params;
      
      if (!alcId) {
        return res.status(400).json({
          success: false,
          message: 'ALC ID is required'
        });
      }

      const config = await AuditLogConfigModel.getById(alcId);
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Audit log configuration not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Audit log configuration retrieved successfully',
        data: config
      });
    } catch (error) {
      console.error('Error in getById audit log config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log configuration',
        error: error.message
      });
    }
  }

  // Update audit log configuration
  static async update(req, res) {
    try {
      const { alcId } = req.params;
      const { reporting_required, enabled, reporting_email } = req.body;
      
      if (!alcId) {
        return res.status(400).json({
          success: false,
          message: 'ALC ID is required'
        });
      }

      // Check if configuration exists
      const existingConfig = await AuditLogConfigModel.getById(alcId);
      if (!existingConfig) {
        return res.status(404).json({
          success: false,
          message: 'Audit log configuration not found'
        });
      }

      let updatedConfig = existingConfig;

      // Update reporting required if provided
      if (typeof reporting_required === 'boolean') {
        updatedConfig = await AuditLogConfigModel.updateReportingRequired(alcId, reporting_required);
      }

      // Update enabled status if provided
      if (typeof enabled === 'boolean') {
        updatedConfig = await AuditLogConfigModel.updateEnabled(alcId, enabled);
      }

      // Update reporting email if provided
      if (reporting_email) {
        updatedConfig = await AuditLogConfigModel.updateReportingEmail(alcId, reporting_email);
      }

      res.status(200).json({
        success: true,
        message: 'Audit log configuration updated successfully',
        data: updatedConfig
      });
    } catch (error) {
      console.error('Error in update audit log config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update audit log configuration',
        error: error.message
      });
    }
  }

  // Get configurations by app ID
  static async getByAppId(req, res) {
    try {
      const { appId } = req.params;
      
      if (!appId) {
        return res.status(400).json({
          success: false,
          message: 'App ID is required'
        });
      }

      const configs = await AuditLogConfigModel.getByAppId(appId);
      
      res.status(200).json({
        success: true,
        message: `Audit log configurations for app ${appId} retrieved successfully`,
        data: configs
      });
    } catch (error) {
      console.error('Error in getByAppId audit log config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit log configurations for app',
        error: error.message
      });
    }
  }
}

module.exports = AuditLogConfigController;
