const model = require("../models/assetModel");

// Check existing asset IDs for bulk upload validation
const checkExistingAssets = async (req, res) => {
    try {
        const { asset_ids } = req.body;
        
        if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
            return res.status(400).json({ 
                error: "asset_ids array is required" 
            });
        }

        const existingIds = await model.checkExistingAssetIds(asset_ids);
        
        res.json({
            success: true,
            existing_ids: existingIds.rows.map(row => row.asset_id),
            total_checked: asset_ids.length,
            existing_count: existingIds.rows.length
        });
    } catch (error) {
        console.error("Error checking existing assets:", error);
        res.status(500).json({ 
            error: "Failed to check existing assets",
            message: error.message 
        });
    }
};

// Validate bulk upload CSV for assets
const validateBulkUploadAssets = async (req, res) => {
    try {
        const { csvData } = req.body;
        
        if (!csvData || !Array.isArray(csvData)) {
            return res.status(400).json({ 
                error: "csvData array is required" 
            });
        }

        // Fetch reference data for validation
        const referenceData = await model.getBulkUploadReferenceData();
        
        // Validate each row
        const validationResults = [];
        const errors = [];
        
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            const rowNumber = i + 2; // +2 because CSV has header row and 0-based index
            const rowErrors = [];
            
            // Required field validation
            if (!row.asset_id) rowErrors.push('asset_id is required');
            if (!row.text) rowErrors.push('text is required');
            if (!row.org_id) rowErrors.push('org_id is required');
            
            // Data type validation
            if (row.purchased_cost && isNaN(parseFloat(row.purchased_cost))) {
                rowErrors.push('purchased_cost must be a number');
            }
            
            if (row.purchased_on && isNaN(new Date(row.purchased_on).getTime())) {
                rowErrors.push('purchased_on must be a valid date');
            }
            
            // Referential integrity validation
            if (row.org_id && !referenceData.organizations.find(org => org.org_id === row.org_id)) {
                rowErrors.push(`org_id '${row.org_id}' does not exist`);
            }
            
            if (row.asset_type_id && !referenceData.assetTypes.find(at => at.asset_type_id === row.asset_type_id)) {
                rowErrors.push(`asset_type_id '${row.asset_type_id}' does not exist`);
            }
            
            if (row.branch_id && !referenceData.branches.find(b => b.branch_id === row.branch_id)) {
                rowErrors.push(`branch_id '${row.branch_id}' does not exist`);
            }
            
            if (row.purchase_vendor_id && !referenceData.vendors.find(v => v.vendor_id === row.purchase_vendor_id)) {
                rowErrors.push(`purchase_vendor_id '${row.purchase_vendor_id}' does not exist`);
            }
            
            if (row.prod_serv_id && !referenceData.prodServs.find(ps => ps.prod_serv_id === row.prod_serv_id)) {
                rowErrors.push(`prod_serv_id '${row.prod_serv_id}' does not exist`);
            }
            
            validationResults.push({
                rowNumber,
                isValid: rowErrors.length === 0,
                errors: rowErrors
            });
            
            if (rowErrors.length > 0) {
                errors.push(`Row ${rowNumber}: ${rowErrors.join(', ')}`);
            }
        }
        
        const validRows = validationResults.filter(r => r.isValid);
        const invalidRows = validationResults.filter(r => !r.isValid);
        
        res.json({
            success: true,
            totalRows: csvData.length,
            validRows: validRows.length,
            invalidRows: invalidRows.length,
            validationResults,
            errors: errors.slice(0, 50), // Limit to first 50 errors
            hasMoreErrors: errors.length > 50
        });
    } catch (error) {
        console.error("Error validating bulk upload assets:", error);
        res.status(500).json({ 
            error: "Failed to validate bulk upload assets",
            message: error.message 
        });
    }
};

// Trial upload for assets (simulate upsert)
const trialUploadAssets = async (req, res) => {
    try {
        const { csvData } = req.body;
        
        if (!csvData || !Array.isArray(csvData)) {
            return res.status(400).json({ 
                error: "csvData array is required" 
            });
        }

        // Simulate trial upload results
        const existingAssetIds = await model.checkExistingAssetIds(
            csvData.map(row => row.asset_id).filter(id => id)
        );
        const existingIds = existingAssetIds.rows.map(row => row.asset_id);
        
        let newRecords = 0;
        let updatedRecords = 0;
        let errors = 0;
        
        csvData.forEach(row => {
            if (existingIds.includes(row.asset_id)) {
                updatedRecords++;
            } else {
                newRecords++;
            }
        });
        
        res.json({
            success: true,
            trialResults: {
                totalRows: csvData.length,
                newRecords,
                updatedRecords,
                errors,
                totalProcessed: newRecords + updatedRecords
            }
        });
    } catch (error) {
        console.error("Error in trial upload assets:", error);
        res.status(500).json({ 
            error: "Failed to process trial upload",
            message: error.message 
        });
    }
};

// Commit bulk upload for assets
const commitBulkUploadAssets = async (req, res) => {
    try {
        const { csvData } = req.body;
        
        if (!csvData || !Array.isArray(csvData)) {
            return res.status(400).json({ 
                error: "csvData array is required" 
            });
        }

        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const created_by = req.user.user_id;
        const user_org_id = req.user.org_id;
        const user_branch_id = req.user.branch_id;
        const results = await model.bulkUpsertAssets(csvData, created_by, user_org_id, user_branch_id);
        
        res.json({
            success: true,
            message: "Bulk upload completed successfully",
            results: {
                totalProcessed: results.totalProcessed,
                inserted: results.inserted,
                updated: results.updated,
                errors: results.errors
            }
        });
    } catch (error) {
        console.error("Error committing bulk upload assets:", error);
        res.status(500).json({ 
            error: "Failed to commit bulk upload",
            message: error.message 
        });
    }
};

module.exports = {
    checkExistingAssets,
    validateBulkUploadAssets,
    trialUploadAssets,
    commitBulkUploadAssets
};
