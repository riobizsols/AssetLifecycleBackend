// middlewares/authorize.js
module.exports = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.job_role_id)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }
        next(); // Role allowed → continue to controller
    };
};
  