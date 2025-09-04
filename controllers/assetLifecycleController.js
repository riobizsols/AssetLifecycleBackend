const assetLifecycleModel = require("../models/assetLifecycleModel");

// Get asset lifecycle data with filters
const getAssetLifecycle = async (req, res) => {
  try {
    console.log('🔍 [AssetLifecycleController] Raw query parameters:', req.query);
    
    const {
      purchaseDateRange,
      commissionedDateRange,
      assetUsageHistory,
      currentStatus,
      scrapDateRange,
      scrapLocation,
      scrappedBy,
      buyer,
      saleDateRange,
      saleAmount,
      advancedConditions,
      limit = 1000,
      offset = 0
    } = req.query;

    // Parse array parameters - handle both single values and arrays
    const parseArrayParam = (param) => {
      if (!param) return null;
      if (Array.isArray(param)) return param;
      return [param];
    };
    
    const filters = {
      purchaseDateRange: parseArrayParam(purchaseDateRange),
      commissionedDateRange: parseArrayParam(commissionedDateRange),
      assetUsageHistory: parseArrayParam(assetUsageHistory),
      currentStatus: parseArrayParam(currentStatus),
      scrapDateRange: parseArrayParam(scrapDateRange),
      scrapLocation: parseArrayParam(scrapLocation),
      scrappedBy: parseArrayParam(scrappedBy),
      buyer: parseArrayParam(buyer),
      saleDateRange: parseArrayParam(saleDateRange),
      saleAmount: saleAmount ? parseFloat(saleAmount) : null,
      advancedConditions: advancedConditions ? JSON.parse(advancedConditions) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    console.log('🔍 [AssetLifecycleController] Parsed filters:', JSON.stringify(filters, null, 2));

    // Get data and count
    const [data, count] = await Promise.all([
      assetLifecycleModel.getAssetLifecycleData(filters),
      assetLifecycleModel.getAssetLifecycleCount(filters)
    ]);

    res.status(200).json({
      success: true,
      message: "Asset lifecycle data retrieved successfully",
      data: data.rows,
      pagination: {
        total: parseInt(count),
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < parseInt(count)
      }
    });
  } catch (error) {
    console.error("Error in getAssetLifecycle:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving asset lifecycle data",
      error: error.message
    });
  }
};

// Get filter options for asset lifecycle
const getAssetLifecycleFilterOptions = async (req, res) => {
  try {
    const options = await assetLifecycleModel.getAssetLifecycleFilterOptions();
    
    res.status(200).json({
      success: true,
      message: "Filter options retrieved successfully",
      data: options
    });
  } catch (error) {
    console.error("Error in getAssetLifecycleFilterOptions:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving filter options",
      error: error.message
    });
  }
};

// Get asset lifecycle summary statistics
const getAssetLifecycleSummary = async (req, res) => {
  try {
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE 
          WHEN ssh.buyer_name IS NOT NULL THEN 1
        END) as scrap_sold_assets,
        COUNT(CASE 
          WHEN ssh.buyer_name IS NULL AND asd.scrapped_date IS NOT NULL THEN 1
        END) as scrapped_assets,
        COUNT(CASE 
          WHEN ssh.buyer_name IS NULL AND asd.scrapped_date IS NULL AND a.current_status = 'Active' THEN 1
        END) as in_use_assets,
        COUNT(CASE WHEN asd.asd_id IS NOT NULL THEN 1 END) as assets_with_scrap_details,
        COUNT(CASE WHEN ssh.ssh_id IS NOT NULL THEN 1 END) as assets_with_sales,
        SUM(CAST(a.purchased_cost AS DECIMAL)) as total_purchase_value,
        SUM(CASE 
          WHEN ssh.total_sale_value IS NULL THEN 0
          WHEN array_length(ssh.total_sale_value, 1) IS NULL THEN 0
          ELSE CAST(ssh.total_sale_value[1] AS DECIMAL)
        END) as total_sale_value,
        AVG(CAST(a.purchased_cost AS DECIMAL)) as average_purchase_cost,
        COUNT(DISTINCT a.asset_type_id) as asset_types,
        COUNT(DISTINCT a.branch_id) as locations,
        COUNT(DISTINCT aa.dept_id) as departments_with_assets
      FROM "tblAssets" a
      LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
        AND aa.latest_assignment_flag = true
      LEFT JOIN "tblAssetScrapDet" asd ON a.asset_id = asd.asset_id
      LEFT JOIN "tblScrapSales_D" ssd ON asd.asd_id = ssd.asd_id
      LEFT JOIN "tblScrapSales_H" ssh ON ssd.ssh_id = ssh.ssh_id
    `;

    const db = require("../config/db");
    const result = await db.query(summaryQuery);
    
    res.status(200).json({
      success: true,
      message: "Asset lifecycle summary retrieved successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error in getAssetLifecycleSummary:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving asset lifecycle summary",
      error: error.message
    });
  }
};

module.exports = {
  getAssetLifecycle,
  getAssetLifecycleFilterOptions,
  getAssetLifecycleSummary
};
