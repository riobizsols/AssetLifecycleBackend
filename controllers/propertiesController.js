const PropertiesModel = require('../models/propertiesModel');
const { generateCustomId } = require('../utils/idGenerator');

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

  // Add new property value
  static async addPropertyValue(req, res) {
    try {
      const { propId, value } = req.body;
      const orgId = req.user.org_id;

      console.log(`Adding property value for propId: ${propId}, value: ${value}, org: ${orgId}`);

      if (!propId || !value) {
        return res.status(400).json({
          success: false,
          message: 'Property ID and value are required'
        });
      }

      const newValue = await PropertiesModel.addPropertyValue(propId, value, orgId);
      
      console.log(`Successfully added property value:`, newValue);

      res.json({
        success: true,
        data: newValue,
        message: 'Property value added successfully'
      });
    } catch (error) {
      console.error('Error in addPropertyValue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add property value',
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

  // Get all properties
  static async getAllProperties(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all properties for org: ${orgId}`);

      const properties = await PropertiesModel.getAllProperties(orgId);
      
      console.log(`Found ${properties.length} properties`);

      res.json({
        success: true,
        data: properties
      });
    } catch (error) {
      console.error('Error in getAllProperties:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch properties',
        error: error.message
      });
    }
  }

  // Create asset type with properties
  static async createAssetTypeWithProperties(req, res) {
    try {
      const orgId = req.user.org_id;
      const createdBy = req.user.user_id;

      const {
        asset_type_id,
        org_id,
        propertyIds = [] // Array of property IDs to map to this asset type
      } = req.body;

      console.log(`Mapping properties to asset type for org: ${orgId}`);
      console.log('Asset type ID:', asset_type_id);
      console.log('Property IDs:', propertyIds);

      // Validate required fields
      if (!asset_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Asset type ID is required'
        });
      }

      if (!org_id) {
        return res.status(400).json({
          success: false,
          message: 'Organization ID is required'
        });
      }

      if (!propertyIds || propertyIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one property ID is required'
        });
      }

      // Map properties to existing asset type
      const result = await PropertiesModel.mapPropertiesToAssetType(
        asset_type_id,
        propertyIds,
        org_id,
        createdBy
      );

      console.log(`Successfully mapped ${propertyIds.length} properties to asset type: ${asset_type_id}`);

      res.status(201).json({
        success: true,
        message: 'Properties mapped to asset type successfully',
        data: {
          asset_type_id: asset_type_id,
          mappedProperties: result.mappedProperties,
          totalPropertiesMapped: result.mappedProperties.length
        }
      });

    } catch (error) {
      console.error('Error in createAssetTypeWithProperties:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Property mapping already exists',
          error: error.message
        });
      }

      if (error.code === '23503') {
        return res.status(400).json({
          success: false,
          message: 'Invalid reference: Asset type or property not found',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to map properties to asset type',
        error: error.message
      });
    }
  }

  // Get all properties with their list values
  static async getAllPropertiesWithValues(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all properties with values for org: ${orgId}`);

      const properties = await PropertiesModel.getAllPropertiesWithValues(orgId);
      
      console.log(`Found ${properties.length} properties with values`);

      res.json({
        success: true,
        data: properties
      });
    } catch (error) {
      console.error('Error in getAllPropertiesWithValues:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch properties with values',
        error: error.message
      });
    }
  }

  // Create a new property
  static async createProperty(req, res) {
    try {
      const { property } = req.body;
      const orgId = req.user.org_id;

      if (!property || !property.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Property name is required'
        });
      }

      console.log(`Creating property: ${property} for org: ${orgId}`);

      const newProperty = await PropertiesModel.createProperty(property, orgId);
      
      console.log(`Successfully created property:`, newProperty);

      res.status(201).json({
        success: true,
        data: newProperty,
        message: 'Property created successfully'
      });
    } catch (error) {
      console.error('Error in createProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create property',
        error: error.message
      });
    }
  }

  // Create property with list values
  static async createPropertyWithValues(req, res) {
    try {
      const { property, listValues } = req.body;
      const orgId = req.user.org_id;

      if (!property || !property.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Property name is required'
        });
      }

      console.log(`Creating property with values: ${property} for org: ${orgId}`);
      console.log('List values:', listValues);

      const result = await PropertiesModel.createPropertyWithValues(property, listValues || [], orgId);
      
      console.log(`Successfully created property with ${result.listValues.length} values`);

      res.status(201).json({
        success: true,
        data: result,
        message: `Property created successfully with ${result.listValues.length} list value(s)`
      });
    } catch (error) {
      console.error('Error in createPropertyWithValues:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create property with values',
        error: error.message
      });
    }
  }

  // Update property
  static async updateProperty(req, res) {
    try {
      const { id } = req.params;
      const { property } = req.body;
      const orgId = req.user.org_id;

      if (!property || !property.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Property name is required'
        });
      }

      console.log(`Updating property ${id}: ${property}`);

      const updatedProperty = await PropertiesModel.updateProperty(id, property, orgId);
      
      if (!updatedProperty) {
        return res.status(404).json({
          success: false,
          message: 'Property not found'
        });
      }

      res.json({
        success: true,
        data: updatedProperty,
        message: 'Property updated successfully'
      });
    } catch (error) {
      console.error('Error in updateProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update property',
        error: error.message
      });
    }
  }

  // Delete property
  static async deleteProperty(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Deleting property ${id}`);

      const deletedProperty = await PropertiesModel.deleteProperty(id, orgId);
      
      if (!deletedProperty) {
        return res.status(404).json({
          success: false,
          message: 'Property not found'
        });
      }

      res.json({
        success: true,
        message: 'Property deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete property',
        error: error.message
      });
    }
  }

  // Add list value to property
  static async addListValueToProperty(req, res) {
    try {
      const { propId, value } = req.body;
      const orgId = req.user.org_id;

      if (!propId || !value || !value.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Property ID and value are required'
        });
      }

      console.log(`Adding list value ${value} to property ${propId}`);

      const newValue = await PropertiesModel.addListValueToProperty(propId, value, orgId);
      
      res.status(201).json({
        success: true,
        data: newValue,
        message: 'List value added successfully'
      });
    } catch (error) {
      console.error('Error in addListValueToProperty:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add list value',
        error: error.message
      });
    }
  }

  // Delete property list value
  static async deletePropertyValue(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Deleting property value ${id}`);

      const deletedValue = await PropertiesModel.deletePropertyValue(id, orgId);
      
      if (!deletedValue) {
        return res.status(404).json({
          success: false,
          message: 'Property value not found'
        });
      }

      res.json({
        success: true,
        message: 'Property value deleted successfully'
      });
    } catch (error) {
      console.error('Error in deletePropertyValue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete property value',
        error: error.message
      });
    }
  }
}

module.exports = PropertiesController; 