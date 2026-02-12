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

// POST /api/reportbreakdown/:id/confirm
const confirmEmployeeReportBreakdown = async (req, res) => {
  const userId = req.user?.user_id;
  const orgId = req.user?.org_id || req.query.orgId;
  const { id } = req.params;
  try {
    const result = await model.confirmEmployeeReportBreakdown(id, orgId, userId);
    return res.status(200).json({ success: true, message: "Breakdown confirmed", data: result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// POST /api/reportbreakdown/:id/reopen
const reopenEmployeeReportBreakdown = async (req, res) => {
  const userId = req.user?.user_id;
  const orgId = req.user?.org_id || req.query.orgId;
  const { id } = req.params;
  const { notes } = req.body;
  try {
    const result = await model.reopenEmployeeReportBreakdown(id, orgId, userId, notes);
    return res.status(200).json({ success: true, message: "Breakdown reopened", data: result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

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

    const branchId = req.user?.branch_id;
    const hasSuperAccess = req.user?.hasSuperAccess || false;

    // Log data retrieval started
    await logReportDataRetrieval({
      appId: APP_ID,
      reportType: 'Breakdown Reports',
      filters: { orgId, branchId, hasSuperAccess },
      userId
    });

    const reports = await model.getAllReports(orgId, branchId, hasSuperAccess);
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

    // Validate required fields (decision_code is optional, will default to BF03 if not provided)
    if (!asset_id || !atbrrc_id || !reported_by || !description) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Create Breakdown Report',
        missingParams: [
          !asset_id && 'asset_id',
          !atbrrc_id && 'atbrrc_id',
          !reported_by && 'reported_by',
          !description && 'description'
        ].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ 
        error: 'Missing required fields: asset_id, atbrrc_id, reported_by, description' 
      });
    }

    // Validate decision code (only if provided)
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (decision_code && !validDecisionCodes.includes(decision_code)) {
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
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column
    });
    
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
    
    // Return more detailed error message in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Failed to create breakdown report: ${err.message}${err.detail ? ` - ${err.detail}` : ''}`
      : 'Failed to create breakdown report';
    
    res.status(500).json({ 
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          code: err.code,
          constraint: err.constraint,
          table: err.table,
          column: err.column
        }
      })
    });
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

    // Validate required fields (decision_code is optional/nullable)
    if (!atbrrc_id || !description) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Update Breakdown Report',
        missingParams: [
          !atbrrc_id && 'atbrrc_id',
          !description && 'description'
        ].filter(Boolean),
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ 
        error: 'Missing required fields: atbrrc_id, description' 
      });
    }

    // Validate decision code (only if provided)
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (decision_code && !validDecisionCodes.includes(decision_code)) {
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

// DELETE /api/reportbreakdown/:id
const deleteBreakdownReport = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const APP_ID = 'REPORTBREAKDOWN';
  
  try {
    const { id } = req.params;

    // Log API called
    await logReportApiCall({
      appId: APP_ID,
      operation: 'Delete Breakdown Report',
      method: req.method,
      url: req.originalUrl,
      requestData: { abr_id: id },
      userId
    });

    // Validate required fields
    if (!id) {
      await logMissingParameters({
        appId: APP_ID,
        operation: 'Delete Breakdown Report',
        missingParams: ['id'],
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameter: breakdown report ID' 
      });
    }

    // Get org_id from authenticated user
    const org_id = req.user?.org_id;
    if (!org_id) {
      await logUnauthorizedReportAccess({
        appId: APP_ID,
        reportType: 'Breakdown Report Delete',
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized - Missing organization ID' 
      });
    }

    const result = await model.deleteBreakdownReport(id, org_id);
    
    // Log success
    await logReportGenerationSuccess({
      appId: APP_ID,
      operation: 'Delete Breakdown Report',
      requestData: { abr_id: id, org_id },
      responseData: result,
      duration: Date.now() - startTime,
      userId
    });
    
    res.status(200).json(result);
  } catch (err) {
    console.error('Error deleting breakdown report:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column
    });
    
    // Determine error level
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
    
    if (err.code === 'ECONNREFUSED') {
      await logDatabaseConnectionFailure({
        appId: APP_ID,
        reportType: 'Breakdown Report Delete',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else if (isDbError) {
      await logDatabaseQueryError({
        appId: APP_ID,
        reportType: 'Breakdown Report Delete',
        query: 'deleteBreakdownReport',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
    } else {
      await logReportGenerationError({
        appId: APP_ID,
        reportType: 'Breakdown Report Delete',
        error: err,
        filters: { id: req.params.id },
        userId,
        duration: Date.now() - startTime
      });
    }
    
    // Return appropriate error message
    const errorMessage = err.message === 'Breakdown report not found or access denied'
      ? err.message
      : 'Failed to delete breakdown report';
    
    res.status(err.message === 'Breakdown report not found or access denied' ? 404 : 500).json({ 
      success: false,
      error: errorMessage,
      details: err.message
    });
  }
};

module.exports = {
  getReasonCodes,
  getAllReports,
  getUpcomingMaintenanceDate,
  createBreakdownReport,
<<<<<<< HEAD
  updateBreakdownReport
  ,confirmEmployeeReportBreakdown
  ,reopenEmployeeReportBreakdown
=======
  updateBreakdownReport,
  deleteBreakdownReport
>>>>>>> origin/akash
};


