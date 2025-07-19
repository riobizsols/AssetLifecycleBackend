const { 
    getAllOrganizations,
    addOrganization,
    updateOrganization,
    deleteOrganizations,
} = require("../models/orgModel");

const { v4: uuidv4 } = require("uuid");
const { generateCustomId } = require("../utils/idGenerator");

const getOrganizationsController = async (req, res) => {
    try {
        const data = await getAllOrganizations();
        res.status(200).json(data);
    } catch (err) {
        console.error("Error fetching organizations:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const addOrganizationController = async (req, res) => {
    try {
        const { org_code, org_name, org_city } = req.body;
        // Generate org_id using ID sequence
        const org_id = await generateCustomId("org");
        // Prepare new org object
        const newOrg = {
            org_id,
            org_code,
            text: org_name,
            org_city,
            int_status: 1,
            valid_from: null,
            valid_to: null,
        };
        const created = await addOrganization(newOrg);
        res.status(201).json(created);
    } catch (err) {
        console.error("Error adding organization:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateOrganizationController = async (req, res) => {
    try {
      if (!req.body) {
        return res.status(400).json({ message: "Request body is required" });
      }
  
      const { org_id, org_code, org_name, org_city } = req.body;
  
      if (!org_id) {
        return res.status(400).json({ message: "org_id is required" });
      }
  
      const updated = await updateOrganization({
        org_id,
        org_code,
        text: org_name, // stored as "text" in DB
        org_city,
      });
  
      res.status(200).json(updated);
    } catch (err) {
      console.error("Error updating organization:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  

const deleteOrganizationsController = async (req, res) => {
    try {
        let { org_id } = req.body;
        if (!org_id) {
            return res.status(400).json({ message: "org_id is required" });
        }
        // Accept single string or array
        if (typeof org_id === "string") {
            org_id = [org_id];
        }
        if (!Array.isArray(org_id) || org_id.length === 0) {
            return res.status(400).json({ message: "org_id must be a non-empty string or array" });
        }
        const deletedCount = await deleteOrganizations(org_id);
        res.status(200).json({ deleted: deletedCount });
    } catch (err) {
        console.error("Error deleting organizations:", err);
        
        // Handle foreign key constraint errors
        if (err.message && err.message.includes('Cannot delete organization')) {
            return res.status(400).json({ 
                error: "Cannot delete organization",
                message: err.message,
                hint: "You must first reassign or delete all users associated with this organization before it can be deleted"
            });
        }
        
        // Handle PostgreSQL foreign key constraint errors
        if (err.code === '23503') {
            return res.status(400).json({ 
                error: "Cannot delete organization",
                message: "This organization is being used by existing records",
                hint: "You must first reassign or delete all users associated with this organization before it can be deleted"
            });
        }
        
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getOrganizationsController,
    addOrganizationController,
    updateOrganizationController,
    deleteOrganizationsController,
};
  