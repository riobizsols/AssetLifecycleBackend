const model = require('../models/reportbreakdownModel');

// GET /api/reportbreakdown/reports
const getAllReports = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    }

    const reports = await model.getAllReports(orgId);
    res.status(200).json({ data: reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};


const getReasonCodes = async (req, res) => {
  try {
    const { asset_type_id: assetTypeId, org_id: orgId } = req.query;

    console.log('Reason codes request params:', { assetTypeId, orgId });

    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization ID' });
    }

    const rows = await model.getBreakdownReasonCodes(orgId, assetTypeId || null);
    console.log('Reason codes from database:', rows.length, 'rows');
    
    const data = rows.map(r => ({ id: r.atbrrc_id, text: r.text, asset_type_id: r.asset_type_id }));
    res.status(200).json({ data });
  } catch (err) {
    console.error('Error fetching reason codes:', err);
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
  try {
    const {
      asset_id,
      atbrrc_id,
      reported_by,
      description,
      decision_code
    } = req.body;

    // Validate required fields
    if (!asset_id || !atbrrc_id || !reported_by || !description || !decision_code) {
      return res.status(400).json({ 
        error: 'Missing required fields: asset_id, atbrrc_id, reported_by, description, decision_code' 
      });
    }

    // Validate decision code
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (!validDecisionCodes.includes(decision_code)) {
      return res.status(400).json({ error: 'Invalid decision code. Must be BF01, BF02, or BF03' });
    }

    // Get org_id from authenticated user
    const org_id = req.user?.org_id;
    if (!org_id) {
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
    
    res.status(201).json({ 
      success: true,
      message: 'Breakdown report created successfully',
      data: result
    });
  } catch (err) {
    console.error('Error creating breakdown report:', err);
    res.status(500).json({ error: 'Failed to create breakdown report' });
  }
};

// PUT /api/reportbreakdown/update/:id
const updateBreakdownReport = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      atbrrc_id,
      description,
      decision_code
    } = req.body;

    // Validate required fields
    if (!atbrrc_id || !description || !decision_code) {
      return res.status(400).json({ 
        error: 'Missing required fields: atbrrc_id, description, decision_code' 
      });
    }

    // Validate decision code
    const validDecisionCodes = ['BF01', 'BF02', 'BF03'];
    if (!validDecisionCodes.includes(decision_code)) {
      return res.status(400).json({ error: 'Invalid decision code. Must be BF01, BF02, or BF03' });
    }

    const updateData = {
      atbrrc_id,
      description,
      decision_code
    };

    const result = await model.updateBreakdownReport(id, updateData);
    
    res.status(200).json({ 
      success: true,
      message: 'Breakdown report updated successfully',
      data: result
    });
  } catch (err) {
    console.error('Error updating breakdown report:', err);
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


