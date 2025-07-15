const db = require('../config/db');

// Get all vendors
const getAllVendors = async () => {
    const result = await db.query('SELECT * FROM tblVendors');
    return result.rows;
};

module.exports = {
    getAllVendors,
}; 