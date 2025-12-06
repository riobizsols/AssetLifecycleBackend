const assetRegisterModel = require("../models/assetRegisterModel");
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

// Get asset register data with filters
const getAssetRegister = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'ASSETREPORT';
  
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

    // Step 1: Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Get Asset Register Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        hasFilters: Object.keys(req.query).length > 2,
        limit, 
        offset 
      },
      userId
    });

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

    // Step 2: Log filters applied
    const appliedFilters = Object.keys(filters).filter(key => 
      filters[key] !== null && key !== 'limit' && key !== 'offset'
    );
    
    if (appliedFilters.length > 0) {
      await logReportFiltersApplied({
        appId: APP_ID,
        reportType: 'Asset Register',
        filters: Object.fromEntries(appliedFilters.map(key => [key, filters[key]])),
        userId
      });
    }

    // Add user's branch_id as default filter only if user doesn't have super access
    const userBranchId = req.user?.branch_id;
    const hasSuperAccess = req.user?.hasSuperAccess || false;
    filters.hasSuperAccess = hasSuperAccess; // Pass to model
    if (!hasSuperAccess && userBranchId) {
      filters.branch_id = userBranchId;
      console.log('🔍 [AssetRegisterController] Added user branch_id filter:', userBranchId);
    } else if (hasSuperAccess) {
      console.log('🔍 [AssetRegisterController] User has super access - no branch filter applied');
    }

    // Step 3: Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'Asset Register',
      filters,
      userId
    });

    // Get data and count
    const [data, count] = await Promise.all([
      assetRegisterModel.getAssetRegisterData(filters),
      assetRegisterModel.getAssetRegisterCount(filters)
    ]);

    const recordCount = data.rows?.length || 0;

    // Step 4: Log no data or success
    if (recordCount === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: 'Asset Register',
        filters,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: 'Asset Register',
        recordCount,
        filters,
        duration: Date.now() - startTime,
        userId
      });
      
      // Step 5: Warn if large result set
      if (parseInt(count) > 1000) {
        await logLargeResultSet({
          appId: APP_ID,
          reportType: 'Asset Register',
          recordCount: parseInt(count),
          threshold: 1000,
          userId
        });
      }
    }

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
    
    // Determine error level
    const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
    
    if (error.code === 'ECONNREFUSED') {
      // CRITICAL: Database connection failure
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Asset Register',
        error,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      // ERROR: Database query error
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Asset Register',
        query: 'getAssetRegisterData',
        error,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      // ERROR: General report error
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Asset Register',
        error,
        filters: req.query,
        userId,
        duration: Date.now() - startTime
      });
    }
    
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
    const orgId = req.user?.org_id;
    const branchId = req.user?.branch_id;
    const hasSuperAccess = req.user?.hasSuperAccess || false;
    
    let summaryQuery = `
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
      WHERE a.org_id = $1
    `;
    
    const params = [orgId];
    
    // Apply branch filter only if user doesn't have super access
    if (!hasSuperAccess && branchId) {
      summaryQuery += ` AND a.branch_id = $2`;
      params.push(branchId);
    }

    // Use tenant database from request context (set by middleware)
    const dbPool = req.db || require("../config/db");
    const result = await dbPool.query(summaryQuery, params);
    
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
