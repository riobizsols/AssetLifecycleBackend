const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

//  Find user by email (used for login)
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const findUserByEmail = async (email, tenantPool = null) => {
    const connection = tenantPool || getDb();
    const result = await connection.query(
        'SELECT * FROM "tblUsers" WHERE email = $1',
        [email]
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
    const result = await dbPool.query(`SELECT * FROM "tblUsers"`);
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
        LEFT JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        LEFT JOIN "tblBranches" b ON d.branch_id = b.branch_id
        LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id
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
        const dependencies = await dbPool.query(`
            SELECT DISTINCT u.user_id, u.full_name,
                CASE
                    WHEN da.user_id IS NOT NULL THEN 'Department Admin'
                    WHEN a.user_id IS NOT NULL THEN 'Asset Owner'
                    WHEN das.user_id IS NOT NULL THEN 'Department Asset Manager'
                    WHEN v.contact_person_id IS NOT NULL THEN 'Vendor Contact'
                END as role
            FROM "tblUsers" u
            LEFT JOIN "tblDeptAdmins" da ON u.user_id = da.user_id
            LEFT JOIN "tblAssets" a ON u.user_id = a.user_id
            LEFT JOIN "tblDeptAssets" das ON u.user_id = das.user_id
            LEFT JOIN "tblVendors" v ON u.user_id = v.contact_person_id
            WHERE u.user_id = ANY($1::text[])
            AND (da.user_id IS NOT NULL 
                OR a.user_id IS NOT NULL 
                OR das.user_id IS NOT NULL 
                OR v.contact_person_id IS NOT NULL)
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