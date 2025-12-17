const columnAccessConfigModel = require('../models/columnAccessConfigModel');
const { getDbFromContext } = require('../utils/dbContext');

/**
 * Get table columns dynamically from database
 */
const getTableColumns = async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }

    const dbPool = getDbFromContext();
    
    // Get columns from information_schema
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `;
    
    const result = await dbPool.query(query, [tableName]);
    
    // Format columns with friendly labels
    const columns = result.rows.map(col => ({
      name: col.column_name,
      label: col.column_name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      dataType: col.data_type,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default
    }));
    
    return res.json({
      success: true,
      data: columns,
      message: `Found ${columns.length} columns for table ${tableName}`
    });
  } catch (error) {
    console.error('Error in getTableColumns:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table columns',
      error: error.message
    });
  }
};

/**
 * Get all column access configurations
 */
const getAllColumnAccessConfigs = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }
    
    const { jobRoleId, tableName } = req.query;
    
    const configs = await columnAccessConfigModel.getAllColumnAccessConfigs(orgId, {
      jobRoleId,
      tableName
    });
    
    return res.json({
      success: true,
      data: configs,
      message: `Found ${configs.length} column access configurations`
    });
  } catch (error) {
    console.error('Error in getAllColumnAccessConfigs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch column access configurations',
      error: error.message
    });
  }
};

/**
 * Get column access configuration by ID
 */
const getColumnAccessConfigById = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }
    
    const config = await columnAccessConfigModel.getColumnAccessConfigById(id, orgId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Column access configuration not found'
      });
    }
    
    return res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error in getColumnAccessConfigById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch column access configuration',
      error: error.message
    });
  }
};

/**
 * Create or update column access configuration
 */
const upsertColumnAccessConfig = async (req, res) => {
  try {
    const { org_id: orgId, user_id: userId } = req.user || {};
    
    if (!orgId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID and User ID are required'
      });
    }
    
    const { jobRoleId, tableName, fieldName, accessLevel } = req.body;
    
    // Validation
    if (!jobRoleId || !tableName || !fieldName || !accessLevel) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: jobRoleId, tableName, fieldName, accessLevel'
      });
    }
    
    if (!['DISPLAY', 'NONE'].includes(accessLevel)) {
      return res.status(400).json({
        success: false,
        message: 'accessLevel must be either DISPLAY or NONE'
      });
    }
    
    const config = await columnAccessConfigModel.upsertColumnAccessConfig({
      jobRoleId,
      tableName,
      fieldName,
      accessLevel,
      orgId
    }, userId);
    
    return res.json({
      success: true,
      data: config,
      message: 'Column access configuration saved successfully'
    });
  } catch (error) {
    console.error('Error in upsertColumnAccessConfig:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save column access configuration',
      error: error.message
    });
  }
};

/**
 * Bulk upsert column access configurations
 */
const bulkUpsertColumnAccessConfigs = async (req, res) => {
  try {
    const { org_id: orgId, user_id: userId } = req.user || {};
    
    if (!orgId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID and User ID are required'
      });
    }
    
    const { configs } = req.body;
    
    if (!Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'configs must be a non-empty array'
      });
    }
    
    // Validate each config
    for (const config of configs) {
      const { jobRoleId, tableName, fieldName, accessLevel } = config;
      
      if (!jobRoleId || !tableName || !fieldName || !accessLevel) {
        return res.status(400).json({
          success: false,
          message: 'Each config must have jobRoleId, tableName, fieldName, and accessLevel'
        });
      }
      
      if (!['DISPLAY', 'NONE'].includes(accessLevel)) {
        return res.status(400).json({
          success: false,
          message: 'accessLevel must be either DISPLAY or NONE'
        });
      }
    }
    
    const results = await columnAccessConfigModel.bulkUpsertColumnAccessConfigs(configs, userId, orgId);
    
    return res.json({
      success: true,
      data: results,
      message: `Successfully saved ${results.length} column access configurations`
    });
  } catch (error) {
    console.error('Error in bulkUpsertColumnAccessConfigs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save column access configurations',
      error: error.message
    });
  }
};

/**
 * Delete column access configuration
 */
const deleteColumnAccessConfig = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }
    
    const deleted = await columnAccessConfigModel.deleteColumnAccessConfig(id, orgId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Column access configuration not found'
      });
    }
    
    return res.json({
      success: true,
      data: deleted,
      message: 'Column access configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteColumnAccessConfig:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete column access configuration',
      error: error.message
    });
  }
};

/**
 * Get column access for a specific job role and table
 */
const getColumnAccessForJobRoleAndTable = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};
    const { jobRoleId, tableName } = req.params;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }
    
    const accessMap = await columnAccessConfigModel.getColumnAccessForJobRoleAndTable(
      jobRoleId,
      tableName,
      orgId
    );
    
    return res.json({
      success: true,
      data: accessMap
    });
  } catch (error) {
    console.error('Error in getColumnAccessForJobRoleAndTable:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch column access',
      error: error.message
    });
  }
};

module.exports = {
  getTableColumns,
  getAllColumnAccessConfigs,
  getColumnAccessConfigById,
  upsertColumnAccessConfig,
  bulkUpsertColumnAccessConfigs,
  deleteColumnAccessConfig,
  getColumnAccessForJobRoleAndTable
};

