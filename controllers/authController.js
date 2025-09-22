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
require('dotenv').config();

// 🔐 JWT Creator
const generateToken = (user) => {
    const payload = {
        org_id: user.org_id,
        user_id: user.user_id,
        email: user.email,
        job_role_id: user.job_role_id,
        emp_int_id: user.emp_int_id
    };
    
    console.log('Generating JWT token with payload:', payload);
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Generated token length:', token.length);
    
    return token;
};

// 🔑 Login
const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await findUserByEmail(email);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

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
    
    const token = generateToken(user);
    res.json({
        token,
        user: {
            full_name: user.full_name,
            email: user.email,
            org_id: user.org_id,
            user_id: user.user_id,
            // job_role_id: user.job_role_id,
            emp_int_id: user.emp_int_id,
            language_code: user.language_code,
            job_role_id: user.job_role_id, // Keep for backward compatibility
            emp_int_id: user.emp_int_id,
            roles: userRoles, // Add all roles
            branch_id: userWithBranch?.branch_id || null,
            branch_name: userWithBranch?.branch_name || null,
            branch_code: userWithBranch?.branch_code || null,
            dept_id: userWithBranch?.dept_id || null,
            dept_name: userWithBranch?.dept_name || null
        }
    });
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
                dept_name: userWithBranch?.dept_name || null
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

















