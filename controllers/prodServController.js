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
    const { assetType, brand, model, description, ps_type } = req.body;

    const prod_serv_id = await generateProdServId(); 
    const ext_id = uuidv4();
    const org_id = req.user.org_id; 

    const asset_type_id = assetType; 
    const status = 1; 
    const prodserv = await prodServModel.addProdserv({
      prod_serv_id,
      ext_id,
      org_id,
      asset_type_id,
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