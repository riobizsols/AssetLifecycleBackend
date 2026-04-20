const InspectionChecklistModel = require('../models/inspectionChecklistModel');

const getAllChecklists = async (req, res) => {
  try {
    const orgId = req.user?.org_id || 'default';
    console.log(`[InspectionChecklistController] Fetching checklists for org: ${orgId}`);
    
    const checklists = await InspectionChecklistModel.getAllChecklists(orgId);
    
    console.log(`[InspectionChecklistController] Found ${checklists.length} checklists`);
    
    return res.status(200).json({
      success: true,
      data: checklists,
      count: checklists.length
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error fetching checklists:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inspection checklists',
      error: error.message
    });
  }
};

const getResponseTypes = async (req, res) => {
  try {
    console.log('[InspectionChecklistController] Fetching response types');
    
    const responseTypes = await InspectionChecklistModel.getResponseTypes();
    
    return res.status(200).json({
      success: true,
      data: responseTypes,
      count: responseTypes.length
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error fetching response types:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch response types',
      error: error.message
    });
  }
};

const getChecklistById = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.org_id;
    
    const checklist = await InspectionChecklistModel.getChecklistById(id, orgId);
    
    if (!checklist) {
      return res.status(404).json({
        success: false,
        message: 'Inspection checklist not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: checklist
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error fetching checklist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch inspection checklist',
      error: error.message
    });
  }
};

const createChecklist = async (req, res) => {
  try {
    const userId = req.user?.user_id || 'system';
    const orgId = req.user?.org_id || 'default';
    const { inspection_question, irtd_id, expected_value, min_range, max_range, trigger_maintenance } = req.body;
    
    console.log('[InspectionChecklistController] Creating checklist:', { inspection_question, irtd_id });
    
    // Validation
    if (!inspection_question || !inspection_question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Inspection question is required'
      });
    }
    
    if (!irtd_id) {
      return res.status(400).json({
        success: false,
        message: 'Response type is required'
      });
    }
    
    const checklistData = {
      inspection_question: inspection_question.trim(),
      irtd_id,
      expected_value: expected_value || null,
      min_range: (min_range !== null && min_range !== undefined && min_range !== "") ? parseFloat(min_range) : null,
      max_range: (max_range !== null && max_range !== undefined && max_range !== "") ? parseFloat(max_range) : null,
      trigger_maintenance: trigger_maintenance || false,
      created_by: userId,
      org_id: orgId
    };
    
    const newChecklist = await InspectionChecklistModel.createChecklist(checklistData);
    
    console.log('[InspectionChecklistController] Checklist created successfully:', newChecklist);
    
    return res.status(201).json({
      success: true,
      message: 'Inspection checklist created successfully',
      data: newChecklist
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error creating checklist:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create inspection checklist',
      error: error.message
    });
  }
};

const updateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { inspection_question, irtd_id, expected_value, min_range, max_range, trigger_maintenance } = req.body;
    
    console.log('[InspectionChecklistController] Updating checklist:', id);
    
    // Validation
    if (!inspection_question || !inspection_question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Inspection question is required'
      });
    }
    
    if (!irtd_id) {
      return res.status(400).json({
        success: false,
        message: 'Response type is required'
      });
    }
    
    const updateData = {
      inspection_question: inspection_question.trim(),
      irtd_id,
      expected_value: expected_value || null,
      min_range: min_range ? parseFloat(min_range) : null,
      max_range: max_range ? parseFloat(max_range) : null,
      trigger_maintenance: trigger_maintenance || false
    };
    
    const updatedChecklist = await InspectionChecklistModel.updateChecklist(id, updateData);
    
    if (!updatedChecklist) {
      return res.status(404).json({
        success: false,
        message: 'Checklist not found'
      });
    }
    
    console.log('[InspectionChecklistController] Checklist updated successfully:', updatedChecklist);
    
    return res.status(200).json({
      success: true,
      message: 'Inspection checklist updated successfully',
      data: updatedChecklist
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error updating checklist:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to update inspection checklist',
      error: error.message
    });
  }
};

const deleteChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[InspectionChecklistController] Deleting checklist:', id);
    
    const deleted = await InspectionChecklistModel.deleteChecklist(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Checklist not found'
      });
    }
    
    console.log('[InspectionChecklistController] Checklist deleted successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Inspection checklist deleted successfully'
    });
  } catch (error) {
    console.error('[InspectionChecklistController] Error deleting checklist:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to delete inspection checklist',
      error: error.message
    });
  }
};

module.exports = {
  getAllChecklists,
  getChecklistById,
  getResponseTypes,
  createChecklist,
  updateChecklist,
  deleteChecklist
};
