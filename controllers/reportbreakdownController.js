const model = require('../models/reportbreakdownModel');

// GET /api/reportbreakdown/reason-codes?asset_type_id=AT001
const getReasonCodes = async (req, res) => {
  try {
    const orgId = req.user?.org_id || 'ORG001';
    const { asset_type_id: assetTypeId } = req.query;
    const rows = await model.getBreakdownReasonCodes(orgId, assetTypeId || null);
    const data = rows.map(r => ({ id: r.atbrrc_id, text: r.text, asset_type_id: r.asset_type_id }));
    res.status(200).json({ data });
  } catch (err) {
    console.error('Error fetching reason codes:', err);
    res.status(500).json({ error: 'Failed to fetch reason codes' });
  }
};

module.exports = { getReasonCodes };


