const express = require("express");
const router = express.Router();
const vendorsController = require("../controllers/vendorsController");

router.get("/get-vendors", vendorsController.getAllVendors);

module.exports = router;
