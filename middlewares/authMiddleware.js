const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach full decoded info 
        req.user = {
            org_id: decoded.org_id,
            user_id: decoded.user_id,
            job_role_id: decoded.job_role_id,
            email: decoded.email
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
};

module.exports = { protect };



