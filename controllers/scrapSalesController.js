const model = require("../models/scrapSalesModel");
const db = require("../config/db");

// POST /api/scrap-sales - Create new scrap sale
const createScrapSale = async (req, res) => {
    try {
        const {
            text,
            total_sale_value,
            buyer_name,
            buyer_company,
            buyer_phone,
            sale_date,
            collection_date,
            invoice_no,
            po_no,
            scrapAssets
        } = req.body;

        const org_id = req.user?.org_id;
        const created_by = req.user?.user_id;

        // Validation
        if (!text || !total_sale_value || !buyer_name || !scrapAssets || !Array.isArray(scrapAssets) || scrapAssets.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                message: "text, total_sale_value, buyer_name, and scrapAssets array are required"
            });
        }

        // Validate scrap assets
        const asdIds = scrapAssets.map(asset => asset.asd_id);
        const validationResult = await model.validateScrapAssets(asdIds);
        
        if (validationResult.rows.length !== asdIds.length) {
            return res.status(400).json({
                success: false,
                error: "Invalid scrap assets",
                message: "Some scrap assets do not exist"
            });
        }

        // Check for already sold assets
        const alreadySold = validationResult.rows.filter(asset => asset.already_sold);
        if (alreadySold.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Assets already sold",
                message: "Some assets are already sold",
                alreadySold: alreadySold.map(asset => ({
                    asd_id: asset.asd_id,
                    asset_name: asset.asset_name,
                    serial_number: asset.serial_number
                }))
            });
        }

        // Validate sale values
        const totalCalculatedValue = scrapAssets.reduce((sum, asset) => sum + (asset.sale_value || 0), 0);
        if (Math.abs(totalCalculatedValue - total_sale_value) > 0.01) {
            return res.status(400).json({
                success: false,
                error: "Value mismatch",
                message: `Total sale value (${total_sale_value}) does not match sum of individual asset values (${totalCalculatedValue})`
            });
        }

        // Prepare sale data
        const saleData = {
            header: {
                org_id,
                text,
                total_sale_value,
                buyer_name,
                buyer_company: buyer_company || null,
                buyer_phone: buyer_phone || null,
                created_by,
                sale_date: sale_date || new Date().toISOString().split('T')[0],
                collection_date: collection_date || null,
                invoice_no: invoice_no || null,
                po_no: po_no || null
            },
            scrapAssets: scrapAssets.map(asset => ({
                asd_id: asset.asd_id,
                sale_value: asset.sale_value || 0
            }))
        };

        // Debug: Log the sale data being passed
        console.log('🔍 Sale data being passed to model:', JSON.stringify(saleData, null, 2));

        // Create scrap sale
        const result = await model.createScrapSale(saleData);
        
        res.status(201).json({
            success: true,
            message: "Scrap sale created successfully",
            scrap_sale: {
                ssh_id: result.header.ssh_id,
                header: result.header,
                details: result.details,
                total_assets: result.details.length
            }
        });
    } catch (err) {
        console.error("Error creating scrap sale:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to create scrap sale",
            message: err.message 
        });
    }
};

// GET /api/scrap-sales - Get all scrap sales
const getAllScrapSales = async (req, res) => {
    try {
        const result = await model.getAllScrapSales();
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} scrap sales`,
            count: result.rows.length,
            scrap_sales: result.rows
        });
    } catch (err) {
        console.error("Error fetching scrap sales:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap sales",
            message: err.message 
        });
    }
};

// GET /api/scrap-sales/:id - Get scrap sale by ID
const getScrapSaleById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getScrapSaleById(id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                error: "Scrap sale not found",
                message: `Scrap sale with ID ${id} does not exist`
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Scrap sale retrieved successfully",
            scrap_sale: result
        });
    } catch (err) {
        console.error("Error fetching scrap sale:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap sale",
            message: err.message 
        });
    }
};

// POST /api/scrap-sales/validate-assets - Validate scrap assets before sale
const validateScrapAssetsForSale = async (req, res) => {
    try {
        const { asdIds } = req.body;

        if (!asdIds || !Array.isArray(asdIds) || asdIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                message: "asdIds array is required"
            });
        }

        const validationResult = await model.validateScrapAssets(asdIds);
        
        const validAssets = validationResult.rows.filter(asset => !asset.already_sold);
        const alreadySoldAssets = validationResult.rows.filter(asset => asset.already_sold);
        const invalidAssets = asdIds.filter(id => !validationResult.rows.find(asset => asset.asd_id === id));

        res.status(200).json({
            success: true,
            message: "Asset validation completed",
            validation: {
                total_requested: asdIds.length,
                valid_assets: validAssets.length,
                already_sold: alreadySoldAssets.length,
                invalid_assets: invalidAssets.length,
                valid_assets_list: validAssets,
                already_sold_list: alreadySoldAssets,
                invalid_assets_list: invalidAssets
            }
        });
    } catch (err) {
        console.error("Error validating scrap assets:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to validate scrap assets",
            message: err.message 
        });
    }
};

module.exports = {
    createScrapSale,
    getAllScrapSales,
    getScrapSaleById,
    validateScrapAssetsForSale
};
