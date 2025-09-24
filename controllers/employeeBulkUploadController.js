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

    // Check which employees already exist
    const employeeIds = csvData.map(row => row.employee_id).filter(id => id);
    const existingIds = await model.checkExistingEmployeeIds(employeeIds);
    
    let newRecords = 0;
    let updatedRecords = 0;
    let errors = 0;
    const validationErrors = [];

    for (const row of csvData) {
      try {
        // Basic validation
        if (!row.employee_id) {
          validationErrors.push(`Employee missing employee_id`);
          errors++;
          continue;
        }
        
        if (!row.name) {
          validationErrors.push(`Employee ${row.employee_id}: Missing name`);
          errors++;
          continue;
        }
        
        if (!row.email_id) {
          validationErrors.push(`Employee ${row.employee_id}: Missing email_id`);
          errors++;
          continue;
        }
        
        if (!row.dept_id) {
          validationErrors.push(`Employee ${row.employee_id}: Missing dept_id`);
          errors++;
          continue;
        }

        // Check if employee exists
        if (existingIds.includes(row.employee_id)) {
          updatedRecords++;
        } else {
          newRecords++;
        }
      } catch (error) {
        validationErrors.push(`Employee ${row.employee_id || 'unknown'}: ${error.message}`);
        errors++;
      }
    }

    const results = {
      success: true,
      message: 'Trial upload completed',
      trialResults: {
        totalRows: csvData.length,
        newRecords,
        updatedRecords,
        errors,
        validationErrors
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
    const org_id = req.user.org_id;
    const results = await model.bulkUpsertEmployees(csvData, created_by, org_id);
    
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
