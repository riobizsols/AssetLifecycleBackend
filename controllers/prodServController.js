const db = require("../config/db");
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


// add ProdServ
exports.addProdserv = async (req, res) => {
  try {
    const prodserv = await prodServModel.addProdserv(req.body);
    res.status(201).json({ success: true, prodserv });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};