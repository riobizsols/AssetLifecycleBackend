const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require("../utils/idGenerator");

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// GET all employees
const getAllEmployees = async () => {
  const query = `
        SELECT 
            emp_int_id, employee_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        ORDER BY created_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query);
};

// GET employee by ID
const getEmployeeById = async (employee_id) => {
  const query = `
        SELECT 
            emp_int_id, employee_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        WHERE employee_id = $1
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [employee_id]);
};

// GET employees by department
const getEmployeesByDepartment = async (dept_id) => {
  const query = `
        SELECT 
            emp_int_id, employee_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        WHERE dept_id = $1
        ORDER BY created_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [dept_id]);
};

// GET all employees with their current job roles
const getAllEmployeesWithJobRoles = async () => {
  const query = `
        SELECT 
            e.emp_int_id, e.employee_id, e.name, e.first_name, e.last_name, 
            e.middle_name, e.full_name, e.email_id, e.dept_id, e.phone_number, 
            e.employee_type, e.joining_date, e.releiving_date, e.language_code, 
            e.int_status, e.created_by, e.created_on, e.changed_by, e.changed_on,
            u.user_id, u.job_role_id, jr.text as job_role_name, jr.job_function
        FROM "tblEmployees" e
        LEFT JOIN "tblUsers" u ON e.emp_int_id = u.emp_int_id AND u.int_status = 1
        LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id
        WHERE e.int_status = 1
        ORDER BY e.name
    `;

  const dbPool = getDb();
  return await dbPool.query(query);
};

// Check existing employee IDs
const checkExistingEmployeeIds = async (employeeIds) => {
  if (!employeeIds || employeeIds.length === 0) return [];
  
  const placeholders = employeeIds.map((_, index) => `$${index + 1}`).join(',');
  const query = `
    SELECT employee_id FROM "tblEmployees" 
    WHERE employee_id IN (${placeholders})
  `;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, employeeIds);
  return result.rows.map(row => row.employee_id);
};

// Date validation helper
const validateAndFormatDate = (dateString) => {
  if (!dateString || dateString.trim() === '') return null;
  
  // Handle various date formats
  let date;
  if (dateString.includes('-')) {
    // Handle YYYY-MM-DD or DD-MM-YYYY
    const parts = dateString.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      date = new Date(dateString);
    } else if (parts[0].length === 2 && parts[2].length === 4) {
      // DD-MM-YYYY
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      // Try parsing as is
      date = new Date(dateString);
    }
  } else if (dateString.includes('/')) {
    // Handle DD/MM/YYYY or MM/DD/YYYY
    const parts = dateString.split('/');
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      date = new Date(dateString);
    } else if (parts[0].length === 2 && parts[2].length === 4) {
      // DD/MM/YYYY
      date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      // Try parsing as is
      date = new Date(dateString);
    }
  } else {
    date = new Date(dateString);
  }
  
  if (isNaN(date.getTime())) return null;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Bulk upsert employees (insert or update)
const bulkUpsertEmployees = async (csvData, created_by, org_id, userBranchId) => {
  const dbPool = getDb();
  const client = await dbPool.connect();
  
  try {
    await client.query('BEGIN');
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails = [];
    
    console.log('=== Employee Model Bulk Upload Debug ===');
    console.log('org_id:', org_id);
    console.log('userBranchId:', userBranchId);
    
    for (const row of csvData) {
      try {
        // Generate emp_int_id if not provided
        let finalEmpIntId = row.emp_int_id;
        if (!finalEmpIntId) {
          finalEmpIntId = await generateCustomId('emp_int_id', 4);
        }
        
        // Generate employee_id if not provided
        let finalEmployeeId = row.employee_id;
        if (!finalEmployeeId) {
          finalEmployeeId = await generateCustomId('employee', 3);
        }
        
        // Validate and format date fields
        const joiningDate = validateAndFormatDate(row.joining_date);
        const releivingDate = null; // releiving_date is always null by default
        
        // Check if employee already exists
        const existingEmployee = await client.query(
          'SELECT employee_id FROM "tblEmployees" WHERE employee_id = $1',
          [finalEmployeeId]
        );
        
        if (existingEmployee.rows.length > 0) {
          // Update existing employee
          await client.query(`
            UPDATE "tblEmployees" SET
              emp_int_id = $2,
              name = $3,
              first_name = $4,
              last_name = $5,
              middle_name = $6,
              full_name = $7,
              email_id = $8,
              dept_id = $9,
              phone_number = $10,
              employee_type = $11,
              joining_date = $12,
              releiving_date = $13,
              language_code = $14,
              int_status = $15,
              org_id = $16,
              branch_id = $17,
              changed_by = $18,
              changed_on = NOW()::timestamp(3)
            WHERE employee_id = $1
          `, [
            finalEmployeeId,
            finalEmpIntId,
            row.name,
            row.first_name,
            row.last_name,
            row.middle_name,
            row.full_name,
            row.email_id,
            row.dept_id,
            row.phone_number,
            row.employee_type,
            joiningDate,
            releivingDate,
            row.language_code,
            1, // int_status is always 1 by default
            org_id,
            userBranchId,
            created_by
          ]);
          updated++;
        } else {
          // Insert new employee
          await client.query(`
            INSERT INTO "tblEmployees" (
              emp_int_id, employee_id, name, first_name, last_name, middle_name,
              full_name, email_id, dept_id, phone_number, employee_type,
              joining_date, releiving_date, language_code, int_status, org_id,
              branch_id, created_by, created_on, changed_by, changed_on
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
              $17, $18, NOW()::timestamp(3), $18, NOW()::timestamp(3)
            )
          `, [
            finalEmpIntId,
            finalEmployeeId,
            row.name,
            row.first_name,
            row.last_name,
            row.middle_name,
            row.full_name,
            row.email_id,
            row.dept_id,
            row.phone_number,
            row.employee_type,
            joiningDate,
            releivingDate,
            row.language_code,
            1, // int_status is always 1 by default
            org_id,
            userBranchId,
            created_by
          ]);
          inserted++;
        }
      } catch (error) {
        console.error(`Error processing employee ${row.employee_id || 'unknown'}:`, error);
        errors++;
        errorDetails.push({
          row: row,
          error: error.message
        });
      }
    }
    
    await client.query('COMMIT');
    
    return {
      inserted,
      updated,
      errors,
      errorDetails
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getEmployeesByDepartment,
  getAllEmployeesWithJobRoles,
  checkExistingEmployeeIds,
  bulkUpsertEmployees,
  validateAndFormatDate
};
