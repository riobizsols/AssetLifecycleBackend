const vendorsModel = require("../models/vendorsModel");

exports.getAllVendors = async (req, res) => {
    try {
        const vendors = await vendorsModel.getAllVendors();
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch vendors" });
    }
};