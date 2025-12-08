const {
  getAllVendorRenewals,
  getVendorRenewalById,
  getVendorRenewalsByVendorId,
  createVendorRenewalTable
} = require('../models/vendorRenewalModel');

/**
 * Get all vendor renewal records
 */
const getVendorRenewals = async (req, res) => {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const branchCode = req.user?.branch_code;
    const hasSuperAccess = req.user?.has_super_access || false;
    
    console.log('Fetching vendor renewals:', { orgId, branchCode, hasSuperAccess });
    
    const result = await getAllVendorRenewals(orgId, branchCode, hasSuperAccess);
    
    res.status(200).json({
      success: true,
      count: result.data.length,
      data: result.data
    });
  } catch (error) {
    console.error('Error fetching vendor renewals:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor renewal records',
      error: error.message
    });
  }
};

/**
 * Get vendor renewal record by ID
 */
const getVendorRenewal = async (req, res) => {
  try {
    const { vrId } = req.params;
    const orgId = req.user?.org_id || 'ORG001';
    
    console.log('Fetching vendor renewal:', { vrId, orgId });
    
    const result = await getVendorRenewalById(vrId, orgId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Error fetching vendor renewal:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor renewal record',
      error: error.message
    });
  }
};

/**
 * Get vendor renewal records by vendor ID
 */
const getVendorRenewalsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const orgId = req.user?.org_id || 'ORG001';
    
    console.log('Fetching vendor renewals for vendor:', { vendorId, orgId });
    
    const result = await getVendorRenewalsByVendorId(vendorId, orgId);
    
    res.status(200).json({
      success: true,
      count: result.data.length,
      data: result.data
    });
  } catch (error) {
    console.error('Error fetching vendor renewals by vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendor renewal records',
      error: error.message
    });
  }
};

/**
 * Initialize vendor renewal table (admin only)
 */
const initializeVendorRenewalTable = async (req, res) => {
  try {
    console.log('Initializing vendor renewal table...');
    
    const result = await createVendorRenewalTable();
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error initializing vendor renewal table:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing vendor renewal table',
      error: error.message
    });
  }
};

module.exports = {
  getVendorRenewals,
  getVendorRenewal,
  getVendorRenewalsByVendor,
  initializeVendorRenewalTable
};
