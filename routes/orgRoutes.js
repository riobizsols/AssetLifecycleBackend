const express = require("express");
const router = express.Router();

const {
    getOrganizationsController,
    addOrganizationController,
    updateOrganizationController,
    deleteOrganizationsController,
} = require("../controllers/orgController");


const { protect } = require('../middlewares/authMiddleware');
router.use(protect);

// GET all organizations
router.get("/", getOrganizationsController);

// POST new organization
router.post("/", addOrganizationController);

// PUT update organization
router.put("/", updateOrganizationController);

// DELETE organizations by IDs
router.delete("/", deleteOrganizationsController);        // DELETE orgs

module.exports = router;
