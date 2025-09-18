const db = require("../config/db");

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

  return await db.query(query);
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

  return await db.query(query, [employee_id]);
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

  return await db.query(query, [dept_id]);
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

  return await db.query(query);
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  getEmployeesByDepartment,
  getAllEmployeesWithJobRoles,
};
