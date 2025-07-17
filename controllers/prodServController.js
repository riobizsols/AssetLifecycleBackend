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