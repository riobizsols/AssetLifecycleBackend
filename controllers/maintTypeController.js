const model = require("../models/maintTypeModel");

// GET /api/maint-types - Get all maintenance types
const getAllMaintTypes = async (req, res) => {
    try {
        const orgId = req.user?.org_id;
        const result = await model.getAllMaintTypes(orgId);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching maintenance types:", err);
        res.status(500).json({ error: "Failed to fetch maintenance types" });
    }
};

// GET /api/maint-types/:id - Get maintenance type by ID
const getMaintTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getMaintTypeById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Maintenance type not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching maintenance type:", err);
        res.status(500).json({ error: "Failed to fetch maintenance type" });
    }
};



module.exports = {
    getAllMaintTypes,
    getMaintTypeById,
   
}; 