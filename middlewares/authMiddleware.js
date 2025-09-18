const jwt = require('jsonwebtoken');
const { getUserRoles } = require('../models/userJobRoleModel');
require('dotenv').config();

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch current user roles from tblUserJobRoles
        const userRoles = await getUserRoles(decoded.user_id);

        // Attach full decoded info with current roles
        req.user = {
            org_id: decoded.org_id,
            user_id: decoded.user_id,
            job_role_id: decoded.job_role_id, // Keep for backward compatibility
            email: decoded.email,
            emp_int_id: decoded.emp_int_id,
            roles: userRoles // Current roles from tblUserJobRoles
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
};

module.exports = { protect };



