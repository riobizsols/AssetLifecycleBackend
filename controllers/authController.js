const bcrypt = require('bcrypt');
const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    findUserByEmail,
    createUser,
    setResetToken,
    findUserByResetToken,
    updatePassword
} = require('../models/userModel');
const { sendResetEmail } = require('../utils/mailer');
require('dotenv').config();

// 🔐 JWT Creator
const generateToken = (user) => {
    return jwt.sign({
        ext_id: user.ext_id,
        org_id: user.org_id,
        user_id: user.user_id,
        email: user.email,
        job_role_id: user.job_role_id
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
        `UPDATE tblUsers 
         SET last_accessed = CURRENT_DATE 
         WHERE ext_id = $1 AND org_id = $2 AND user_id = $3`,
        [user.ext_id, user.org_id, user.user_id]
    );

    const token = generateToken(user);
    res.json({
        token,
        user: {
            full_name: user.full_name,
            email: user.email,
            ext_id: user.ext_id,
            org_id: user.org_id,
            user_id: user.user_id,
            job_role_id: user.job_role_id
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
        time_zone // optional field from frontend
    } = req.body;

    // ✅ Only super_admin can register new users
    if (req.user.job_role_id !== 'super_admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    // 🔍 Check if the email already exists
    const existing = await findUserByEmail(email);
    if (existing) {
        return res.status(400).json({ message: 'Email already exists' });
    }

    // 🔗 Fetch ext_id for the given org_id from tblOrgs
    const extResult = await db.query(
        'SELECT ext_id FROM tblOrgs WHERE org_id = $1',
        [req.user.org_id]
    );

    // ❌ If no org found, reject
    if (extResult.rowCount === 0) {
        return res.status(400).json({ message: 'Invalid organization ID' });
    }

    const ext_id = extResult.rows[0].ext_id;

    // 🔒 Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // 👤 Create the user in tblUsers
    const user = await createUser({
        ext_id,
        org_id: req.user.org_id,
        user_id,
        full_name,
        email,
        phone,
        job_role_id,
        password: hashedPassword,
        created_by: req.user.user_id,
        time_zone: time_zone || 'IST'
    });

    // ✅ Return success response
    res.status(201).json({
        message: 'User created successfully',
        user: {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            job_role_id: user.job_role_id
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
        ext_id: user.ext_id,
        org_id: user.org_id,
        user_id: user.user_id
    }, hashedPassword, user.user_id); // changed_by = user_id

    res.json({ message: 'Password has been reset successfully' });
};


// 🔐 Super Admin: Update Own Password
const updateOwnPassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { ext_id, org_id, user_id } = req.user;

    const result = await db.query(
        'SELECT * FROM tblUsers WHERE ext_id = $1 AND org_id = $2 AND user_id = $3',
        [ext_id, org_id, user_id]
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
        'UPDATE tblUsers SET password = $1 WHERE ext_id = $2 AND org_id = $3 AND user_id = $4',
        [hashedPassword, ext_id, org_id, user_id]
    );

    res.json({ message: 'Password updated successfully' });
};

module.exports = {
    login,
    register,
    forgotPassword,
    resetPassword,
    updateOwnPassword,
};

















