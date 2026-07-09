const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
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
const { ensureJobRoleNavigation } = require('../services/tenantSetupService');
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

// 🔐 JWT Creator — tenant-only; no default database access
const generateToken = (user) => {
    return jwt.sign({
        org_id: user.org_id,
        user_id: user.user_id,
        email: user.email,
        job_role_id: user.job_role_id,
        emp_int_id: user.emp_int_id,
        language_code: user.language_code || 'en',
        use_default_db: false,
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Auth logs must never block login response flow.
const safeAuthLog = (logFn) => {
    Promise.resolve()
        .then(logFn)
        .catch((error) => {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[AuthController] Non-blocking auth log failed:', error?.message || error);
            }
        });
};

// 🔑 Login — tenant-only (subdomain or email registry); no default database access
const login = async (req, res) => {
    const startTime = Date.now();
    const { email, password } = req.body;
    
    try {
        // Step 1: Log API called
        safeAuthLog(() => logLoginApiCalled({
            email,
            method: req.method,
            url: req.originalUrl
        }));

        const {
            getRequestHostname,
            resolveTenantDatabase,
        } = require('../utils/tenantAuthResolver');
        const { extractTenantSubdomain } = require('../utils/subdomainUtils');

        const hostname = getRequestHostname(req);
        const subdomain = extractTenantSubdomain(hostname);
        const tenantCtx = await resolveTenantDatabase({ hostname, email });

        if (!tenantCtx?.dbPool) {
            logger.warn(`[AuthController] No tenant database resolved for login: ${email}`);
            return res.status(404).json({
                message: 'No organization found for this account. Use your organization login URL or registered email.',
            });
        }

        const dbPool = tenantCtx.dbPool;
        const orgId = tenantCtx.registryOrgId;
        let resolvedLoginSubdomain = tenantCtx.subdomain;
        const loginMode = subdomain ? 'subdomain' : 'email_registry';
        const isTenant = true;

        logger.log(`[AuthController] Tenant login (${loginMode}): org_id ${orgId}, subdomain ${resolvedLoginSubdomain || 'n/a'}`);
        safeAuthLog(() => logCheckingUserInDatabase({ email, orgId, subdomain: resolvedLoginSubdomain }));
        
        // Step 5: Find user in tenant database
        logger.debug(`[AuthController] Searching for user with email: "${email}" in tenant database`);
        const user = await findUserByEmail(email, dbPool);
        if (!user) {
            // Step 3a: User not found
            safeAuthLog(() => logUserNotFound({ email }));
            
            // Log failed login attempt - user not found
            safeAuthLog(() => logFailedLogin({
                email,
                userId: null,
                reason: 'User not found',
                duration: Date.now() - startTime
            }));

            return res.status(404).json({ message: 'User not found' });
        }

        // Step 3b: User found
        safeAuthLog(() => logUserFound({ 
            email, 
            userId: user.user_id,
            userData: {
                full_name: user.full_name,
                org_id: user.org_id,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id
            }
        }));

        // Step 4: Log comparing password
        safeAuthLog(() => logComparingPassword({ email, userId: user.user_id }));
        
        let loginUser = user;
        let isMatch = await bcrypt.compare(password, user.password);

        // Setup wizard stores admin in both tblRioAdmin and tblUsers; if hashes diverge, try tblUsers
        if (!isMatch && user.source_table === 'tblRioAdmin' && String(email || '').includes('@')) {
            const fallbackResult = await dbPool.query(
                `SELECT *, 'tblUsers' as source_table FROM "tblUsers" WHERE email = $1`,
                [email]
            );
            if (fallbackResult.rows[0]) {
                const fallbackMatch = await bcrypt.compare(password, fallbackResult.rows[0].password);
                if (fallbackMatch) {
                    loginUser = fallbackResult.rows[0];
                    isMatch = true;
                }
            }
        }
        
        if (!isMatch) {
            // Step 5a: Password not matched
            safeAuthLog(() => logPasswordNotMatched({ email, userId: user.user_id }));
            
            // Log failed login attempt - invalid credentials
            safeAuthLog(() => logFailedLogin({
                email,
                userId: user.user_id,
                reason: 'Invalid credentials',
                duration: Date.now() - startTime
            }));

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step 5b: Password matched
        safeAuthLog(() => logPasswordMatched({ email, userId: loginUser.user_id }));

        if (isTenant && orgId) {
            try {
                await ensureJobRoleNavigation(dbPool, orgId);
            } catch (navErr) {
                console.warn(`[AuthController] Navigation sync on login failed: ${navErr.message}`);
            }
        }

        // Check if this is a RioAdmin user (from tblRioAdmin)
        const isRioAdmin = loginUser.source_table === 'tblRioAdmin';
        
        const lastAccessedPromise = isRioAdmin
            ? dbPool.query(
                `UPDATE "tblRioAdmin" SET last_accessed = CURRENT_DATE WHERE org_id = $1 AND user_id = $2`,
                [loginUser.org_id, loginUser.user_id]
            )
            : dbPool.query(
                `UPDATE "tblUsers" SET last_accessed = CURRENT_DATE WHERE org_id = $1 AND user_id = $2`,
                [loginUser.org_id, loginUser.user_id]
            );

        const [initialPassword, , userRolesResult, userWithBranch] = await Promise.all([
            getInitialPassword(loginUser.org_id, dbPool),
            lastAccessedPromise,
            getUserRoles(loginUser.user_id, dbPool).catch(() => {
                console.log(`[AuthController] No roles found for user ${loginUser.user_id}, continuing...`);
                return [];
            }),
            isRioAdmin
                ? dbPool.query(
                    `SELECT ra.user_id, ra.full_name, ra.email, ra.phone, ra.job_role_id,
                            ra.dept_id, ra.branch_id, d.text as dept_name, b.text as branch_name,
                            b.branch_code, jr.text as job_role_name
                     FROM "tblRioAdmin" ra
                     LEFT JOIN "tblDepartments" d ON ra.dept_id = d.dept_id
                     LEFT JOIN "tblBranches" b ON ra.branch_id = b.branch_id OR d.branch_id = b.branch_id
                     LEFT JOIN "tblJobRoles" jr ON ra.job_role_id = jr.job_role_id
                     WHERE ra.user_id = $1`,
                    [loginUser.user_id]
                ).then((r) => r.rows[0])
                : getUserWithBranch(loginUser.user_id, dbPool),
        ]);

        const isInitialPassword = initialPassword
            ? await bcrypt.compare(initialPassword, loginUser.password)
            : false;

        let userRoles = userRolesResult || [];
        if (isRioAdmin && userRoles.length === 0) {
            userRoles = [{
                user_job_role_id: 'UJR_RIOADMIN',
                user_id: loginUser.user_id,
                job_role_id: 'JR001',
                job_role_name: 'System Administrator'
            }];
        }

        let language_code = loginUser.language_code || 'en';
        if (!isRioAdmin && loginUser.emp_int_id) {
            const employeeResult = await dbPool.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [loginUser.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Step 6: Log generating token
        safeAuthLog(() => logGeneratingToken({ email, userId: loginUser.user_id }));
        
        // Generate token with tenant information
        const tokenUser = { ...loginUser, language_code };
        if (isTenant && orgId) {
            tokenUser.org_id = String(orgId).toUpperCase();
        }
        const token = generateToken(tokenUser);
        
        // Step 7: Log token generated
        safeAuthLog(() => logTokenGenerated({ 
            email, 
            userId: loginUser.user_id,
            tokenPayload: {
                org_id: loginUser.org_id,
                user_id: loginUser.user_id,
                email: loginUser.email,
                job_role_id: loginUser.job_role_id,
                emp_int_id: loginUser.emp_int_id,
                use_default_db: false,
                subdomain: subdomain || null,
                loginMode: loginMode
            }
        }));
        
        const duration = Date.now() - startTime;

        // Step 8: Log successful login (final summary with response data)
        safeAuthLog(() => logSuccessfulLogin({
            email,
            userId: loginUser.user_id,
            duration,
            responseData: {
                full_name: loginUser.full_name,
                org_id: loginUser.org_id,
                branch_id: userWithBranch?.branch_id,
                branch_name: userWithBranch?.branch_name,
                roles: userRoles,
                language_code
            }
        }));

        let tenantName = null;
        let tenantDatabase = null;
        const registryOrgId = isTenant && orgId ? String(orgId).toUpperCase().trim() : null;

        if (isTenant && registryOrgId) {
            try {
                const orgResult = await dbPool.query(
                    `SELECT text FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1`,
                );
                tenantName = orgResult.rows[0]?.text || null;
            } catch (orgLookupErr) {
                console.warn('[AuthController] Could not read tenant org name:', orgLookupErr.message);
            }

            try {
                const { getTenantCredentials } = require('../services/tenantService');
                const { getSubdomainByOrgId } = require('../services/tenantEmailRegistryService');
                const creds = await getTenantCredentials(registryOrgId);
                tenantDatabase = creds.database;
                if (!resolvedLoginSubdomain) {
                    resolvedLoginSubdomain = await getSubdomainByOrgId(registryOrgId);
                }
            } catch (credsErr) {
                console.warn('[AuthController] Could not read tenant registry metadata:', credsErr.message);
            }
        }

        res.json({
            token,
            requiresPasswordChange: isInitialPassword, // Flag to indicate password needs to be changed
            user: {
                full_name: loginUser.full_name,
                email: loginUser.email,
                org_id: loginUser.org_id,
                registry_org_id: registryOrgId,
                tenant_name: tenantName,
                subdomain: resolvedLoginSubdomain,
                tenant_database: tenantDatabase,
                is_tenant: isTenant,
                user_id: loginUser.user_id,
                job_role_id: loginUser.job_role_id, // Keep for backward compatibility
                emp_int_id: loginUser.emp_int_id,
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
        safeAuthLog(() => logLoginCriticalError({
            email,
            error,
            duration
        }));

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
// CRITICAL: Multi-tenant support - uses subdomain to identify tenant database
const forgotPassword = async (req, res) => {
    // CRITICAL: Always log - even in production - to debug email issues
    console.log('[ForgotPassword] ===== FORGOT PASSWORD REQUEST RECEIVED =====');
    console.log('[ForgotPassword] Request body:', req.body);
    console.log('[ForgotPassword] Request headers:', {
        host: req.get('host'),
        'x-forwarded-host': req.get('x-forwarded-host'),
        hostname: req.hostname,
        headers_host: req.headers.host
    });
    
    try {
        const { email } = req.body;
        
        console.log('[ForgotPassword] Email received:', email);
        
        if (!email) {
            console.log('[ForgotPassword] ❌ No email provided');
            return res.status(400).json({ message: 'Email is required' });
        }
        
        const {
            getRequestHostname,
            resolveTenantDatabase,
        } = require('../utils/tenantAuthResolver');
        const hostname = getRequestHostname(req);
        console.log('[ForgotPassword] Hostname extracted:', hostname);

        const tenantCtx = await resolveTenantDatabase({ hostname, email });
        const tenantPool = tenantCtx?.dbPool || null;
        const orgId = tenantCtx?.registryOrgId || null;
        const subdomain = tenantCtx?.subdomain || null;

        if (!tenantPool) {
            console.log('[ForgotPassword] No tenant database resolved for email:', email);
            return res.status(200).json({ message: 'If that email exists, a password reset link has been sent' });
        }

        console.log(`[ForgotPassword] Using tenant database for org_id: ${orgId}, subdomain: ${subdomain || 'n/a'}`);
        
        // Find user in tenant database only
        console.log('[ForgotPassword] Searching for user with email:', email, 'in tenant database');
        const user = await findUserByEmail(email, tenantPool);
        
        console.log('[ForgotPassword] User found:', user ? `Yes (${user.user_id}, org: ${user.org_id})` : 'No');
        
        if (!user) {
            // Don't reveal if email exists or not (security best practice)
            console.log('[ForgotPassword] User not found - returning generic success message');
            return res.status(200).json({ message: 'If that email exists, a password reset link has been sent' });
        }
        
        // NOTE: We don't need to verify user.org_id matches tenant org_id because:
        // 1. If we found the user in the tenant database (tenantPool), they belong to that tenant
        // 2. The user's org_id (e.g., ORG001) is the internal org_id from tblOrgs
        // 3. The tenant org_id (e.g., COMPANYDEMO) is used for database routing, not data matching
        // If user was found in tenant database, proceed with password reset
        console.log('[ForgotPassword] User found in tenant database - proceeding with password reset');
        
        console.log('[ForgotPassword] Generating reset token...');
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        console.log('[ForgotPassword] Token generated, expiry:', expiry);
        
        // Set reset token in appropriate database
        console.log('[ForgotPassword] Setting reset token in database...');
        await setResetToken(email, token, expiry, tenantPool);
        console.log(`[ForgotPassword] ✅ Reset token set for ${email}`);
        logger.log(`[ForgotPassword] ✅ Reset token set for ${email}`);
        
        // Send reset email with subdomain in link (if subdomain exists)
        console.log('[ForgotPassword] Attempting to send reset email...');
        try {
            await sendResetEmail(email, token, subdomain);
            console.log(`[ForgotPassword] ✅ Password reset link sent to ${email}${subdomain ? ` (tenant: ${subdomain})` : ''}`);
            logger.log(`[ForgotPassword] ✅ Password reset link sent to ${email}${subdomain ? ` (tenant: ${subdomain})` : ''}`);
            res.json({ message: 'Password reset link sent to email' });
        } catch (emailError) {
            // Log the email error but don't fail the request
            // Token is already set, user can request again if needed
            console.error(`[ForgotPassword] ❌ Failed to send email:`, emailError);
            console.error(`[ForgotPassword] ❌ Email error details:`, {
                message: emailError.message,
                code: emailError.code,
                stack: emailError.stack
            });
            logger.error(`[ForgotPassword] ❌ Failed to send email:`, emailError);
            logger.error(`[ForgotPassword] ❌ Email error details:`, {
                message: emailError.message,
                code: emailError.code,
                stack: emailError.stack
            });
            
            // Return error to user so they know email wasn't sent
            res.status(500).json({ 
                message: 'Password reset token was generated, but email could not be sent. Please check email configuration or try again later.',
                error: process.env.NODE_ENV === 'development' ? emailError.message : undefined
            });
        }
    } catch (error) {
        logger.error(`[ForgotPassword] ❌ Error:`, error);
        logger.error(`[ForgotPassword] ❌ Error stack:`, error.stack);
        res.status(500).json({ 
            message: 'An error occurred. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 🔁 Reset Password
// CRITICAL: Multi-tenant support - uses subdomain to identify tenant database
const resetPassword = async (req, res) => {
    console.log('[ResetPassword] ===== RESET PASSWORD REQUEST RECEIVED =====');
    console.log('[ResetPassword] Request body:', { token: req.body.token ? 'Present' : 'Missing', newPassword: req.body.newPassword ? 'Present' : 'Missing' });
    
    try {
        const { token, newPassword, email: resetEmail } = req.body;
        
        if (!token || !newPassword) {
            console.log('[ResetPassword] ❌ Missing token or password');
            return res.status(400).json({ message: 'Token and new password are required' });
        }
        
        if (newPassword.length < 6) {
            console.log('[ResetPassword] ❌ Password too short');
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }
        
        const {
            getRequestHostname,
            resolveTenantDatabase,
        } = require('../utils/tenantAuthResolver');
        const hostname = getRequestHostname(req);
        console.log('[ResetPassword] Hostname extracted:', hostname);

        const tenantCtx = await resolveTenantDatabase({
            hostname,
            email: resetEmail || null,
        });
        const tenantPool = tenantCtx?.dbPool || null;
        const subdomain = tenantCtx?.subdomain || null;

        if (!tenantPool) {
            console.log('[ResetPassword] No tenant database resolved');
            return res.status(400).json({
                message: 'Unable to determine organization. Use your organization password reset link or provide your registered email.',
            });
        }

        console.log('[ResetPassword] Searching for user with reset token in tenant database');
        const user = await findUserByResetToken(token, tenantPool);
        
        console.log('[ResetPassword] User found:', user ? `Yes (${user.user_id}, org: ${user.org_id})` : 'No');
        
        if (!user) {
            console.log('[ResetPassword] ❌ User not found with token - token invalid or expired');
            return res.status(400).json({ message: 'Invalid or expired token' });
        }
        
        // NOTE: We don't need to verify user.org_id matches tenant org_id because:
        // 1. If we found the user in the tenant database (tenantPool), they belong to that tenant
        // 2. The user's org_id (e.g., ORG001) is the internal org_id from tblOrgs
        // 3. The tenant org_id (e.g., COMPANYDEMO) is used for database routing, not data matching
        // If user was found in tenant database, proceed with password reset
        console.log('[ResetPassword] User found in tenant database - proceeding with password reset');
        
        console.log('[ResetPassword] Hashing new password...');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password in appropriate database
        console.log('[ResetPassword] Updating password in database...');
        await updatePassword({
            org_id: user.org_id,
            user_id: user.user_id
        }, hashedPassword, user.user_id, tenantPool); // changed_by = user_id
        
        console.log(`[ResetPassword] ✅ Password reset successfully for user ${user.user_id}${subdomain ? ` (tenant: ${subdomain})` : ''}`);
        logger.log(`[ResetPassword] ✅ Password reset successfully for user ${user.user_id}${subdomain ? ` (tenant: ${subdomain})` : ''}`);
        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        console.error(`[ResetPassword] ❌ Error:`, error);
        console.error(`[ResetPassword] ❌ Error stack:`, error.stack);
        logger.error(`[ResetPassword] ❌ Error:`, error);
        res.status(500).json({ 
            message: 'An error occurred. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
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
        const {
            resolveTenantDatabase,
            resolveTenantPoolByOrgId,
        } = require('../utils/tenantAuthResolver');
        const { getTenantFromEmail } = require('../services/tenantEmailRegistryService');

        let tenantCtx = null;
        if (decoded.org_id) {
            tenantCtx = await resolveTenantPoolByOrgId(decoded.org_id);
        }
        if (!tenantCtx && decoded.email) {
            const emailMapping = await getTenantFromEmail(decoded.email);
            if (emailMapping?.org_id) {
                tenantCtx = await resolveTenantPoolByOrgId(emailMapping.org_id);
            }
        }
        if (!tenantCtx) {
            tenantCtx = await resolveTenantDatabase({ hostname: null, email: decoded.email, orgId: decoded.org_id });
        }

        if (!tenantCtx?.dbPool) {
            return res.status(503).json({
                success: false,
                message: 'Unable to connect to your organization database. Please log in again.',
            });
        }

        const dbPool = tenantCtx.dbPool;
        
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
            org_id: decoded.org_id, // Use org_id from token (tenant org_id), not from user record
            language_code
        };
        const newToken = generateToken(refreshTokenUser);
        
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

    if (!req.db) {
        return res.status(503).json({ message: 'Tenant database connection required' });
    }
    const dbPool = req.db;
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
// NOTE: In tenant databases there is no tblRioAdmin, so we only operate on tblUsers.
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { org_id, user_id } = req.user;

        logger.debug(`[AuthController] changePassword called for user_id: ${user_id}, org_id: ${org_id}`);

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        if (!req.db) {
            logger.error('[AuthController] No tenant database pool available');
            return res.status(503).json({ message: 'Tenant database connection required' });
        }
        const dbPool = req.db;
        
        logger.debug('[AuthController] Using tenant database pool from request context');

        // Look up user in tblUsers within the current org
        const result = await dbPool.query(
            'SELECT * FROM "tblUsers" WHERE org_id = $1 AND user_id = $2',
            [org_id, user_id]
        );
        const user = result.rows[0];

        if (!user) {
            logger.warn(`[AuthController] User not found: user_id=${user_id}, org_id=${org_id}`);
            return res.status(404).json({ message: 'User not found' });
        }

        logger.debug(`[AuthController] User found: ${user.email}`);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            logger.warn(`[AuthController] Password mismatch for user: ${user_id}`);
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in tblUsers
        // Note: changed_on is type 'date', not 'timestamp', so use CURRENT_DATE
        await dbPool.query(
            'UPDATE "tblUsers" SET password = $1, changed_by = $2, changed_on = CURRENT_DATE WHERE org_id = $3 AND user_id = $4',
            [hashedPassword, user_id, org_id, user_id]
        );

        logger.log(`[AuthController] Password changed successfully for user: ${user_id}`);
        return res.json({ message: 'Password changed successfully' });
    } catch (err) {
        logger.error('[AuthController] Error in changePassword:', err);
        logger.error('[AuthController] Error stack:', err.stack);
        logger.error('[AuthController] Error details:', {
            message: err.message,
            code: err.code,
            detail: err.detail
        });
        return res.status(500).json({ 
            message: 'Failed to change password',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
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
        safeAuthLog(() => logLoginApiCalled({
            email,
            method: req.method,
            url: req.originalUrl
        }));

        // Step 1.5: Get tenant database credentials
        const { getTenantPool } = require('../services/tenantService');
        let tenantPool;
        try {
            tenantPool = await getTenantPool(org_id);
        } catch (tenantError) {
            safeAuthLog(() => logFailedLogin({
                email,
                userId: null,
                reason: `Tenant lookup failed: ${tenantError.message}`,
                duration: Date.now() - startTime
            }));
            return res.status(404).json({ message: `Organization ${org_id} not found or inactive` });
        }

        // Step 2: Log checking user in database
        safeAuthLog(() => logCheckingUserInDatabase({ email }));
        
        // Use tenant-specific database connection
        const user = await findUserByEmail(email, tenantPool);

        if (!user) {
            // Step 3a: User not found
            safeAuthLog(() => logUserNotFound({ email }));
            
            // Log failed login attempt - user not found
            safeAuthLog(() => logFailedLogin({
                email,
                userId: null,
                reason: 'User not found',
                duration: Date.now() - startTime
            }));

            return res.status(404).json({ message: 'User not found' });
        }

        // Step 3b: User found
        safeAuthLog(() => logUserFound({ 
            email, 
            userId: user.user_id,
            userData: {
                full_name: user.full_name,
                org_id: user.org_id,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id
            }
        }));

        // Step 4: Log comparing password
        safeAuthLog(() => logComparingPassword({ email, userId: user.user_id }));
        
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            // Step 5a: Password not matched
            safeAuthLog(() => logPasswordNotMatched({ email, userId: user.user_id }));
            
            // Log failed login attempt - invalid credentials
            safeAuthLog(() => logFailedLogin({
                email,
                userId: user.user_id,
                reason: 'Invalid credentials',
                duration: Date.now() - startTime
            }));

            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Step 5b: Password matched
        safeAuthLog(() => logPasswordMatched({ email, userId: user.user_id }));

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
        safeAuthLog(() => logGeneratingToken({ email, userId: user.user_id }));
        
        // For tenant login (/tenant-login), use tenant database (set useDefaultDb = false)
        // IMPORTANT: Use the tenant org_id from the request (org_id), not user.org_id
        // because user.org_id is the generated org_id (ORG001) in tblOrgs,
        // but the tenants table uses the tenant org_id (e.g., "ACME")
        const tenantOrgId = org_id.toUpperCase();
        console.log(`[TenantLogin] Using tenant org_id: ${tenantOrgId} (user.org_id from DB: ${user.org_id})`);
        const tokenUser = {
            ...user,
            org_id: tenantOrgId, // Use tenant org_id, not generated org_id from user record
            language_code
        };
        const token = generateToken(tokenUser);
        
        // Step 7: Log token generated
        safeAuthLog(() => logTokenGenerated({ 
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
        }));
        
        const duration = Date.now() - startTime;

        // Step 8: Log successful login (final summary with response data)
        // Use tenant org_id (from request) for logging, not user.org_id (which is generated org_id)
        safeAuthLog(() => logSuccessfulLogin({
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
        }));

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
        safeAuthLog(() => logLoginCriticalError({
            email,
            error,
            duration
        }));

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

















