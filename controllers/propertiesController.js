const PropertiesModel = require('../models/propertiesModel');

class PropertiesController {
  // Get properties for a specific asset type
  static async getPropertiesByAssetType(req, res) {
    try {
      const { assetTypeId } = req.params;
      const orgId = req.user.org_id; // From auth middleware

      console.log(`Fetching properties for asset type: ${assetTypeId}, org: ${orgId}`);

      const properties = await PropertiesModel.getPropertiesByAssetType(assetTypeId, orgId);
      
      console.log(`Found ${properties.length} properties for asset type ${assetTypeId}`);

      res.json({
        success: true,
        data: properties
      });
    } catch (error) {
      console.error('Error in getPropertiesByAssetType:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch properties',
        error: error.message
      });
    }
  }

  // Get values for a specific property
  static async getPropertyValues(req, res) {
    try {
      const { propId } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching values for property: ${propId}, org: ${orgId}`);

      const values = await PropertiesModel.getPropertyValues(propId, orgId);
      
      console.log(`Found ${values.length} values for property ${propId}`);

      res.json({
        success: true,
        data: values
      });
    } catch (error) {
      console.error('Error in getPropertyValues:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch property values',
        error: error.message
      });
    }
  }

  // Get all properties with their values for a specific asset type
  static async getPropertiesWithValues(req, res) {
    try {
      const { assetTypeId } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching properties with values for asset type: ${assetTypeId}, org: ${orgId}`);

      const properties = await PropertiesModel.getPropertiesWithValues(assetTypeId, orgId);
      
      console.log(`Found ${properties.length} properties with values for asset type ${assetTypeId}`);

      res.json({
        success: true,
        data: properties
      });
    } catch (error) {
      console.error('Error in getPropertiesWithValues:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch properties with values',
        error: error.message
      });
    }
  }

  // Get all asset types
  static async getAllAssetTypes(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all asset types for org: ${orgId}`);

      const assetTypes = await PropertiesModel.getAllAssetTypes(orgId);
      
      console.log(`Found ${assetTypes.length} asset types`);

      res.json({
        success: true,
        data: assetTypes
      });
    } catch (error) {
      console.error('Error in getAllAssetTypes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch asset types',
        error: error.message
      });
    }
  }
}

module.exports = PropertiesController; 