const UOMModel = require('../models/uomModel');

class UOMController {
  // Get all UOM values
  static async getAllUOM(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all UOM values for org: ${orgId}`);

      const uomValues = await UOMModel.getAllUOM(orgId);
      
      console.log(`Found ${uomValues.length} UOM values`);

      res.json({
        success: true,
        data: uomValues
      });
    } catch (error) {
      console.error('Error in getAllUOM:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch UOM values',
        error: error.message
      });
    }
  }

  // Get UOM by ID
  static async getUOMById(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching UOM: ${id}`);

      const uom = await UOMModel.getUOMById(id, orgId);
      
      if (!uom) {
        return res.status(404).json({
          success: false,
          message: 'UOM not found'
        });
      }

      res.json({
        success: true,
        data: uom
      });
    } catch (error) {
      console.error('Error in getUOMById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch UOM',
        error: error.message
      });
    }
  }
}

module.exports = UOMController;

