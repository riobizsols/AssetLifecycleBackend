const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    findUserByEmail,
    createUser,
    setResetToken, 
    findUserByResetToken,
    updatePassword,
    getUserWithBranch
} = require('../models/userModel');
const { sendResetEmail } = require('../utils/mailer');
const { getUserRoles } = require('../models/userJobRoleModel');
const { getInitialPassword } = require('../utils/orgSettingsUtils');
const { 
    logLoginApiCalled,
    logCheckingUserInDatabase,
    logUserFound,
    logUserNotFound,
    logComparingPassword,
    logPasswordMatched,
    logPasswordNotMatched,
    logGeneratingToken,
    logTokenGenerated,
    logSuccessfulLogin, 
    logFailedLogin, 
    logLoginCriticalError 
} = require('../eventLoggers/authEventLogger');
require('dotenv').config();

// 🔐 JWT Creator
const generateToken = (user, useDefaultDb = false) => {
    return jwt.sign({
        org_id: user.org_id,
        user_id: user.user_id,
        email: user.email,
        job_role_id: user.job_role_id,
        emp_int_id: user.emp_int_id,
        use_default_db: useDefaultDb // Flag to force default database usage
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// 🔑 Login (Supports both subdomain-based multi-tenant and normal database login)
// - If subdomain exists: Uses subdomain to find org_id and tenant database
// - If no subdomain (e.g., localhost): Uses default database from .env (normal login)
const login = async (req, res) => {
    const startTime = Date.now();
    const { email, password } = req.body;
    
    try {
        // Step 1: Log API called
        await logLoginApiCalled({
            email,
            method: req.method,
            url: req.originalUrl
        });

        // Step 2: Check if subdomain-based login or normal database login
        const { getOrgIdFromSubdomain, extractSubdomain } = require('../utils/subdomainUtils');
        
        // Try multiple ways to get hostname (for different proxy configurations)
        const hostname = req.get('host') || req.get('x-forwarded-host') || req.hostname || req.headers.host;
        const subdomain = extractSubdomain(hostname);
        
        console.log(`[AuthController] 🔍 Login Debug Info:`);
        console.log(`  - req.get('host'): ${req.get('host')}`);
        console.log(`  - req.get('x-forwarded-host'): ${req.get('x-forwarded-host')}`);
        console.log(`  - req.hostname: ${req.hostname}`);
        console.log(`  - req.headers.host: ${req.headers.host}`);
        console.log(`  - Extracted hostname: ${hostname}`);
        console.log(`  - Extracted subdomain: ${subdomain}`);
        
        const { checkTenantExists, getTenantPool } = require('../services/tenantService');
        const defaultDb = require('../config/db');
        let dbPool = defaultDb;
        let isTenant = false;
        let orgId = null;
        let loginMode = 'normal'; // 'normal' or 'subdomain'
        
        // If subdomain exists, use subdomain-based login
        if (subdomain) {
            loginMode = 'subdomain';
            orgId = await getOrgIdFromSubdomain(subdomain);
            
            console.log(`[AuthController] 🔍 Subdomain lookup result: org_id = ${orgId}`);
            
            if (!orgId) {
                console.error(`[AuthController] ❌ Organization not found for subdomain: ${subdomain}`);
                return res.status(404).json({ 
                    message: `Organization not found for subdomain: ${subdomain}` 
                });
            }
            
            console.log(`[AuthController] ✅ Subdomain-based login: ${subdomain}, org_id: ${orgId}`);
            
            // Step 3: Log checking user in database
            await logCheckingUserInDatabase({ email, orgId, subdomain });
            
            // Check if this is a tenant organization
            const tenantExists = await checkTenantExists(orgId);
            console.log(`[AuthController] 🔍 Tenant check for org_id ${orgId}: ${tenantExists ? 'EXISTS' : 'NOT FOUND'}`);
            
            if (tenantExists) {
                dbPool = await getTenantPool(orgId);
                isTenant = true;
                console.log(`[AuthController] ✅ Using tenant database for org_id: ${orgId}`);
            } else {
                console.log(`[AuthController] ⚠️ Using default database for org_id: ${orgId} (tenant not found)`);
            }
        } else {
            // No subdomain - use normal database login (from .env DATABASE_URL)
            console.log(`[AuthController] ℹ️ Normal database login (no subdomain) - using default database from .env`);
            await logCheckingUserInDatabase({ email, orgId: null, subdomain: null });
            // dbPool is already set to defaultDb
        }
        
        // Step 5: Find user in the appropriate database
        const user = await findUserByEmail(email, dbPool);
        
        // For subdomain-based login, verify user belongs to the correct organization
        if (loginMode === 'subdomain' && user && user.org_id !== orgId) {
            await logUserNotFound({ email, orgId, reason: 'User belongs to different organization' });
            await logFailedLogin({
                email,
                userId: null,
                reason: 'User not found in this organization',
                duration: Date.now() - startTime
            });
            return res.status(404).json({ message: 'User not found in this organization' });
        }
        
        // For normal login, set orgId from user if found
        if (loginMode === 'normal' && user) {
            orgId = user.org_id;
            console.log(`[AuthController] Normal login - user org_id: ${orgId}`);
        }
        
        if (!user) {
            // Step 3a: User not found
            await logUserNotFound({ email });
            
            // Log failed login attempt - user not found
            await logFailedLogin({
                email,
                userId: null,
                reason: 'User not found',
                duration: Date.now() - startTime
            });

            return res.status(404).json({ message: 'User not found' });
        }

        // Step 3b: User found
        await logUserFound({ 
            email, 
            userId: user.user_id,
            userData: {
                full_name: user.full_name,
                org_id: user.org_id,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id
            }
        });

        // Step 4: Log comparing password
        await logComparingPassword({ email, userId: user.user_id });
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            // Step 5a: Password not matched
            await logPasswordNotMatched({ email, userId: user.user_id });
            
            // Log failed login attempt - invalid credentials
            await logFailedLogin({
                email,
                userId: user.user_id,
                reason: 'Invalid credentials',
                duration: Date.now() - startTime
            });

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step 5b: Password matched
        await logPasswordMatched({ email, userId: user.user_id });

        // Check if this is a RioAdmin user (from tblRioAdmin)
        const isRioAdmin = user.source_table === 'tblRioAdmin';
        
        // Check if password matches the initial password from org settings
        const initialPassword = await getInitialPassword(user.org_id, dbPool);
        const isInitialPassword = await bcrypt.compare(initialPassword, user.password);
        
        // Update last_accessed field in the appropriate table
        if (isRioAdmin) {
            await dbPool.query(
                `UPDATE "tblRioAdmin" 
                 SET last_accessed = CURRENT_DATE 
                 WHERE org_id = $1 AND user_id = $2`,
                [user.org_id, user.user_id]
            );
        } else {
            await dbPool.query(
                `UPDATE "tblUsers" 
                 SET last_accessed = CURRENT_DATE 
                 WHERE org_id = $1 AND user_id = $2`,
                [user.org_id, user.user_id]
            );
        }

        // Fetch all user roles from tblUserJobRoles (RioAdmin might not have roles, so handle gracefully)
        let userRoles = [];
        try {
            userRoles = await getUserRoles(user.user_id, dbPool);
        } catch (roleError) {
            // If RioAdmin doesn't have roles, that's okay - they have admin access by default
            console.log(`[AuthController] No roles found for user ${user.user_id}, continuing...`);
        }
        
        // For RioAdmin, create a default admin role if no roles exist
        if (isRioAdmin && userRoles.length === 0) {
            userRoles = [{
                user_job_role_id: 'UJR_RIOADMIN',
                user_id: user.user_id,
                job_role_id: 'JR001', // System Administrator
                job_role_name: 'System Administrator'
            }];
        }
        
        // Fetch user with branch information (using the appropriate database)
        let userWithBranch = null;
        if (isRioAdmin) {
            // For RioAdmin, get branch info directly from the user record or join with departments
            const branchQuery = `
                SELECT 
                    ra.user_id,
                    ra.full_name,
                    ra.email,
                    ra.phone,
                    ra.job_role_id,
                    ra.int_status,
                    ra.dept_id,
                    ra.branch_id,
                    d.text as dept_name,
                    b.text as branch_name,
                    b.branch_code,
                    jr.text as job_role_name
                FROM "tblRioAdmin" ra
                LEFT JOIN "tblDepartments" d ON ra.dept_id = d.dept_id
                LEFT JOIN "tblBranches" b ON ra.branch_id = b.branch_id OR d.branch_id = b.branch_id
                LEFT JOIN "tblJobRoles" jr ON ra.job_role_id = jr.job_role_id
                WHERE ra.user_id = $1
            `;
            const branchResult = await dbPool.query(branchQuery, [user.user_id]);
            userWithBranch = branchResult.rows[0];
        } else {
            userWithBranch = await getUserWithBranch(user.user_id, dbPool);
        }
        
        // Fetch language_code from employee table if emp_int_id exists (RioAdmin doesn't have emp_int_id)
        let language_code = user.language_code || 'en'; // default language
        if (!isRioAdmin && user.emp_int_id) {
            const employeeResult = await dbPool.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [user.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Step 6: Log generating token
        await logGeneratingToken({ email, userId: user.user_id });
        
        // Generate token with tenant information
        // If tenant exists, don't set use_default_db flag so middleware uses tenant database
        const token = generateToken(user, !isTenant);
        
        // Step 7: Log token generated
        await logTokenGenerated({ 
            email, 
            userId: user.user_id,
            tokenPayload: {
                org_id: user.org_id,
                user_id: user.user_id,
                email: user.email,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id,
                use_default_db: !isTenant,
                subdomain: subdomain || null,
                loginMode: loginMode
            }
        });
        
        const duration = Date.now() - startTime;

        // Step 8: Log successful login (final summary with response data)
        await logSuccessfulLogin({
            email,
            userId: user.user_id,
            duration,
            responseData: {
                full_name: user.full_name,
                org_id: user.org_id,
                branch_id: userWithBranch?.branch_id,
                branch_name: userWithBranch?.branch_name,
                roles: userRoles,
                language_code
            }
        });

        res.json({
            token,
            requiresPasswordChange: isInitialPassword, // Flag to indicate password needs to be changed
            user: {
                full_name: user.full_name,
                email: user.email,
                org_id: user.org_id,
                user_id: user.user_id,
                job_role_id: user.job_role_id, // Keep for backward compatibility
                emp_int_id: user.emp_int_id,
                roles: userRoles, // Add all roles
                branch_id: userWithBranch?.branch_id || null,
                branch_name: userWithBranch?.branch_name || null,
                branch_code: userWithBranch?.branch_code || null,
                dept_id: userWithBranch?.dept_id || null,
                dept_name: userWithBranch?.dept_name || null,
                language_code: language_code
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log CRITICAL error - system failure during login
        await logLoginCriticalError({
            email,
            error,
            duration
        });

        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// 👤 Register new user (super_admin only)
const register = async (req, res) => {
    const {
        full_name,
        email,
        phone,
        password,
        job_role_id,
        user_id,
        time_zone,
        dept_id // optional field from frontend
    } = req.body;

    // Only super_admin can register new users
    if (req.user.job_role_id !== 'super_admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    // Check if the email already exists
    const existing = await findUserByEmail(email);
    if (existing) {
        return res.status(400).json({ message: 'Email already exists' });
    }

    //  Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Create the user in tblUsers
    const user = await createUser({
        org_id: req.user.org_id,
        user_id,
        full_name,
        email,
        phone,
        job_role_id,
        password: hashedPassword,
        created_by: req.user.user_id,
        time_zone: time_zone || 'IST',
        dept_id
    });

    // ✅ Return success response
    res.status(201).json({
        message: 'User created successfully',
        user: {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            job_role_id: user.job_role_id,
            dept_id: user.dept_id
        }
    });
};



// 🔒 Forgot Password
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const user = await findUserByEmail(email);

    if (!user) return res.status(404).json({ message: 'Email not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await setResetToken(email, token, expiry);
    await sendResetEmail(email, token);

    res.json({ message: 'Password reset link sent to email' });
};

// 🔁 Reset Password
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    const user = await findUserByResetToken(token);
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await updatePassword({
        org_id: user.org_id,
        user_id: user.user_id
    }, hashedPassword, user.user_id); // changed_by = user_id

    res.json({ message: 'Password has been reset successfully' });
};


// 🔄 Refresh Token
const refreshToken = async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
    }

    try {
        // Verify the existing token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const { getTenantPool, checkTenantExists } = require('../services/tenantService');
        let dbPool;
        
        // Check if this is a tenant user or normal user
        if (decoded.org_id) {
            try {
                const tenantExists = await checkTenantExists(decoded.org_id);
                if (tenantExists) {
                    // Tenant user - use tenant database
                    dbPool = await getTenantPool(decoded.org_id);
                } else {
                    // Normal user - use default database
                    dbPool = req.db || require('../config/db');
                }
            } catch (tenantError) {
                // Fall back to default database for normal users
                dbPool = db;
            }
        } else {
            // No org_id - use default database
            dbPool = require('../config/db');
        }
        
        // Check if user still exists and is active (using appropriate database)
        const user = await findUserByEmail(decoded.email, dbPool);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // Fetch current user roles (using appropriate database)
        const userRoles = await getUserRoles(user.user_id, dbPool);
        
        // Fetch user with branch information (using appropriate database)
        const userWithBranch = await getUserWithBranch(user.user_id, dbPool);
        
        // Fetch language_code from employee table if emp_int_id exists (using appropriate database)
        let language_code = 'en'; // default language
        if (user.emp_int_id) {
            const employeeResult = await dbPool.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [user.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Generate new token (preserve use_default_db flag from original token)
        // IMPORTANT: Use decoded.org_id (tenant org_id from token), not user.org_id (generated org_id from database)
        // This ensures the token has the correct org_id for tenant lookup
        const refreshTokenUser = {
            ...user,
            org_id: decoded.org_id // Use org_id from token (tenant org_id), not from user record
        };
        const newToken = generateToken(refreshTokenUser, decoded.use_default_db || false);
        
        res.json({
            success: true,
            token: newToken,
            user: {
                full_name: user.full_name,
                email: user.email,
                org_id: decoded.org_id, // Return org_id from token (tenant org_id), not from user record
                user_id: user.user_id,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id,
                roles: userRoles,
                branch_id: userWithBranch?.branch_id || null,
                branch_name: userWithBranch?.branch_name || null,
                branch_code: userWithBranch?.branch_code || null,
                dept_id: userWithBranch?.dept_id || null,
                dept_name: userWithBranch?.dept_name || null,
                language_code: language_code
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
};

// 🔐 Super Admin: Update Own Password
const updateOwnPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { org_id, user_id } = req.user;

    // Use tenant database from request context (set by middleware)
    const dbPool = req.db || require("../config/db");
    const result = await dbPool.query(
        'SELECT * FROM "tblUsers" WHERE org_id = $1 AND user_id = $2',
        [org_id, user_id]
    );
    const user = result.rows[0];

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.job_role_id !== 'super_admin') {
        return res.status(403).json({ message: 'Only super_admins can change their own password' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbPool.query(
        'UPDATE "tblUsers" SET password = $1 WHERE org_id = $2 AND user_id = $3',
        [hashedPassword, org_id, user_id]
    );

    res.json({ message: 'Password updated successfully' });
};

// 🔐 Change Password (for authenticated users, especially those with Initial1 password)
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { org_id, user_id } = req.user;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
    }

    // Use tenant database from request context (set by middleware)
    const dbPool = req.db || require("../config/db");
    
    // First, check if user is in tblRioAdmin (super admin)
    let user = null;
    let isRioAdmin = false;
    let tableName = 'tblUsers';
    
    const rioAdminResult = await dbPool.query(
        'SELECT * FROM "tblRioAdmin" WHERE user_id = $1',
        [user_id]
    );
    
    if (rioAdminResult.rows.length > 0) {
        user = rioAdminResult.rows[0];
        isRioAdmin = true;
        tableName = 'tblRioAdmin';
    } else {
        // If not in tblRioAdmin, check tblUsers
        const result = await dbPool.query(
            'SELECT * FROM "tblUsers" WHERE org_id = $1 AND user_id = $2',
            [org_id, user_id]
        );
        user = result.rows[0];
    }

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect current password' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password in the appropriate table
    if (isRioAdmin) {
        await dbPool.query(
            'UPDATE "tblRioAdmin" SET password = $1, changed_by = $2, changed_on = CURRENT_TIMESTAMP WHERE user_id = $3',
            [hashedPassword, user_id, user_id]
        );
    } else {
        await dbPool.query(
            'UPDATE "tblUsers" SET password = $1, changed_by = $2, changed_on = CURRENT_TIMESTAMP WHERE org_id = $3 AND user_id = $4',
            [hashedPassword, user_id, org_id, user_id]
        );
    }

    res.json({ message: 'Password changed successfully' });
};

// 🔑 Multi-Tenant Login (requires org_id)
const tenantLogin = async (req, res) => {
    const startTime = Date.now();
    const { org_id, email, password } = req.body;
    
    try {
        // Validate required fields
        if (!org_id) {
            return res.status(400).json({ message: 'Organization ID is required' });
        }
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        // Step 1: Log API called
        await logLoginApiCalled({
            email,
            method: req.method,
            url: req.originalUrl
        });

        // Step 1.5: Get tenant database credentials
        const { getTenantPool } = require('../services/tenantService');
        let tenantPool;
        try {
            tenantPool = await getTenantPool(org_id);
        } catch (tenantError) {
            await logFailedLogin({
                email,
                userId: null,
                reason: `Tenant lookup failed: ${tenantError.message}`,
                duration: Date.now() - startTime
            });
            return res.status(404).json({ message: `Organization ${org_id} not found or inactive` });
        }

        // Step 2: Log checking user in database
        await logCheckingUserInDatabase({ email });
        
        // Use tenant-specific database connection
        const user = await findUserByEmail(email, tenantPool);

        if (!user) {
            // Step 3a: User not found
            await logUserNotFound({ email });
            
            // Log failed login attempt - user not found
            await logFailedLogin({
                email,
                userId: null,
                reason: 'User not found',
                duration: Date.now() - startTime
            });

            return res.status(404).json({ message: 'User not found' });
        }

        // Step 3b: User found
        await logUserFound({ 
            email, 
            userId: user.user_id,
            userData: {
                full_name: user.full_name,
                org_id: user.org_id,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id
            }
        });

        // Step 4: Log comparing password
        await logComparingPassword({ email, userId: user.user_id });
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            // Step 5a: Password not matched
            await logPasswordNotMatched({ email, userId: user.user_id });
            
            // Log failed login attempt - invalid credentials
            await logFailedLogin({
                email,
                userId: user.user_id,
                reason: 'Invalid credentials',
                duration: Date.now() - startTime
            });

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step 5b: Password matched
        await logPasswordMatched({ email, userId: user.user_id });

        // Check if this is a RioAdmin user (from tblRioAdmin)
        const isRioAdmin = user.source_table === 'tblRioAdmin';
        
        // Check if password matches the initial password from org settings
        const initialPassword = await getInitialPassword(user.org_id, tenantPool);
        const isInitialPassword = await bcrypt.compare(initialPassword, user.password);

        // Update last_accessed field in the appropriate table
        if (isRioAdmin) {
            await tenantPool.query(
                `UPDATE "tblRioAdmin" 
                 SET last_accessed = CURRENT_DATE 
                 WHERE org_id = $1 AND user_id = $2`,
                [user.org_id, user.user_id]
            );
        } else {
            await tenantPool.query(
                `UPDATE "tblUsers" 
                 SET last_accessed = CURRENT_DATE 
                 WHERE org_id = $1 AND user_id = $2`,
                [user.org_id, user.user_id]
            );
        }

        // Fetch all user roles from tblUserJobRoles (RioAdmin might not have roles, so handle gracefully)
        let userRoles = [];
        try {
            userRoles = await getUserRoles(user.user_id, tenantPool);
        } catch (roleError) {
            // If RioAdmin doesn't have roles, that's okay - they have admin access by default
            console.log(`[AuthController] No roles found for user ${user.user_id}, continuing...`);
        }
        
        // For RioAdmin, create a default admin role if no roles exist
        if (isRioAdmin && userRoles.length === 0) {
            userRoles = [{
                user_job_role_id: 'UJR_RIOADMIN',
                user_id: user.user_id,
                job_role_id: 'JR001', // System Administrator
                job_role_name: 'System Administrator'
            }];
        }
        
        // Fetch user with branch information (using tenant database)
        let userWithBranch = null;
        if (isRioAdmin) {
            // For RioAdmin, get branch info directly from the user record or join with departments
            const branchQuery = `
                SELECT 
                    ra.user_id,
                    ra.full_name,
                    ra.email,
                    ra.phone,
                    ra.job_role_id,
                    ra.int_status,
                    ra.dept_id,
                    ra.branch_id,
                    d.text as dept_name,
                    b.text as branch_name,
                    b.branch_code,
                    jr.text as job_role_name
                FROM "tblRioAdmin" ra
                LEFT JOIN "tblDepartments" d ON ra.dept_id = d.dept_id
                LEFT JOIN "tblBranches" b ON ra.branch_id = b.branch_id OR d.branch_id = b.branch_id
                LEFT JOIN "tblJobRoles" jr ON ra.job_role_id = jr.job_role_id
                WHERE ra.user_id = $1
            `;
            const branchResult = await tenantPool.query(branchQuery, [user.user_id]);
            userWithBranch = branchResult.rows[0];
        } else {
            userWithBranch = await getUserWithBranch(user.user_id, tenantPool);
        }
        
        // Fetch language_code from employee table if emp_int_id exists (RioAdmin doesn't have emp_int_id)
        let language_code = user.language_code || 'en'; // default language
        if (!isRioAdmin && user.emp_int_id) {
            const employeeResult = await tenantPool.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [user.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Step 6: Log generating token
        await logGeneratingToken({ email, userId: user.user_id });
        
        // For tenant login (/tenant-login), use tenant database (set useDefaultDb = false)
        // IMPORTANT: Use the tenant org_id from the request (org_id), not user.org_id
        // because user.org_id is the generated org_id (ORG001) in tblOrgs,
        // but the tenants table uses the tenant org_id (e.g., "ACME")
        const tenantOrgId = org_id.toUpperCase();
        console.log(`[TenantLogin] Using tenant org_id: ${tenantOrgId} (user.org_id from DB: ${user.org_id})`);
        const tokenUser = {
            ...user,
            org_id: tenantOrgId // Use tenant org_id, not generated org_id from user record
        };
        const token = generateToken(tokenUser, false);
        
        // Step 7: Log token generated
        await logTokenGenerated({ 
            email, 
            userId: user.user_id,
            tokenPayload: {
                org_id: org_id.toUpperCase(), // Tenant org_id for tenant lookup
                user_id: user.user_id,
                email: user.email,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id,
                use_default_db: false
            }
        });
        
        const duration = Date.now() - startTime;

        // Step 8: Log successful login (final summary with response data)
        // Use tenant org_id (from request) for logging, not user.org_id (which is generated org_id)
        await logSuccessfulLogin({
            email,
            userId: user.user_id,
            duration,
            responseData: {
                full_name: user.full_name,
                org_id: org_id.toUpperCase(), // Tenant org_id, not generated org_id
                branch_id: userWithBranch?.branch_id,
                branch_name: userWithBranch?.branch_name,
                roles: userRoles,
                language_code
            }
        });

        res.json({
            token,
            requiresPasswordChange: isInitialPassword, // Flag to indicate password needs to be changed
            user: {
                full_name: user.full_name,
                email: user.email,
                org_id: org_id.toUpperCase(), // Return tenant org_id, not generated org_id from user record
                user_id: user.user_id,
                job_role_id: user.job_role_id, // Keep for backward compatibility
                emp_int_id: user.emp_int_id,
                roles: userRoles, // Add all roles
                branch_id: userWithBranch?.branch_id || null,
                branch_name: userWithBranch?.branch_name || null,
                branch_code: userWithBranch?.branch_code || null,
                dept_id: userWithBranch?.dept_id || null,
                dept_name: userWithBranch?.dept_name || null,
                language_code: language_code
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log CRITICAL error - system failure during login
        await logLoginCriticalError({
            email,
            error,
            duration
        });

        console.error('Tenant login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    login,
    tenantLogin,
    register,
    forgotPassword,
    resetPassword,
    refreshToken,
    updateOwnPassword,
    changePassword,
};

















