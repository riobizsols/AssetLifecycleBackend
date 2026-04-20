const statusCodesModel = require("../models/statusCodesModel");

// GET /api/status-codes
const getStatusCodes = async (req, res) => {
  try {
    // Use req.db from auth middleware (handles tenant context)
    const dbPool = req.db;
    const rows = await statusCodesModel.getAllStatusCodes(dbPool);
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching status codes:", err);
    // If table doesn't exist, return empty array with a warning
    if (err.code === '42P01') {
      console.warn('tblStatusCodes table does not exist. Please run migration: node migrations/createStatusCodesTableStandalone.js');
      return res.status(200).json({ success: true, data: [] });
    }
    return res.status(500).json({ success: false, message: "Failed to fetch status codes", error: err.message });
  }
};

module.exports = {
  getStatusCodes,
};

