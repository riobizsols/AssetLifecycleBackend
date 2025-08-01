const { getChecklistByAssetType: getChecklistByAssetTypeModel, getChecklistByAssetId: getChecklistByAssetIdModel } = require('../models/checklistModel');

// Get checklist by asset type
const getChecklistByAssetType = async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const orgId = req.query.orgId || 'ORG001';

    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset Type ID is required'
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
    const orgId = req.query.orgId || 'ORG001';

    if (!assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required'
      });
    }

    const checklistItems = await getChecklistByAssetIdModel(assetId, orgId);

    // Format the response for frontend
    const formattedChecklist = checklistItems.map(item => ({
      id: item.checklist_id,
      assetTypeId: item.asset_type_id,
      item: item.checklist_item,
      sequence: item.sequence,
      isMandatory: item.is_mandatory === 'Y' || item.is_mandatory === true,
      status: item.status,
      createdOn: item.created_on
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