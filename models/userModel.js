const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Find user by email or username (used for login)
// Checks tblRioAdmin first if email/username is "rioadmin", otherwise checks tblUsers
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const findUserByEmail = async (emailOrUsername, tenantPool = null) => {
    const connection = tenantPool || getDb();
    
    // Check if this is a RioAdmin login attempt (username = "rioadmin")
    if (emailOrUsername && emailOrUsername.toLowerCase() === 'rioadmin') {
        const rioAdminResult = await connection.query(
            'SELECT *, \'tblRioAdmin\' as source_table FROM "tblRioAdmin" WHERE username = $1 OR email = $1',
            [emailOrUsername]
        );
        if (rioAdminResult.rows.length > 0) {
            return rioAdminResult.rows[0];
        }
    }
    
    // Check tblRioAdmin by email (in case email is used)
    const rioAdminByEmailResult = await connection.query(
        'SELECT *, \'tblRioAdmin\' as source_table FROM "tblRioAdmin" WHERE email = $1',
        [emailOrUsername]
    );
    if (rioAdminByEmailResult.rows.length > 0) {
        return rioAdminByEmailResult.rows[0];
    }
    
    // Fall back to tblUsers (normal login)
    const result = await connection.query(
        'SELECT *, \'tblUsers\' as source_table FROM "tblUsers" WHERE email = $1',
        [emailOrUsername]
    );
    return result.rows[0];
};

// Create user — called by super_admin
const createUser = async ({
    org_id,
    user_id,
    full_name,
    email,
    phone,
    job_role_id,
    password,
    created_by,
    time_zone,
    dept_id
}) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `INSERT INTO "tblUsers" (
            org_id, user_id,
            full_name, email, phone,
            job_role_id, password,
            created_by, created_on,
            changed_by, changed_on,
            time_zone, dept_id
        ) VALUES (
            $1, $2,
            $3, $4, $5,
            $6, $7,
            $8, CURRENT_DATE,
            $8, CURRENT_DATE,
            $9, $10
        ) RETURNING *`,
        [
            org_id,     
            user_id,    
            full_name,    
            email,        
            phone,        
            job_role_id,  
            password,     
            created_by,   
            time_zone || 'IST',
            dept_id
        ]
    );

    return result.rows[0];
};



// Set reset token for password reset
const setResetToken = async (email, token, expiry) => {
    const dbPool = getDb();
    await dbPool.query(
        `UPDATE "tblUsers"
         SET reset_token = $1, reset_token_expiry = $2
         WHERE email = $3`,
        [token, expiry, email]
    );
};

// Find user by valid reset token
const findUserByResetToken = async (token) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT * FROM "tblUsers"
         WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
        [token]
    );
    return result.rows[0];
};

// Update user password after reset
const updatePassword = async ({ org_id, user_id }, hashedPassword, changed_by) => {
    const dbPool = getDb();
    await dbPool.query(
        `UPDATE "tblUsers"
         SET password = $1,
             reset_token = NULL,
             reset_token_expiry = NULL,
             changed_by = $2,
             changed_on = CURRENT_DATE
         WHERE org_id = $3 AND user_id = $4`,
        [hashedPassword, changed_by, org_id, user_id]
    );
};

// Get all users
const getAllUsers = async () => {
    const dbPool = getDb();
    const query = `
        SELECT 
            u.*,
            d.text as dept_name,
            b.text as branch_name,
            jr.text as job_role_name
        FROM "tblUsers" u
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id AND d.org_id = u.org_id
        LEFT JOIN "tblBranches" b ON d.branch_id = b.branch_id AND b.org_id = u.org_id
        LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id AND jr.org_id = u.org_id
        ORDER BY u.full_name
    `;
    const result = await dbPool.query(query);
    return result.rows;
};

// Get user with branch information
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const getUserWithBranch = async (userId, tenantPool = null) => {
    const connection = tenantPool || getDb();
    const query = `
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.phone,
            u.job_role_id,
            u.int_status,
            u.dept_id,
            u.created_on,
            u.changed_on,
            u.last_accessed,
            d.text as dept_name,
            d.branch_id,
            b.branch_id,
            b.text as branch_name,
            jr.text as job_role_name
        FROM "tblUsers" u
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        LEFT JOIN "tblBranches" b ON d.branch_id = b.branch_id
        LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id
        WHERE u.user_id = $1
    `;
    
    const result = await connection.query(query, [userId]);
    return result.rows[0];
};

// Get all users with branch information
const getAllUsersWithBranch = async (orgId) => {
    const query = `
        SELECT 
            u.user_id,
            u.full_name,
            u.email,
            u.phone,
            u.job_role_id,
            u.int_status,
            u.dept_id,
            u.created_on,
            u.changed_on,
            u.last_accessed,
            d.text as dept_name,
            d.branch_id,
            b.branch_id,
            b.text as branch_name,
            jr.text as job_role_name
        FROM "tblUsers" u
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id AND d.org_id = u.org_id
        LEFT JOIN "tblBranches" b ON d.branch_id = b.branch_id AND b.org_id = u.org_id
        LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id AND jr.org_id = u.org_id
        WHERE u.org_id = $1
        ORDER BY u.full_name
    `;
    
    const dbPool = getDb();
    const result = await dbPool.query(query, [orgId]);
    return result.rows;
};

// Delete one or more users
const deleteUsers = async (userIds = []) => {
    if (!userIds.length) return;

    try {
        const dbPool = getDb();
        // First check for dependencies
        // Note: tblVendors doesn't have a user_id foreign key - contact info is stored as text fields
        const dependencies = await dbPool.query(`
            SELECT DISTINCT u.user_id, u.full_name,
                'Department Admin' as role
            FROM "tblUsers" u
            INNER JOIN "tblDeptAdmins" da ON u.user_id = da.user_id
            WHERE u.user_id = ANY($1::text[])
        `, [userIds]);

        // If dependencies found, throw detailed error
        if (dependencies.rows.length > 0) {
            const error = new Error('Users have dependencies');
            error.code = '23503';
            error.dependencies = dependencies.rows;
            error.detail = `Users have active roles: ${dependencies.rows.map(d => 
                `${d.user_id} (${d.role})`).join(', ')}`;
            throw error;
        }

        // If no dependencies, proceed with deletion
        const result = await dbPool.query(
            `DELETE FROM "tblUsers" WHERE user_id = ANY($1::text[])`,
            [userIds]
        );
        
        return result.rowCount;
    } catch (error) {
        // If it's our custom dependency error, throw it as is
        if (error.dependencies) {
            throw error;
        }
        
        // For other errors, log and rethrow
        console.error('Error in deleteUsers:', error);
        throw error;
    }
};

// Update user by user_id
const updateUser = async (user_id, fieldsToUpdate = {}) => {
    const keys = Object.keys(fieldsToUpdate);
    if (!keys.length) return;

    const setClause = keys.map((key, idx) => `${key} = $${idx + 2}`).join(", ");
    const values = [user_id, ...keys.map((key) => fieldsToUpdate[key])];

    const dbPool = getDb();
    const result = await dbPool.query(
        `UPDATE "tblUsers" SET ${setClause} WHERE user_id = $1 RETURNING *`,
        values
    );

    return result.rows[0];
};



module.exports = {
    findUserByEmail,
    createUser,
    setResetToken,
    findUserByResetToken,
    updatePassword,
    getAllUsers,
    getUserWithBranch,
    getAllUsersWithBranch,
    deleteUsers,
    updateUser,
};