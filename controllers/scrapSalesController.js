const model = require("../models/scrapSalesModel");
// Import scrap sales logger
const scrapSalesLogger = require('../eventLoggers/scrapSalesEventLogger');

// POST /api/scrap-sales - Create new scrap sale
const createScrapSale = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
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
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log('=== Scrap Sales Creation Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);
        
        // Get branch_code from tblBranches
        let userBranchCode = null;
        if (userBranchId) {
            const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;
            const dbPool = req.db || require("../config/db");

            const branchResult = await dbPool.query(branchQuery, [userBranchId]);
            if (branchResult.rows.length > 0) {
                userBranchCode = branchResult.rows[0].branch_code;
                console.log('User branch_code:', userBranchCode);
            } else {
                console.log('Branch not found for branch_id:', userBranchId);
            }
        }

        // Log API called
        scrapSalesLogger.logCreateScrapSaleApiCalled({
            method: req.method,
            url: req.originalUrl,
            userId,
            saleData: { buyer_name, total_sale_value, scrapAssets }
        }).catch(err => console.error('Logging error:', err));

        // Validation
        if (!text || !total_sale_value || !buyer_name || !scrapAssets || !Array.isArray(scrapAssets) || scrapAssets.length === 0) {
            const missingFields = [];
            if (!text) missingFields.push('text');
            if (!total_sale_value) missingFields.push('total_sale_value');
            if (!buyer_name) missingFields.push('buyer_name');
            if (!scrapAssets || !Array.isArray(scrapAssets) || scrapAssets.length === 0) missingFields.push('scrapAssets');
            
            scrapSalesLogger.logMissingRequiredFields({
                operation: 'Create Scrap Sale',
                missingFields,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(400).json({
                success: false,
                error: "Missing required fields",
                message: "text, total_sale_value, buyer_name, and scrapAssets array are required"
            });
        }

        // Validate scrap assets
        const asdIds = scrapAssets.map(asset => asset.asd_id);
        
        scrapSalesLogger.logProcessingAssetValidation({
            asdIds,
            userId
        }).catch(err => console.error('Logging error:', err));
        
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
            scrapSalesLogger.logAssetsAlreadySold({
                alreadySoldAssets: alreadySold,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            
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
            scrapSalesLogger.logValueMismatch({
                totalSaleValue: total_sale_value,
                calculatedValue: totalCalculatedValue,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(400).json({
                success: false,
                error: "Value mismatch",
                message: `Total sale value (${total_sale_value}) does not match sum of individual asset values (${totalCalculatedValue})`
            });
        }

        // Log data preparation step
        scrapSalesLogger.logDataPreparationStarted({
            buyerName: buyer_name,
            totalValue: total_sale_value,
            assetCount: scrapAssets.length,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Prepare sale data
        const saleData = {
            header: {
                org_id,
                branch_code: userBranchCode,
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

        // Log data preparation completed
        scrapSalesLogger.logDataPreparationCompleted({
            headerData: saleData.header,
            assetDetails: saleData.scrapAssets,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log database transaction initiation
        scrapSalesLogger.logDatabaseTransactionStarted({
            operation: 'Create Scrap Sale',
            tables: ['tblScrapSales_H', 'tblScrapSales_D'],
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log processing scrap sale creation
        scrapSalesLogger.logProcessingScrapSaleCreation({
            sshId: null, // Will be set after creation
            buyerName: buyer_name,
            totalValue: total_sale_value,
            assetCount: scrapAssets.length,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Create scrap sale with workflow (for approval process)
        const result = await model.createScrapSaleWithWorkflow(saleData, org_id, created_by);
        
        // Log database transaction completed
        scrapSalesLogger.logDatabaseTransactionCompleted({
            operation: 'Create Scrap Sale',
            sshId: result.header.ssh_id,
            tablesUpdated: ['tblScrapSales_H', 'tblScrapSales_D'],
            recordsCreated: {
                header: 1,
                details: result.details.length
            },
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log header table insertion details
        scrapSalesLogger.logHeaderTableInserted({
            sshId: result.header.ssh_id,
            tableName: 'tblScrapSales_H',
            headerData: result.header,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log details table insertion details
        scrapSalesLogger.logDetailsTableInserted({
            sshId: result.header.ssh_id,
            tableName: 'tblScrapSales_D',
            detailRecords: result.details,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log asset status updates
        scrapSalesLogger.logAssetStatusUpdated({
            sshId: result.header.ssh_id,
            assetsUpdated: result.details.map(detail => ({
                asd_id: detail.asd_id,
                ssd_id: detail.ssd_id,
                sale_value: detail.sale_value
            })),
            userId
        }).catch(err => console.error('Logging error:', err));
        
        // Log success
        scrapSalesLogger.logScrapSaleCreated({
            sshId: result.header.ssh_id,
            buyerName: buyer_name,
            totalValue: total_sale_value,
            assetCount: result.details.length,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
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
        
        // Log error
        scrapSalesLogger.logScrapSaleCreationError({
            error: err,
            userId,
            duration: Date.now() - startTime,
            saleData: { buyer_name: req.body.buyer_name, total_sale_value: req.body.total_sale_value }
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to create scrap sale",
            message: err.message 
        });
    }
};

// GET /api/scrap-sales - Get all scrap sales
const getAllScrapSales = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const org_id = req.user.org_id;
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log('=== Scrap Sales Listing Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);
        
        // Get branch_code from tblBranches
        let userBranchCode = null;
        const hasSuperAccess = req.user?.hasSuperAccess || false;
        
        if (!hasSuperAccess && userBranchId) {
            const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;
            const dbPool = req.db || require("../config/db");

            const branchResult = await dbPool.query(branchQuery, [userBranchId]);
            if (branchResult.rows.length > 0) {
                userBranchCode = branchResult.rows[0].branch_code;
                console.log('User branch_code:', userBranchCode);
            } else {
                console.log('Branch not found for branch_id:', userBranchId);
            }
        }
        
        // Log API called
        scrapSalesLogger.logGetAllScrapSalesApiCalled({
            method: req.method,
            url: req.originalUrl,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        const result = await model.getAllScrapSales(org_id, userBranchCode, hasSuperAccess);
        
        // Log success
        if (result.rows.length === 0) {
            scrapSalesLogger.logNoScrapSalesFound({
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        } else {
            scrapSalesLogger.logScrapSalesRetrieved({
                count: result.rows.length,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} scrap sales`,
            count: result.rows.length,
            scrap_sales: result.rows
        });
    } catch (err) {
        console.error("Error fetching scrap sales:", err);
        
        // Log error
        scrapSalesLogger.logScrapSalesRetrievalError({
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap sales",
            message: err.message 
        });
    }
};

// GET /api/scrap-sales/:id - Get scrap sale by ID
const getScrapSaleById = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
        
        // Log API called
        scrapSalesLogger.logGetScrapSaleByIdApiCalled({
            method: req.method,
            url: req.originalUrl,
            sshId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        const result = await model.getScrapSaleById(id);
        
        if (!result) {
            scrapSalesLogger.logScrapSaleNotFound({
                sshId: id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({
                success: false,
                error: "Scrap sale not found",
                message: `Scrap sale with ID ${id} does not exist`
            });
        }
        
        // Log success
        scrapSalesLogger.logScrapSaleDetailRetrieved({
            sshId: id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            success: true,
            message: "Scrap sale retrieved successfully",
            scrap_sale: result
        });
    } catch (err) {
        console.error("Error fetching scrap sale:", err);
        
        // Log error
        scrapSalesLogger.logScrapSaleDetailRetrievalError({
            sshId: req.params.id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap sale",
            message: err.message 
        });
    }
};

// POST /api/scrap-sales/validate-assets - Validate scrap assets before sale
const validateScrapAssetsForSale = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { asdIds } = req.body;

        // Log API called
        scrapSalesLogger.logValidateScrapAssetsApiCalled({
            method: req.method,
            url: req.originalUrl,
            userId,
            asdIds
        }).catch(err => console.error('Logging error:', err));

        if (!asdIds || !Array.isArray(asdIds) || asdIds.length === 0) {
            scrapSalesLogger.logMissingRequiredFields({
                operation: 'Validate Scrap Assets',
                missingFields: ['asdIds'],
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
            
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

        // Log success
        scrapSalesLogger.logAssetValidationCompleted({
            validCount: validAssets.length,
            alreadySoldCount: alreadySoldAssets.length,
            invalidCount: invalidAssets.length,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

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
        
        // Log error
        scrapSalesLogger.logAssetValidationError({
            error: err,
            userId,
            duration: Date.now() - startTime,
            asdIds: req.body.asdIds
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to validate scrap assets",
            message: err.message 
        });
    }
};

// DELETE /api/scrap-sales/:id - Delete scrap sale
const deleteScrapSale = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id: ssh_id } = req.params;

        // Log API called
        scrapSalesLogger.logDeleteScrapSaleApiCalled({
            method: req.method,
            url: req.originalUrl,
            userId,
            sshId: ssh_id
        }).catch(err => console.error('Logging error:', err));

        // Validate SSH ID format
        if (!ssh_id || !ssh_id.startsWith('SSH')) {
            return res.status(400).json({
                success: false,
                error: "Invalid SSH ID format",
                message: "SSH ID must start with 'SSH'"
            });
        }

        // Check if scrap sale exists
        const existingSale = await model.getScrapSaleById(ssh_id);
        if (!existingSale) {
            scrapSalesLogger.logScrapSaleNotFoundForDeletion({
                sshId: ssh_id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({
                success: false,
                error: "Scrap sale not found",
                message: `Scrap sale with ID ${ssh_id} does not exist`
            });
        }

        // Log deletion started
        scrapSalesLogger.logScrapSaleDeletionStarted({
            sshId: ssh_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Delete the scrap sale
        const deleteResult = await model.deleteScrapSale(ssh_id);

        // Log individual deletion steps
        scrapSalesLogger.logDocumentsDeleted({
            sshId: ssh_id,
            documentsDeleted: 0, // We don't track document count in the model
            userId
        }).catch(err => console.error('Logging error:', err));

        scrapSalesLogger.logDetailsDeleted({
            sshId: ssh_id,
            detailsDeleted: deleteResult.detailsDeleted,
            assetsAffected: deleteResult.assetsAffected,
            userId
        }).catch(err => console.error('Logging error:', err));

        scrapSalesLogger.logHeaderDeleted({
            sshId: ssh_id,
            headerDeleted: deleteResult.headerDeleted,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Log successful deletion
        const totalRecordsDeleted = deleteResult.headerDeleted + deleteResult.detailsDeleted;
        scrapSalesLogger.logScrapSaleDeleted({
            sshId: ssh_id,
            totalRecordsDeleted,
            assetsAffected: deleteResult.assetsAffected,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.json({
            success: true,
            message: "Scrap sale deleted successfully",
            deleted: {
                ssh_id: ssh_id,
                header_records: deleteResult.headerDeleted,
                detail_records: deleteResult.detailsDeleted,
                total_records: totalRecordsDeleted,
                assets_affected: deleteResult.assetsAffected
            }
        });

    } catch (err) {
        console.error("Error deleting scrap sale:", err);
        
        // Log error
        scrapSalesLogger.logScrapSaleDeletionError({
            sshId: req.params.id,
            error: err,
            userId,
            duration: Date.now() - startTime
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to delete scrap sale",
            message: err.message 
        });
    }
};

// PUT /api/scrap-sales/:id - Update scrap sale
const updateScrapSale = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
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
        const changed_by = req.user?.user_id;
        
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

        // Check if assets are already sold in other sales
        const alreadySold = validationResult.rows.filter(asset => asset.already_sold);
        const currentSaleDetails = await model.getScrapSaleById(id);
        const currentAsdIds = currentSaleDetails?.details?.map(d => d.asd_id) || [];
        
        // Filter out assets that are already sold but are in the current sale
        const actuallySold = alreadySold.filter(asset => !currentAsdIds.includes(asset.asd_id));
        
        if (actuallySold.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Assets already sold",
                message: "Some assets are already sold in another sale",
                alreadySold: actuallySold.map(asset => ({
                    asd_id: asset.asd_id,
                    asset_name: asset.asset_name,
                    serial_number: asset.serial_number
                }))
            });
        }

        // Prepare sale data
        const saleData = {
            header: {
                text,
                total_sale_value,
                buyer_name,
                buyer_company: buyer_company || null,
                buyer_phone: buyer_phone || null,
                sale_date: sale_date || null,
                collection_date: collection_date || null,
                invoice_no: invoice_no || null,
                po_no: po_no || null,
                changed_by
            },
            scrapAssets: scrapAssets.map(asset => ({
                asd_id: asset.asd_id,
                sale_value: asset.sale_value || 0
            }))
        };

        // Update scrap sale
        const result = await model.updateScrapSale(id, saleData);
        
        res.status(200).json({
            success: true,
            message: "Scrap sale updated successfully",
            scrap_sale: result
        });
    } catch (error) {
        console.error("Error updating scrap sale:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update scrap sale",
            message: error.message
        });
    }
};

module.exports = {
    createScrapSale,
    getAllScrapSales,
    getScrapSaleById,
    updateScrapSale,
    validateScrapAssetsForSale,
    deleteScrapSale
};
