const slaReportModel = require("../models/slaReportModel");
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

// Get SLA report data with filters
const getSLAReport = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'SLAREPORT';
  
  try {
    const org_id = req.user?.org_id;
    if (!org_id) {
      return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    }
    
    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Get SLA Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        hasFilters: Object.keys(req.query).length > 2,
        limit: req.query.limit || 1000,
        offset: req.query.offset || 0
      },
      userId
    });
    
    // Parse filters from query parameters
    const parseArrayParam = (param) => {
      if (!param) return null;
      if (Array.isArray(param)) return param;
      return [param];
    };
    
    const filters = {
      org_id,
      vendor_id: parseArrayParam(req.query.vendor_id || req.query.vendor),
      asset_type_id: parseArrayParam(req.query.asset_type_id || req.query.assetType),
      sla_description: parseArrayParam(req.query.sla_description || req.query.slaDescription),
      dateRange: req.query.dateRange ? (Array.isArray(req.query.dateRange) ? req.query.dateRange : req.query.dateRange.split(',')) : null,
      limit: parseInt(req.query.limit) || 1000,
      offset: parseInt(req.query.offset) || 0
    };
    
    // Log filters applied
    if (filters.vendor_id || filters.asset_type_id || filters.asset_id || filters.dateRange) {
      await logReportFiltersApplied({
        appId: APP_ID,
        reportType: 'SLA Report',
        filters: {
          vendor_id: filters.vendor_id,
          asset_type_id: filters.asset_type_id,
          asset_id: filters.asset_id,
          dateRange: filters.dateRange
        },
        userId
      });
    }
    
    // Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'SLA Report',
      filters,
      userId
    });
    
    // Get data from model
    const data = await slaReportModel.getSLAReportData(filters);
    const recordCount = data?.length || 0;
    
    // Log results
    if (recordCount === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: 'SLA Report',
        filters,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: 'SLA Report',
        recordCount,
        filters,
        duration: Date.now() - startTime,
        userId
      });
      
      // Log large result set warning
      if (recordCount > 1000) {
        await logLargeResultSet({
          appId: APP_ID,
          reportType: 'SLA Report',
          recordCount,
          userId
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data,
      count: recordCount,
      filters
    });
    
  } catch (error) {
    console.error('[SLAReportController] Error:', error);
    
    await logReportGenerationError({
      appId: APP_ID,
      reportType: 'SLA Report',
      error: error.message,
      stack: error.stack,
      userId,
      duration: Date.now() - startTime
    });
    
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'SLA Report',
        error: error.message,
        userId
      });
    } else {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'SLA Report',
        error: error.message,
        query: 'getSLAReportData',
        userId
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate SLA report',
      message: error.message
    });
  }
};

// Get filter options for SLA reports
const getSLAReportFilterOptions = async (req, res) => {
  try {
    const org_id = req.user?.org_id;
    if (!org_id) {
      return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    }
    
    const filterOptions = await slaReportModel.getSLAReportFilterOptions(org_id);
    
    console.log('[SLAReportController] Filter options:', {
      vendors: filterOptions.vendors?.length || 0,
      assetTypes: filterOptions.assetTypes?.length || 0,
      assets: filterOptions.assets?.length || 0
    });
    
    res.status(200).json({
      success: true,
      data: filterOptions
    });
  } catch (error) {
    console.error('[SLAReportController] Error getting filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get filter options',
      message: error.message
    });
  }
};

module.exports = {
  getSLAReport,
  getSLAReportFilterOptions
};

