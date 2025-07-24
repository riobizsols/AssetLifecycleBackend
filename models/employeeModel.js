const db = require("../config/db");

// GET all employees
const getAllEmployees = async () => {
  const query = `
        SELECT 
            emp_int_id, employee_id, ext_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        ORDER BY created_on DESC
    `;

  return await db.query(query);
};

// GET employee by ID
const getEmployeeById = async (employee_id) => {
  const query = `
        SELECT 
            emp_int_id, employee_id, ext_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        WHERE employee_id = $1
    `;

  return await db.query(query, [employee_id]);
};

// GET employees by department
const getEmployeesByDepartment = async (dept_id) => {
  const query = `
        SELECT 
            emp_int_id, employee_id, ext_id, name, first_name, last_name, 
            middle_name, full_name, email_id, dept_id, phone_number, 
            employee_type, joining_date, releiving_date, language_code, 
            int_status, created_by, created_on, changed_by, changed_on
        FROM "tblEmployees"
        WHERE dept_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [dept_id]);
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getEmployeesByDepartment,
};
