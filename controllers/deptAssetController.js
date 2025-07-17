// controllers/deptAssetController.js
const model = require("../models/deptAssetsModel");
const db = require('../config/db');
const { generateCustomId } = require("../utils/idGenerator");


const addDeptAsset = async (req, res) => {
    try {
        const { dept_id, asset_type_id } = req.body;
        const created_by = req.user.user_id;

        if (!dept_id || !asset_type_id) {
            return res.status(400).json({ error: "Department and Asset Type are required" });
        }

        // Fetch org_id and ext_id from model
        const assetRes = await model.getAssetMeta(asset_type_id);
        if (assetRes.rows.length === 0) {
            return res.status(404).json({ error: "Asset Type not found" });
        }

        const { org_id, ext_id } = assetRes.rows[0];

        const id = await generateCustomId("dept_asset", 2);

        await model.insertDeptAsset(id, ext_id, dept_id, asset_type_id, org_id, created_by);

        res.status(201).json({ message: "Dept asset added successfully", id });
    } catch (err) {
        console.error("Error adding dept asset:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

const getAllAssetTypes = async (req, res) => {
    try {
        console.log('Fetching all asset types...');
        const result = await db.query(
            "SELECT asset_type_id, text FROM \"tblAssetTypes\" WHERE int_status = 1"
        );
        console.log(`Found ${result.rows.length} asset types:`, result.rows);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset types:", err);
        res.status(500).json({ error: "Failed to fetch asset types" });
    }
};

const deleteDeptAsset = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "ID is required" });

        await model.deleteDeptAsset(id);
        res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
        console.error("Error deleting dept asset:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

const fetchAllDeptAssets = async (req, res) => {
    try {
        const result = await model.getAllDeptAssets();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching dept assets:", err);
        res.status(500).json({ error: "Failed to fetch dept assets" });
    }
};

module.exports = {
    addDeptAsset,
    getAllAssetTypes,
    deleteDeptAsset,
    fetchAllDeptAssets,
};
