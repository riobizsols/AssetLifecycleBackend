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

    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization ID' });
    }

    const rows = await model.getBreakdownReasonCodes(orgId, assetTypeId || null);
    const data = rows.map(r => ({ id: r.atbrrc_id, text: r.text, asset_type_id: r.asset_type_id }));
    res.status(200).json({ data });
  } catch (err) {
    console.error('Error fetching reason codes:', err);
    res.status(500).json({ error: 'Failed to fetch reason codes' });
  }
};

// GET /api/reportbreakdown/upcoming-maintenance/:assetId
const getUpcomingMaintenanceDate = async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }

    const maintenanceData = await model.getUpcomingMaintenanceWithRecommendation(assetId);
    
    res.status(200).json({ 
      data: maintenanceData
    });
  } catch (err) {
    console.error('Error fetching upcoming maintenance date:', err);
    res.status(500).json({ error: 'Failed to fetch upcoming maintenance date' });
  }
};

// POST /api/reportbreakdown/create
const createBreakdownReport = async (req, res) => {
  try {
    const {
      asset_id,
      atbrrc_id,
      reported_by,
      is_create_maintenance,
      description
    } = req.body;

    // Validate required fields
    if (!asset_id || !atbrrc_id || !reported_by || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: asset_id, atbrrc_id, reported_by, description' 
      });
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
      is_create_maintenance: is_create_maintenance || false,
      description,
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

module.exports = {
  getReasonCodes,
  getAllReports,
  getUpcomingMaintenanceDate,
  createBreakdownReport
};


