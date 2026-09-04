const { getChecklistByAssetType: getChecklistByAssetTypeModel, getChecklistByAssetId: getChecklistByAssetIdModel } = require('../models/checklistModel');

function getRequestOrgId(req) {
  try {
    const { getEffectiveListContext } = require('../utils/acmAccess');
    const context = getEffectiveListContext(req);
    return context.orgId || req.user?.org_id || req.query.orgId || null;
  } catch {
    return req.user?.org_id || req.query.orgId || null;
  }
}

// Get checklist by asset type
const getChecklistByAssetType = async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const orgId = getRequestOrgId(req);

    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset Type ID is required'
      });
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context is required'
      });
    }

    const checklistItems = await getChecklistByAssetTypeModel(assetTypeId, orgId);

    // Format the response for frontend
    const formattedChecklist = checklistItems.map(item => ({
      id: item.at_main_checklist_id,
      assetTypeId: item.asset_type_id,
      item: item.text,
      atMainFreqId: item.at_main_freq_id,
      orgId: item.org_id
    }));

    res.json({
      success: true,
      message: 'Checklist retrieved successfully',
      data: formattedChecklist,
      count: formattedChecklist.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getChecklistByAssetType:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve checklist',
      error: error.message
    });
  }
};

// Get checklist by asset ID
const getChecklistByAssetId = async (req, res) => {
  try {
    const { assetId } = req.params;
    const orgId = getRequestOrgId(req);
    const wfamshId = req.query.wfamshId || req.query.wfamsh_id || null;

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context is required'
      });
    }

    const checklistItems = await getChecklistByAssetIdModel(assetId, orgId, wfamshId);

    // Same shape as asset-type checklist for shared ChecklistModal
    const formattedChecklist = checklistItems.map(item => ({
      id: item.at_main_checklist_id,
      assetTypeId: item.asset_type_id,
      item: item.text,
      atMainFreqId: item.at_main_freq_id,
      orgId: item.org_id
    }));

    res.json({
      success: true,
      message: 'Checklist retrieved successfully',
      data: formattedChecklist,
      count: formattedChecklist.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in getChecklistByAssetId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve checklist',
      error: error.message
    });
  }
};

module.exports = {
  getChecklistByAssetType,
  getChecklistByAssetId
};
