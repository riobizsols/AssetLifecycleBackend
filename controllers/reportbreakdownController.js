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

module.exports = {
  getReasonCodes,
  getAllReports
};


