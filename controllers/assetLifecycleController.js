const assetLifecycleModel = require("../models/assetLifecycleModel");
const {
    logReportApiCall,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logNoDataFound, 
    logLargeResultSet,
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');

// Get asset lifecycle data with filters
const getAssetLifecycle = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'ASSETLIFECYCLEREPORT';
  
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

    // Step 1: Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Get Asset Lifecycle Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        hasFilters: Object.keys(req.query).length > 2,
        limit, 
        offset 
      },
      userId
    });

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

    // Add user's branch_id as default filter
    const userBranchId = req.user?.branch_id;
    if (userBranchId) {
      filters.branch_id = userBranchId;
      console.log('🔍 [AssetLifecycleController] Added user branch_id filter:', userBranchId);
    }

    // Step 2: Log filters applied
    const appliedFilters = Object.keys(filters).filter(key => 
      filters[key] !== null && key !== 'limit' && key !== 'offset'
    );
    
    if (appliedFilters.length > 0) {
      await logReportFiltersApplied({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        filters: Object.fromEntries(appliedFilters.map(key => [key, filters[key]])),
        userId
      });
    }

    // Step 3: Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'Asset Lifecycle',
      filters,
      userId
    });

    // Get data and count
    const [data, count] = await Promise.all([
      assetLifecycleModel.getAssetLifecycleData(filters),
      assetLifecycleModel.getAssetLifecycleCount(filters)
    ]);

    const recordCount = data.rows?.length || 0;

    // Step 4: Log no data or success
    if (recordCount === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        filters,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      // Step 5: Log success
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        recordCount,
        filters,
        duration: Date.now() - startTime,
        userId
      });
      
      // Step 6: Warn if large result set
      if (recordCount > 1000) {
        await logLargeResultSet({
          appId: APP_ID,
          reportType: 'Asset Lifecycle',
          recordCount,
          threshold: 1000,
          userId
        });
      }
    }

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
    
    // Determine error level
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (error.code === 'ECONNREFUSED') {
      // CRITICAL: Database connection failure
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        error,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      // ERROR: Database query error
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        query: 'getAssetLifecycleData',
        error,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      // ERROR: General report error
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Asset Lifecycle',
        error,
        filters: req.query,
        userId,
        duration: Date.now() - startTime
      });
    }
    
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
