const model = require('../models/reportbreakdownModel');
const {
    logReportApiCall,
    logReportGenerationSuccess,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logNoDataFound,
    logUnauthorizedReportAccess,
    logLargeResultSet,
    logMissingParameters,
    logInvalidFilters, 
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');

// GET /api/reportbreakdown/reports
const getAllReports = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'REPORTBREAKDOWN';
  
  try {
    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Get All Breakdown Reports',
      method: req.method,
      url: req.originalUrl,
      requestData: {},
      userId
    });
    
    const orgId = req.user?.org_id;
    if (!orgId) {
      await logUnauthorizedReportAccess({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    }

    // Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'Breakdown Reports',
      filters: { orgId },
      userId
    });

    const reports = await model.getAllReports(orgId);
    const recordCount = reports?.length || 0;
    
    // Log no data or success
    if (recordCount === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        filters: { orgId },
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        recordCount,
        filters: { orgId },
        duration: Date.now() - startTime,
        userId
      });
    }
    
    res.status(200).json({ data: reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    
    // Determine error level
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
    
    if (err.code === 'ECONNREFUSED') {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        query: 'getAllReports',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Breakdown Reports',
        error: err,
        filters: {},
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};


const getReasonCodes = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'REPORTBREAKDOWN';
  
  try {
    const { asset_type_id: assetTypeId, org_id: orgId } = req.query;

    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Get Breakdown Reason Codes',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_type_id: assetTypeId, org_id: orgId },
      userId
    });

    console.log('Reason codes request params:', { assetTypeId, orgId });

    if (!orgId) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Get Breakdown Reason Codes',
        missingParams: ['org_id'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ error: 'Missing organization ID' });
    }

    // Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'Breakdown Reason Codes',
      filters: { orgId, assetTypeId },
      userId
    });

    const rows = await model.getBreakdownReasonCodes(orgId, assetTypeId || null);
    console.log('Reason codes from database:', rows.length, 'rows');
    
    // Log no data or success
    if (rows.length === 0) {
      await logNoDataFound({
        appId: APP_ID,
        reportType: 'Breakdown Reason Codes',
        filters: { org_id: orgId, asset_type_id: assetTypeId },
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportDataRetrieved({
        appId: APP_ID,
        reportType: 'Breakdown Reason Codes',
        recordCount: rows.length,
        filters: { org_id: orgId, asset_type_id: assetTypeId },
        duration: Date.now() - startTime,
        userId
      });
    }
    
    const data = rows.map(r => ({ id: r.atbrrc_id, text: r.text, asset_type_id: r.asset_type_id }));
    res.status(200).json({ data });
  } catch (err) {
    console.error('Error fetching reason codes:', err);
    
    // Determine error level
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
    
    if (err.code === 'ECONNREFUSED') {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Breakdown Reason Codes',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Breakdown Reason Codes',
        query: 'getBreakdownReasonCodes',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Breakdown Reason Codes',
        error: err,
        filters: req.query,
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch reason codes',
      details: err.message 
    });
  }
};

// GET /api/reportbreakdown/upcoming-maintenance/:assetId
const getUpcomingMaintenanceDate = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    const maintenanceDate = await model.getUpcomingMaintenanceDate(assetId);
    
    res.status(200).json({ 
      data: {
        upcoming_maintenance_date: maintenanceDate
      }
    });
  } catch (err) {
    console.error('Error fetching upcoming maintenance date:', err);
    res.status(500).json({ 
      error: 'Failed to fetch upcoming maintenance date',
      details: err.message 
    });
  }
};

// POST /api/reportbreakdown/create
const createBreakdownReport = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'REPORTBREAKDOWN';
  
  try {
    const {
      asset_id,
      atbrrc_id,
      reported_by,
      description,
      decision_code
    } = req.body;

    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Create Breakdown Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        asset_id,
        atbrrc_id,
        reported_by,
        decision_code 
      },
      userId
    });

    // Validate required fields
    if (!asset_id || !atbrrc_id || !reported_by || !description || !decision_code) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Create Breakdown Report',
        missingParams: [
          !asset_id && 'asset_id',
          !atbrrc_id && 'atbrrc_id',
          !reported_by && 'reported_by',
          !description && 'description',
          !decision_code && 'decision_code'
        ].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ 
        error: 'Missing required fields: asset_id, atbrrc_id, reported_by, description, decision_code' 
      });
    }

    // Validate decision code
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (!validDecisionCodes.includes(decision_code)) {
      await logInvalidFilters({
        appId: APP_ID,
        reportType: 'Breakdown Report',
        invalidFilters: { decision_code },
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ error: 'Invalid decision code. Must be BF01, BF02, or BF03' });
    }

    // Get org_id from authenticated user
    const org_id = req.user?.org_id;
    if (!org_id) {
      await logUnauthorizedReportAccess({
        appId: APP_ID,
        reportType: 'Breakdown Report',
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    }

    const breakdownData = {
      asset_id,
      atbrrc_id,
      reported_by,
      description,
      decision_code,
      org_id
    };

    const result = await model.createBreakdownReport(breakdownData);
    
    // Log success
    await logReportGenerationSuccess({
      appId: APP_ID,
      operation: 'Create Breakdown Report',
      requestData: breakdownData,
      responseData: { 
        breakdown_id: result?.abr_id,
        asset_id,
        created: true
      },
      duration: Date.now() - startTime,
      userId
    });
    
    res.status(201).json({ 
      success: true,
      message: 'Breakdown report created successfully',
      data: result
    });
  } catch (err) {
    console.error('Error creating breakdown report:', err);
    
    // Determine error level
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
    
    if (err.code === 'ECONNREFUSED') {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Breakdown Report Create',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Breakdown Report Create',
        query: 'createBreakdownReport',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Breakdown Report Create',
        error: err,
        filters: req.body,
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({ error: 'Failed to create breakdown report' });
  }
};

// PUT /api/reportbreakdown/update/:id
const updateBreakdownReport = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'REPORTBREAKDOWN';
  
  try {
    const { id } = req.params;
    const {
      atbrrc_id,
      description,
      decision_code
    } = req.body;

    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Update Breakdown Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        breakdown_id: id,
        atbrrc_id,
        decision_code 
      },
      userId
    });

    // Validate required fields
    if (!atbrrc_id || !description || !decision_code) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Update Breakdown Report',
        missingParams: [
          !atbrrc_id && 'atbrrc_id',
          !description && 'description',
          !decision_code && 'decision_code'
        ].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ 
        error: 'Missing required fields: atbrrc_id, description, decision_code' 
      });
    }

    // Validate decision code
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (!validDecisionCodes.includes(decision_code)) {
      await logInvalidFilters({
        appId: APP_ID,
        reportType: 'Breakdown Report',
        invalidFilters: { decision_code },
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ error: 'Invalid decision code. Must be BF01, BF02, or BF03' });
    }

    const updateData = {
      atbrrc_id,
      description,
      decision_code
    };

    const result = await model.updateBreakdownReport(id, updateData);
    
    // Log success
    await logReportGenerationSuccess({
      appId: APP_ID,
      operation: 'Update Breakdown Report',
      requestData: { breakdown_id: id, ...updateData },
      responseData: { 
        breakdown_id: id,
        updated: true
      },
      duration: Date.now() - startTime,
      userId
    });
    
    res.status(200).json({ 
      success: true,
      message: 'Breakdown report updated successfully',
      data: result
    });
  } catch (err) {
    console.error('Error updating breakdown report:', err);
    
    // Determine error level
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
    
    if (err.code === 'ECONNREFUSED') {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Breakdown Report Update',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Breakdown Report Update',
        query: 'updateBreakdownReport',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Breakdown Report Update',
        error: err,
        filters: req.body,
        userId,
        duration: Date.now() - startTime
      });
    }
    
    res.status(500).json({ error: 'Failed to update breakdown report' });
  }
};

module.exports = {
  getReasonCodes,
  getAllReports,
  getUpcomingMaintenanceDate,
  createBreakdownReport,
  updateBreakdownReport
};


