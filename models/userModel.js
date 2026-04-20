const { getDbFromContext } = require('../utils/dbContext');
const logger = require('../utils/logger');

// Always get pool at call time via getDb() so we use the live pool (no cached/stale reference).
const getDb = () => getDbFromContext();

// Find user by email or username (used for login)
// For tenant database connections, query tblUsers only (tenant DBs don't have tblRioAdmin).
// For default database connections, support both tblRioAdmin and tblUsers lookups.
const findUserByEmail = async (emailOrUsername, tenantPool = null) => {
    const runLookup = async (connection, includeRioAdmin) => {
        // Check if this is a RioAdmin login attempt (username = "rioadmin")
        if (includeRioAdmin && emailOrUsername && emailOrUsername.toLowerCase() === 'rioadmin') {
            const rioAdminResult = await connection.query(
                'SELECT *, \'tblRioAdmin\' as source_table FROM "tblRioAdmin" WHERE username = $1 OR email = $1',
                [emailOrUsername]
            );
            if (rioAdminResult.rows.length > 0) {
                return rioAdminResult.rows[0];
            }
        }
        
        if (includeRioAdmin) {
            // Check tblRioAdmin by email (in case email is used)
            const rioAdminByEmailResult = await connection.query(
                'SELECT *, \'tblRioAdmin\' as source_table FROM "tblRioAdmin" WHERE email = $1',
                [emailOrUsername]
            );
            if (rioAdminByEmailResult.rows.length > 0) {
                return rioAdminByEmailResult.rows[0];
            }
        }
        
        // Fall back to tblUsers (normal login)
        const result = await connection.query(
            'SELECT *, \'tblUsers\' as source_table FROM "tblUsers" WHERE email = $1',
            [emailOrUsername]
        );
        return result.rows[0];
    };

    if (tenantPool) {
        logger.debug(`[UserModel] 🔍 Searching tenant user with identifier: "${emailOrUsername}"`);
        // Tenant DBs are schema-isolated and do not contain tblRioAdmin.
        return runLookup(tenantPool, false);
    }

    const connection = getDb();
    logger.debug(`[UserModel] 🔍 Searching default user with identifier: "${emailOrUsername}"`);
    try {
        return await runLookup(connection, true);
    } catch (err) {
        // If tblRioAdmin doesn't exist in current DB context, fallback safely to tblUsers.
        if (err && (err.code === '42P01' || String(err.message || '').includes('tblRioAdmin'))) {
            logger.warn('[UserModel] tblRioAdmin table not found, falling back to tblUsers-only lookup');
            const userResult = await connection.query(
                'SELECT *, \'tblUsers\' as source_table FROM "tblUsers" WHERE email = $1',
                [emailOrUsername]
            );
            return userResult.rows[0];
        }
        throw err;
    }
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
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const setResetToken = async (email, token, expiry, tenantPool = null) => {
    const connection = tenantPool || getDb();
    
    logger.debug(`[UserModel] Setting reset token for email: "${email}"`);
    logger.debug(`[UserModel] Using ${tenantPool ? 'tenant' : 'default'} database connection`);
    
    await connection.query(
        `UPDATE "tblUsers"
         SET reset_token = $1, reset_token_expiry = $2
         WHERE email = $3`,
        [token, expiry, email]
    );
    
    logger.debug(`[UserModel] ✅ Reset token set for email: "${email}"`);
};

// Find user by valid reset token
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const findUserByResetToken = async (token, tenantPool = null) => {
    const connection = tenantPool || getDb();
    
    logger.debug(`[UserModel] 🔍 Searching for user with reset token`);
    logger.debug(`[UserModel] Using ${tenantPool ? 'tenant' : 'default'} database connection`);
    
    const result = await connection.query(
        `SELECT * FROM "tblUsers"
         WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
        [token]
    );
    
    if (result.rows.length > 0) {
        logger.debug(`[UserModel] ✅ User found with valid reset token: ${result.rows[0].user_id} (${result.rows[0].email})`);
    } else {
        logger.debug(`[UserModel] ❌ No user found with valid reset token`);
    }
    
    return result.rows[0];
};

// Update user password after reset
// If tenantPool is provided, use it; otherwise use getDb() which gets from context
const updatePassword = async ({ org_id, user_id }, hashedPassword, changed_by, tenantPool = null) => {
    const connection = tenantPool || getDb();
    
    logger.debug(`[UserModel] Updating password for user_id: ${user_id}, org_id: ${org_id}`);
    logger.debug(`[UserModel] Using ${tenantPool ? 'tenant' : 'default'} database connection`);
    
    await connection.query(
        `UPDATE "tblUsers"
         SET password = $1,
             reset_token = NULL,
             reset_token_expiry = NULL,
             changed_by = $2,
             changed_on = CURRENT_DATE
         WHERE org_id = $3 AND user_id = $4`,
        [hashedPassword, changed_by, org_id, user_id]
    );
    
    logger.debug(`[UserModel] ✅ Password updated for user_id: ${user_id}`);
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