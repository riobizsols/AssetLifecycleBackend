const tenantSetupService = require('../services/tenantSetupService');

/**
 * Create a new tenant
 * This creates a new organization database and registers it in the tenant table
 */
const createTenant = async (req, res) => {
  try {
    const result = await tenantSetupService.createTenant(req.body);
    return res.json({
      success: true,
      message: 'Tenant created successfully',
      data: result,
    });
  } catch (error) {
    console.error('[TenantSetup] Error creating tenant:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create tenant',
    });
  }
};

/**
 * Get all tenants
 */
const getAllTenants = async (req, res) => {
  try {
    const tenants = await tenantSetupService.getAllTenants();
    return res.json({
      success: true,
      data: tenants,
    });
  } catch (error) {
    console.error('[TenantSetup] Error getting tenants:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tenants',
    });
  }
};

/**
 * Get tenant by org_id
 */
const getTenantById = async (req, res) => {
  try {
    const { orgId } = req.params;
    const tenant = await tenantSetupService.getTenantById(orgId);
    return res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    console.error('[TenantSetup] Error getting tenant:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get tenant',
    });
  }
};

/**
 * Update tenant
 */
const updateTenant = async (req, res) => {
  try {
    const { orgId } = req.params;
    const result = await tenantSetupService.updateTenant(orgId, req.body);
    return res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: result,
    });
  } catch (error) {
    console.error('[TenantSetup] Error updating tenant:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update tenant',
    });
  }
};

/**
 * Delete/Deactivate tenant
 */
const deleteTenant = async (req, res) => {
  try {
    const { orgId } = req.params;
    await tenantSetupService.deleteTenant(orgId);
    return res.json({
      success: true,
      message: 'Tenant deactivated successfully',
    });
  } catch (error) {
    console.error('[TenantSetup] Error deleting tenant:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete tenant',
    });
  }
};

/**
 * Test tenant database connection
 */
const testTenantConnection = async (req, res) => {
  try {
    const { orgId } = req.params;
    const result = await tenantSetupService.testTenantConnection(orgId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[TenantSetup] Error testing connection:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to test connection',
    });
  }
};

/**
 * Check if org_id is available
 */
const checkOrgIdAvailability = async (req, res) => {
  try {
    const { orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }
    
    const exists = await tenantSetupService.checkOrgIdExists(orgId);
    return res.json({
      success: true,
      available: !exists,
      message: exists 
        ? `Organization ID ${orgId.toUpperCase()} is already taken`
        : `Organization ID ${orgId.toUpperCase()} is available`,
    });
  } catch (error) {
    console.error('[TenantSetup] Error checking org_id:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check organization ID',
    });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  testTenantConnection,
  checkOrgIdAvailability,
};

