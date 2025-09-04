const assetRegisterModel = require("../models/assetRegisterModel");

// Get asset register data with filters
const getAssetRegister = async (req, res) => {
  try {
    const {
      assetId,
      department,
      employee,
      vendor,
      poNumber,
      invoiceNumber,
      category,
      location,
      purchaseDateRange,
      commissionedDateRange,
      currentStatus,
      cost,
      status,
      advancedConditions,
      limit = 1000,
      offset = 0
    } = req.query;

    // Parse array parameters
    const filters = {
      assetId: assetId || null,
      department: department ? (Array.isArray(department) ? department : [department]) : null,
      employee: employee ? (Array.isArray(employee) ? employee : [employee]) : null,
      vendor: vendor ? (Array.isArray(vendor) ? vendor : [vendor]) : null,
      poNumber: poNumber || null,
      invoiceNumber: invoiceNumber || null,
      category: category ? (Array.isArray(category) ? category : [category]) : null,
      location: location ? (Array.isArray(location) ? location : [location]) : null,
      purchaseDateRange: purchaseDateRange ? (Array.isArray(purchaseDateRange) ? purchaseDateRange : [purchaseDateRange]) : null,
      commissionedDateRange: commissionedDateRange ? (Array.isArray(commissionedDateRange) ? commissionedDateRange : [commissionedDateRange]) : null,
      currentStatus: currentStatus ? (Array.isArray(currentStatus) ? currentStatus : [currentStatus]) : null,
      cost: cost ? parseFloat(cost) : null,
      status: status ? (Array.isArray(status) ? status : [status]) : null,
      advancedConditions: advancedConditions ? JSON.parse(advancedConditions) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Get data and count
    const [data, count] = await Promise.all([
      assetRegisterModel.getAssetRegisterData(filters),
      assetRegisterModel.getAssetRegisterCount(filters)
    ]);

    res.status(200).json({
      success: true,
      message: "Asset register data retrieved successfully",
      data: data.rows,
      pagination: {
        total: parseInt(count),
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < parseInt(count)
      }
    });
  } catch (error) {
    console.error("Error in getAssetRegister:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving asset register data",
      error: error.message
    });
  }
};

// Get filter options for asset register
const getAssetRegisterFilterOptions = async (req, res) => {
  try {
    const options = await assetRegisterModel.getAssetRegisterFilterOptions();
    
    res.status(200).json({
      success: true,
      message: "Filter options retrieved successfully",
      data: options
    });
  } catch (error) {
    console.error("Error in getAssetRegisterFilterOptions:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving filter options",
      error: error.message
    });
  }
};

// Get asset register summary statistics
const getAssetRegisterSummary = async (req, res) => {
  try {
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN a.current_status = 'Active' THEN 1 END) as active_assets,
        COUNT(CASE WHEN a.current_status = 'In Use' THEN 1 END) as in_use_assets,
        COUNT(CASE WHEN a.current_status = 'Under Maintenance' THEN 1 END) as maintenance_assets,
        COUNT(CASE WHEN a.current_status = 'Disposed' THEN 1 END) as disposed_assets,
        SUM(CAST(a.purchased_cost AS DECIMAL)) as total_value,
        AVG(CAST(a.purchased_cost AS DECIMAL)) as average_cost,
        COUNT(DISTINCT a.asset_type_id) as asset_types,
        COUNT(DISTINCT a.branch_id) as locations,
        COUNT(DISTINCT aa.dept_id) as departments_with_assets
      FROM "tblAssets" a
      LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
        AND aa.action = 'A' 
        AND aa.latest_assignment_flag = true
    `;

    const db = require("../config/db");
    const result = await db.query(summaryQuery);
    
    res.status(200).json({
      success: true,
      message: "Asset register summary retrieved successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error in getAssetRegisterSummary:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving asset register summary",
      error: error.message
    });
  }
};

module.exports = {
  getAssetRegister,
  getAssetRegisterFilterOptions,
  getAssetRegisterSummary
};
