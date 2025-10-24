const bcrypt = require('bcrypt');
const db = require('../config/db');
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
const generateToken = (user) => {
    return jwt.sign({
        org_id: user.org_id,
        user_id: user.user_id,
        email: user.email,
        job_role_id: user.job_role_id,
        emp_int_id: user.emp_int_id
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// 🔑 Login
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

        // Step 2: Log checking user in database
        await logCheckingUserInDatabase({ email });
        
        const user = await findUserByEmail(email);

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

        // Update last_accessed field
        await db.query(
            `UPDATE "tblUsers" 
             SET last_accessed = CURRENT_DATE 
             WHERE org_id = $1 AND user_id = $2`,
            [user.org_id, user.user_id]
        );

        // Fetch all user roles from tblUserJobRoles
        const userRoles = await getUserRoles(user.user_id);
        
        // Fetch user with branch information
        const userWithBranch = await getUserWithBranch(user.user_id);
        
        // Fetch language_code from employee table if emp_int_id exists
        let language_code = 'en'; // default language
        if (user.emp_int_id) {
            const employeeResult = await db.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [user.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Step 6: Log generating token
        await logGeneratingToken({ email, userId: user.user_id });
        
        const token = generateToken(user);
        
        // Step 7: Log token generated
        await logTokenGenerated({ 
            email, 
            userId: user.user_id,
            tokenPayload: {
                org_id: user.org_id,
                user_id: user.user_id,
                email: user.email,
                job_role_id: user.job_role_id,
                emp_int_id: user.emp_int_id
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
        
        // Check if user still exists and is active
        const user = await findUserByEmail(decoded.email);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // Fetch current user roles
        const userRoles = await getUserRoles(user.user_id);
        
        // Fetch user with branch information
        const userWithBranch = await getUserWithBranch(user.user_id);
        
        // Fetch language_code from employee table if emp_int_id exists
        let language_code = 'en'; // default language
        if (user.emp_int_id) {
            const employeeResult = await db.query(
                'SELECT language_code FROM "tblEmployees" WHERE emp_int_id = $1',
                [user.emp_int_id]
            );
            if (employeeResult.rows.length > 0) {
                language_code = employeeResult.rows[0].language_code || 'en';
            }
        }
        
        // Generate new token
        const newToken = generateToken(user);
        
        res.json({
            success: true,
            token: newToken,
            user: {
                full_name: user.full_name,
                email: user.email,
                org_id: user.org_id,
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

    const result = await db.query(
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
    await db.query(
        'UPDATE "tblUsers" SET password = $1 WHERE org_id = $2 AND user_id = $3',
        [hashedPassword, org_id, user_id]
    );

    res.json({ message: 'Password updated successfully' });
};

module.exports = {
    login,
    register,
    forgotPassword,
    resetPassword,
    refreshToken,
    updateOwnPassword,
};

















