const InspectionFrequencyModel = require('../models/inspectionFrequencyModel');

class InspectionFrequencyController {
  static async getAllInspectionFrequencies(req, res) {
    try {
      const orgId = req.user.org_id;
      const frequencies = await InspectionFrequencyModel.getAllInspectionFrequencies(orgId);
      
      res.json({
        success: true,
        data: frequencies
      });
    } catch (error) {
      console.error('Error in getAllInspectionFrequencies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inspection frequencies',
        error: error.message
      });
    }
  }

  static async createInspectionFrequency(req, res) {
    try {
      const orgId = req.user.org_id;
      const userId = req.user.user_id;
      const data = req.body;
      
      if (!data.aatic_id) {
        return res.status(400).json({
          success: false,
          message: 'Mapping ID (AATIC_id) is required'
        });
      }
      
      const frequency = await InspectionFrequencyModel.createInspectionFrequency(data, orgId, userId);
      
      res.json({
        success: true,
        data: frequency,
        message: 'Inspection frequency created successfully'
      });
    } catch (error) {
      console.error('Error in createInspectionFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create inspection frequency',
        error: error.message
      });
    }
  }

  static async updateInspectionFrequency(req, res) {
    try {
      const orgId = req.user.org_id;
      const userId = req.user.user_id;
      const { id } = req.params;
      const data = req.body;
      
      const frequency = await InspectionFrequencyModel.updateInspectionFrequency(id, data, orgId, userId);
      
      if (!frequency) {
        return res.status(404).json({
          success: false,
          message: 'Inspection frequency not found'
        });
      }
      
      res.json({
        success: true,
        data: frequency,
        message: 'Inspection frequency updated successfully'
      });
    } catch (error) {
      console.error('Error in updateInspectionFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update inspection frequency',
        error: error.message
      });
    }
  }

  static async deleteInspectionFrequency(req, res) {
    try {
      const orgId = req.user.org_id;
      const { id } = req.params;
      
      const deleted = await InspectionFrequencyModel.deleteInspectionFrequency(id, orgId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Inspection frequency not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Inspection frequency deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteInspectionFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete inspection frequency',
        error: error.message
      });
    }
  }
}

module.exports = InspectionFrequencyController;
