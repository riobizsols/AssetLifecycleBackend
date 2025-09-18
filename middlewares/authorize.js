// middlewares/authorize.js
module.exports = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(403).json({ message: 'Forbidden: User not authenticated' });
        }

        // Check if user has any of the allowed roles from tblUserJobRoles
        const userRoles = req.user.roles || [];
        const userRoleIds = userRoles.map(role => role.job_role_id);
        
        // Check if any of the user's roles match the allowed roles
        const hasAllowedRole = allowedRoles.some(allowedRole => userRoleIds.includes(allowedRole));
        
        if (!hasAllowedRole) {
            return res.status(403).json({ 
                message: 'Forbidden: Access denied',
                userRoles: userRoleIds,
                allowedRoles: allowedRoles
            });
        }
        
        next(); // Role allowed → continue to controller
    };
};
  