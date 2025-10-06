const jwt = require('jsonwebtoken');
const { getUserRoles } = require('../models/userJobRoleModel');
const { getUserWithBranch } = require('../models/userModel');
require('dotenv').config();

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log('=== Auth Middleware Debug ===');
        console.log('decoded token:', decoded);
        console.log('decoded.emp_int_id:', decoded.emp_int_id);

        // Fetch current user roles from tblUserJobRoles
        const userRoles = await getUserRoles(decoded.user_id);

        // Fetch user with branch information
        const userWithBranch = await getUserWithBranch(decoded.user_id);

        // Attach full decoded info with current roles and branch information
        req.user = {
            org_id: decoded.org_id,
            user_id: decoded.user_id,
            job_role_id: decoded.job_role_id, // Keep for backward compatibility
            email: decoded.email,
            emp_int_id: decoded.emp_int_id,
            roles: userRoles, // Current roles from tblUserJobRoles
            branch_id: userWithBranch?.branch_id || null,
            branch_name: userWithBranch?.branch_name || null,
            branch_code: userWithBranch?.branch_code || null,
            dept_id: userWithBranch?.dept_id || null,
            dept_name: userWithBranch?.dept_name || null
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
};

module.exports = { protect };



