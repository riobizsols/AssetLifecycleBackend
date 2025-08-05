const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const prodServModel = require('../models/prodServModel');

// Get all prodserv
exports.getAllProdserv = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM "tblProdServs"`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching prodserv:", error);
    res.status(500).json({ error: "Failed to fetch prodserv" });
  }
};

// Get distinct brands for a given asset_type_id
exports.getBrandsByAssetType = async (req, res) => {
  const { assetTypeId } = req.query;
  try {
    const result = await db.query(
      `SELECT DISTINCT brand FROM "tblProdServs" WHERE asset_type_id = $1 AND brand IS NOT NULL AND brand <> ''`,
      [assetTypeId]
    );
    res.json(result.rows.map(r => r.brand));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch brands" });
  }
};

// Get distinct models for a given asset_type_id and brand
exports.getModelsByAssetTypeAndBrand = async (req, res) => {
  const { assetTypeId, brand } = req.query;
  try {
    const result = await db.query(
      `SELECT DISTINCT model FROM "tblProdServs" WHERE asset_type_id = $1 AND brand = $2 AND model IS NOT NULL AND model <> ''`,
      [assetTypeId, brand]
    );
    res.json(result.rows.map(r => r.model));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch models" });
  }
};

const generateProdServId = async () => {
  // Get latest ID from DB
  const result = await db.query(`SELECT prod_serv_id FROM "tblProdServs" ORDER BY prod_serv_id DESC LIMIT 1`);
  const lastId = result.rows[0]?.prod_serv_id;

  let newNumber = 10001; // starting number
  if (lastId && /^PS\d+$/.test(lastId)) {
    newNumber = parseInt(lastId.replace('PS', '')) + 1;
  }

  return `PS${newNumber}`;
};

// add ProdServ
exports.addProdserv = async (req, res) => {
  try {
    const { assetType, asset_type_id, brand, model, description, ps_type } = req.body;

    const prod_serv_id = await generateProdServId(); 
    const org_id = req.user.org_id; 

    // Use asset_type_id if provided, otherwise use assetType
    const finalAssetTypeId = asset_type_id || assetType; 
    
    if (!finalAssetTypeId) {
      return res.status(400).json({ 
        success: false, 
        message: 'asset_type_id or assetType is required' 
      });
    }
    
    const status = 1; 
    const prodserv = await prodServModel.addProdserv({
      prod_serv_id,
      org_id,
      asset_type_id: finalAssetTypeId,
      brand,
      model,
      status,
      ps_type, 
      description 
    });

    res.status(201).json({ success: true, prodserv });
  } catch (error) {
    console.error("Error adding prodserv:", error); 
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Delete single prodserv
exports.deleteProdserv = async (req, res) => {
  try {
    const { prod_serv_id } = req.params;
    
    if (!prod_serv_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'prod_serv_id is required' 
      });
    }

    const deletedProdserv = await prodServModel.deleteProdserv(prod_serv_id);
    
    if (!deletedProdserv) {
      return res.status(404).json({ 
        success: false, 
        message: 'ProdServ not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'ProdServ deleted successfully',
      deletedProdserv 
    });
  } catch (error) {
    console.error('Error deleting prodserv:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
  }
};

// Delete multiple prodserv
exports.deleteMultipleProdserv = async (req, res) => {
  try {
    const { prod_serv_ids } = req.body;
    
    if (!Array.isArray(prod_serv_ids) || prod_serv_ids.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'prod_serv_ids array is required and must not be empty' 
      });
    }

    const deletedProdservs = await prodServModel.deleteMultipleProdserv(prod_serv_ids);
    
    if (deletedProdservs.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No ProdServ records found to delete' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: `${deletedProdservs.length} ProdServ record(s) deleted successfully`,
      deletedCount: deletedProdservs.length,
      deletedProdservs 
    });
  } catch (error) {
    console.error('Error deleting multiple prodserv:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
  }
};