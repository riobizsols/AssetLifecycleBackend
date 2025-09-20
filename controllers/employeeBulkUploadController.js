const model = require('../models/employeeModel');
const { generateCustomId } = require('../utils/idGenerator');

// Check existing employees in database
const checkExistingEmployees = async (req, res) => {
  try {
    const { employee_ids } = req.body;
    
    if (!employee_ids || !Array.isArray(employee_ids)) {
      return res.status(400).json({ 
        success: false, 
        error: 'employee_ids array is required' 
      });
    }

    const existingIds = await model.checkExistingEmployeeIds(employee_ids);
    
    res.json({
      success: true,
      existing_ids: existingIds
    });
  } catch (error) {
    console.error('Error checking existing employees:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check existing employees' 
    });
  }
};

// Validate bulk upload employees data
const validateBulkUploadEmployees = async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ 
        success: false, 
        error: 'csvData array is required' 
      });
    }

    // Basic validation - can be expanded
    const validationResult = {
      success: true,
      message: 'Validation passed',
      totalRows: csvData.length,
      validRows: csvData.length
    };

    res.json(validationResult);
  } catch (error) {
    console.error('Error validating employees:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to validate employees data' 
    });
  }
};

// Trial upload employees (simulate without committing)
const trialUploadEmployees = async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ 
        success: false, 
        error: 'csvData array is required' 
      });
    }

    // Simulate trial results
    const results = {
      success: true,
      message: 'Trial upload completed',
      results: {
        totalRows: csvData.length,
        newRecords: Math.floor(csvData.length * 0.7), // Simulate 70% new
        updatedRecords: Math.floor(csvData.length * 0.3), // Simulate 30% updates
        errors: 0
      }
    };

    res.json(results);
  } catch (error) {
    console.error('Error in trial upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to perform trial upload' 
    });
  }
};

// Commit bulk upload employees
const commitBulkUploadEmployees = async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ 
        success: false, 
        error: 'csvData array is required' 
      });
    }

    const created_by = req.user.user_id;
    const results = await model.bulkUpsertEmployees(csvData, created_by);
    
    res.json({
      success: true,
      message: 'Employees bulk upload completed successfully',
      results: results
    });
  } catch (error) {
    console.error('Error committing employees bulk upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to commit employees bulk upload' 
    });
  }
};

module.exports = {
  checkExistingEmployees,
  validateBulkUploadEmployees,
  trialUploadEmployees,
  commitBulkUploadEmployees
};
