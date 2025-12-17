const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');
const bcrypt = require('bcrypt');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get user's job role by user ID
const getUserJobRole = async (user_id) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT ujr.user_id, ujr.job_role_id, jr.text as job_role_name, jr.job_function
         FROM "tblUserJobRoles" ujr
         JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
         WHERE ujr.user_id = $1`,
        [user_id]
    );
    return result.rows[0];
};

// Assign job role to user
const assignJobRoleToUser = async (user_id, job_role_id, assigned_by) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `INSERT INTO "tblUserJobRoles" 
         (user_id, job_role_id, assigned_by, assigned_on, int_status)
         VALUES ($1, $2, $3, CURRENT_DATE, 1)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
             job_role_id = $2,
             assigned_by = $3,
             assigned_on = CURRENT_DATE,
             int_status = 1
         RETURNING *`,
        [user_id, job_role_id, assigned_by]
    );
    return result.rows[0];
};

// Update user's job role
const updateUserJobRole = async (user_id, job_role_id, updated_by) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `UPDATE "tblUserJobRoles" 
         SET job_role_id = $2, 
             updated_by = $3, 
             updated_on = CURRENT_DATE
         WHERE user_id = $1
         RETURNING *`,
        [user_id, job_role_id, updated_by]
    );
    return result.rows[0];
};

// Get all users with their job roles
const getAllUsersWithJobRoles = async () => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT u.user_id, u.full_name, u.email, ujr.job_role_id, jr.text as job_role_name
         FROM "tblUsers" u
         LEFT JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
         LEFT JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
         WHERE u.int_status = 1
         ORDER BY u.full_name`
    );
    return result.rows;
};

// Check if employee exists in tblUsers by emp_int_id
const checkEmployeeInUsers = async (emp_int_id) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT user_id, emp_int_id FROM "tblUsers" WHERE emp_int_id = $1 AND int_status = 1`,
        [emp_int_id]
    );
    return result.rows[0] || null;
};

// Create user in tblUsers for employee
const createUserForEmployee = async (emp_int_id, job_role_id, created_by, org_id) => {
    try {
        // Generate user_id using ID generator
        const user_id = await generateCustomId('user', 3);
        console.log(`Generated user_id: ${user_id}`);
        
        const dbPool = getDb();
        // Fetch employee data including all necessary fields for user creation
        const employeeResult = await dbPool.query(
            `SELECT 
                full_name, 
                email_id, 
                phone_number, 
                dept_id, 
                branch_id, 
                language_code,
                org_id,
                int_status
             FROM "tblEmployees" 
             WHERE emp_int_id = $1`,
            [emp_int_id]
        );
        
        if (employeeResult.rows.length === 0) {
            throw new Error(`Employee with emp_int_id ${emp_int_id} not found`);
        }
        
        const employee = employeeResult.rows[0];
        
        // Use employee's org_id if provided, otherwise use the passed org_id
        const finalOrgId = employee.org_id || org_id;
        
        // Get initial password from org settings (defaults to "Initial1" if not configured)
        const { getInitialPassword } = require('../utils/orgSettingsUtils');
        const defaultPassword = await getInitialPassword(finalOrgId, dbPool);
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        // Handle dept_id - check if it's a valid non-empty string
        // Use null only if dept_id is actually null/undefined, not if it's an empty string
        const deptId = (employee.dept_id && employee.dept_id.trim() !== '') 
            ? employee.dept_id.trim() 
            : null;
        
        // Handle branch_id similarly
        const branchId = (employee.branch_id && employee.branch_id.trim() !== '') 
            ? employee.branch_id.trim() 
            : null;
        
        // Log the employee data for debugging
        console.log(`Creating user for employee ${emp_int_id}:`, {
            full_name: employee.full_name,
            email_id: employee.email_id,
            phone_number: employee.phone_number,
            dept_id: employee.dept_id,
            branch_id: employee.branch_id,
            language_code: employee.language_code,
            org_id: finalOrgId,
            int_status: employee.int_status
        });
        
        // Insert user with all mapped fields (job_role_id set to null)
        // Map all fields from tblEmployees to tblUsers correctly
        // Field mappings:
        // - full_name -> full_name
        // - email_id -> email
        // - phone_number -> phone
        // - dept_id -> dept_id (properly handled for empty strings)
        // - branch_id -> branch_id (properly handled for empty strings)
        // - language_code -> language_code (uppercase)
        // - org_id -> org_id (from employee or parameter)
        // - Defaults: time_zone='IST', date_format='YYYY-MM-DD', int_status=1
        const result = await dbPool.query(
            `INSERT INTO "tblUsers" (
                user_id, emp_int_id, org_id, full_name, email, phone,
                job_role_id, password, created_by, created_on, changed_by, changed_on,
                time_zone, date_format, dept_id, branch_id, language_code, int_status
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                NULL, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP,
                'IST', 'YYYY-MM-DD', $9, $10, $11, $12
            ) RETURNING user_id, emp_int_id, full_name, email, phone, dept_id, branch_id, language_code, org_id, int_status`,
            [
                user_id, 
                emp_int_id, 
                finalOrgId, 
                employee.full_name || null, 
                employee.email_id || null, 
                employee.phone_number || null,
                hashedPassword, 
                created_by, 
                deptId,  // Use properly handled dept_id
                branchId,  // Use properly handled branch_id
                (employee.language_code?.toLowerCase() || 'en').toUpperCase(),
                employee.int_status || 1  // Use employee status or default to 1 (active)
            ]
        );
        
        console.log(`User created successfully:`, {
            user_id: result.rows[0].user_id,
            emp_int_id: result.rows[0].emp_int_id,
            dept_id: result.rows[0].dept_id,
            branch_id: result.rows[0].branch_id
        });
        
        console.log(`Created user for employee ${emp_int_id} with user_id: ${user_id}`);
        return {
            ...result.rows[0],
            generatedPassword: defaultPassword
        };
    } catch (error) {
        console.error('Error in createUserForEmployee:', error);
        throw error;
    }
};

// Assign job role to user (insert into tblUserJobRoles and update tblUsers.job_role_id)
const assignJobRole = async (user_id, job_role_id, assigned_by) => {
    try {
        console.log(`Assigning role ${job_role_id} to user ${user_id}`);
        
        // Generate user_job_role_id using centralized ID generator with duplicate checking
        const user_job_role_id = await generateCustomId('userjobrole', 3);
        console.log(`Generated user_job_role_id: ${user_job_role_id}`);
        
        const dbPool = getDb();
        
        // Insert into tblUserJobRoles
        const result = await dbPool.query(
            `INSERT INTO "tblUserJobRoles" 
             (user_job_role_id, user_id, job_role_id)
             VALUES ($1, $2, $3)
             RETURNING user_job_role_id, user_id, job_role_id`,
            [user_job_role_id, user_id, job_role_id]
        );
        
        // Update job_role_id in tblUsers only if it's null (set to first role assigned)
        // This allows users to have multiple roles while maintaining a primary role in tblUsers
        await dbPool.query(
            `UPDATE "tblUsers" 
             SET job_role_id = COALESCE(job_role_id, $1), changed_by = $2, changed_on = CURRENT_TIMESTAMP
             WHERE user_id = $3 AND job_role_id IS NULL`,
            [job_role_id, assigned_by, user_id]
        );
        
        console.log(`Updated tblUsers.job_role_id to ${job_role_id} for user ${user_id} (if it was null)`);
        console.log('Role assignment result:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('Error in assignJobRole:', error);
        throw error;
    }
};

// Get all job roles for a specific employee by emp_int_id
const getEmployeeJobRoles = async (emp_int_id) => {
    try {
        console.log(`Querying roles for emp_int_id: ${emp_int_id}`);
        
        const dbPool = getDb();
        // First, let's check if the employee exists in tblUsers
        const userCheck = await dbPool.query(
            `SELECT user_id, emp_int_id FROM "tblUsers" WHERE emp_int_id = $1 AND int_status = 1`,
            [emp_int_id]
        );
        
        console.log(`User check result for emp_int_id ${emp_int_id}:`, userCheck.rows);
        
        if (userCheck.rows.length === 0) {
            console.log(`No user found for emp_int_id ${emp_int_id}`);
            return [];
        }
        
        const user_id = userCheck.rows[0].user_id;
        console.log(`Found user_id: ${user_id} for emp_int_id: ${emp_int_id}`);
        
        // Now get the roles for this user
        const result = await dbPool.query(
            `SELECT ujr.user_job_role_id, ujr.user_id, ujr.job_role_id, jr.text as job_role_name
             FROM "tblUserJobRoles" ujr
             JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
             WHERE ujr.user_id = $1
             ORDER BY ujr.user_job_role_id DESC`,
            [user_id]
        );
        
        console.log(`Query result for emp_int_id ${emp_int_id}:`, result.rows);
        return result.rows;
    } catch (error) {
        console.error(`Error in getEmployeeJobRoles for emp_int_id ${emp_int_id}:`, error);
        throw error;
    }
};

// Get all roles for a specific user by user_id
// If tenantPool is provided, use it; otherwise use default db
const getUserRoles = async (user_id, tenantPool = null) => {
    try {
        console.log(`Fetching roles for user_id: ${user_id}`);
        const connection = tenantPool || getDb();
        
        const result = await connection.query(
            `SELECT ujr.user_job_role_id, ujr.user_id, ujr.job_role_id, 
                    jr.text as job_role_name, jr.job_function
             FROM "tblUserJobRoles" ujr
             JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
             WHERE ujr.user_id = $1
             ORDER BY ujr.user_job_role_id`,
            [user_id]
        );
        
        console.log(`Found ${result.rows.length} roles for user ${user_id}`);
        return result.rows;
    } catch (error) {
        console.error(`Error in getUserRoles for user_id ${user_id}:`, error);
        throw error;
    }
};

// Delete a specific role assignment
const deleteUserRole = async (user_job_role_id) => {
    try {
        console.log(`Deleting role assignment: ${user_job_role_id}`);
        
        const dbPool = getDb();
        const result = await dbPool.query(
            `DELETE FROM "tblUserJobRoles" 
             WHERE user_job_role_id = $1
             RETURNING user_id, job_role_id`,
            [user_job_role_id]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`Role assignment ${user_job_role_id} not found`);
        }
        
        console.log(`Deleted role assignment: ${user_job_role_id}`);
        return result.rows[0];
    } catch (error) {
        console.error(`Error in deleteUserRole for ${user_job_role_id}:`, error);
        throw error;
    }
};

// Update a specific role assignment
const updateUserRole = async (user_job_role_id, new_job_role_id) => {
    try {
        console.log(`Updating role assignment ${user_job_role_id} to role ${new_job_role_id}`);
        
        const dbPool = getDb();
        const result = await dbPool.query(
            `UPDATE "tblUserJobRoles" 
             SET job_role_id = $1
             WHERE user_job_role_id = $2
             RETURNING user_job_role_id, user_id, job_role_id`,
            [new_job_role_id, user_job_role_id]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`Role assignment ${user_job_role_id} not found`);
        }
        
        console.log(`Updated role assignment: ${user_job_role_id}`);
        return result.rows[0];
    } catch (error) {
        console.error(`Error in updateUserRole for ${user_job_role_id}:`, error);
        throw error;
    }
};

// Check if user has any remaining roles
const getUserRoleCount = async (user_id) => {
    try {
        const dbPool = getDb();
        const result = await dbPool.query(
            `SELECT COUNT(*) as role_count 
             FROM "tblUserJobRoles" 
             WHERE user_id = $1`,
            [user_id]
        );
        
        return parseInt(result.rows[0].role_count);
    } catch (error) {
        console.error(`Error in getUserRoleCount for user_id ${user_id}:`, error);
        throw error;
    }
};

// Deactivate user (set int_status = 0)
const deactivateUser = async (user_id) => {
    try {
        console.log(`Deactivating user: ${user_id}`);
        
        const dbPool = getDb();
        const result = await dbPool.query(
            `UPDATE "tblUsers" 
             SET int_status = 0, changed_on = CURRENT_TIMESTAMP
             WHERE user_id = $1
             RETURNING user_id, int_status`,
            [user_id]
        );
        
        console.log(`Deactivated user: ${user_id}`);
        return result.rows[0];
    } catch (error) {
        console.error(`Error in deactivateUser for user_id ${user_id}:`, error);
        throw error;
    }
};

module.exports = {
    getUserJobRole,
    assignJobRoleToUser,
    updateUserJobRole,
    getAllUsersWithJobRoles,
    checkEmployeeInUsers,
    createUserForEmployee,
    assignJobRole,
    getEmployeeJobRoles,
    getUserRoles,
    deleteUserRole,
    updateUserRole,
    getUserRoleCount,
    deactivateUser
}; 