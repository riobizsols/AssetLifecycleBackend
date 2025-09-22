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
        console.log('Verifying token, length:', token.length);
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', { 
            user_id: decoded.user_id, 
            email: decoded.email,
            exp: decoded.exp,
            iat: decoded.iat
        });

        // Fetch current user roles from tblUserJobRoles
        let userRoles = [];
        try {
            userRoles = await getUserRoles(decoded.user_id);
            console.log(`Successfully fetched ${userRoles.length} roles for user ${decoded.user_id}`);
        } catch (roleError) {
            console.error('Error fetching user roles:', roleError);
            // Continue with empty roles array rather than failing completely
        }

        // Fetch user with branch information
        let userWithBranch = null;
        try {
            userWithBranch = await getUserWithBranch(decoded.user_id);
            console.log(`Successfully fetched branch info for user ${decoded.user_id}`);
        } catch (branchError) {
            console.error('Error fetching user branch info:', branchError);
            // Continue with null branch info rather than failing completely
        }

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
        console.error('Auth middleware error:', err);
        console.error('Error type:', err.name);
        console.error('Error message:', err.message);
        
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token. Please login again.' });
        } else if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        } else {
            return res.status(401).json({ message: 'Authentication failed. Please login again.' });
        }
    }
};

module.exports = { protect };



