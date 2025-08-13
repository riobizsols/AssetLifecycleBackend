const DepreciationModel = require('../models/depreciationModel');
const DepreciationService = require('../services/depreciationService');

/**
 * Depreciation Controller
 * Handles all business logic for depreciation operations
 */

class DepreciationController {
    /**
     * Calculate depreciation for a single asset
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async calculateAssetDepreciation(req, res) {
        try {
            const { asset_id } = req.params;
            const { calculation_date, org_id } = req.body;
            const user_id = req.user?.user_id || 'SYSTEM';

            // Get asset depreciation information
            const assetResult = await DepreciationModel.getAssetDepreciationInfo(asset_id);
            
            if (assetResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Asset not found',
                    message: 'The specified asset does not exist'
                });
            }

            const asset = assetResult.rows[0];
            
            // Check if asset is eligible for depreciation
            if (asset.asset_type_depreciation_type === 'ND') {
                return res.status(400).json({
                    error: 'Asset not eligible for depreciation',
                    message: 'This asset type is set to "No Depreciation"'
                });
            }

            if (!asset.purchased_cost || asset.purchased_cost <= 0) {
                return res.status(400).json({
                    error: 'Invalid asset cost',
                    message: 'Asset must have a valid purchase cost for depreciation calculation'
                });
            }

            // Use asset-specific values or fall back to defaults
            const usefulLifeYears = asset.useful_life_years || 5;
            const depreciationMethod = asset.asset_type_depreciation_type || 'SL';
            const salvageValue = asset.salvage_value || 0;

            // Validate parameters
            const validation = DepreciationService.validateDepreciationParams({
                originalCost: asset.purchased_cost,
                salvageValue: salvageValue,
                usefulLifeYears: usefulLifeYears,
                depreciationMethod: depreciationMethod
            });

            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Invalid depreciation parameters',
                    details: validation.errors
                });
            }

            // Calculate depreciation based on method
            let depreciationResult;
            const calcDate = calculation_date ? new Date(calculation_date) : new Date();

            if (depreciationMethod === 'SL') {
                depreciationResult = DepreciationService.calculateDepreciationForDateRange(
                    new Date(asset.purchased_on),
                    calcDate,
                    asset.purchased_cost,
                    salvageValue,
                    usefulLifeYears
                );
            } else if (depreciationMethod === 'RB') {
                const currentBookValue = asset.current_book_value || asset.purchased_cost;
                const depreciationRate = (asset.depreciation_rate || 0.25) / 100; // Convert percentage to decimal
                depreciationResult = DepreciationService.calculateReducingBalanceDepreciation(
                    currentBookValue,
                    depreciationRate
                );
            } else if (depreciationMethod === 'DD') {
                const currentBookValue = asset.current_book_value || asset.purchased_cost;
                depreciationResult = DepreciationService.calculateDoubleDecliningDepreciation(
                    currentBookValue,
                    usefulLifeYears,
                    salvageValue
                );
            } else {
                return res.status(400).json({
                    error: 'Unsupported depreciation method',
                    message: `Depreciation method '${depreciationMethod}' is not supported`
                });
            }

            // Prepare data for database update
            const bookValueBefore = asset.current_book_value || asset.purchased_cost;
            const bookValueAfter = depreciationResult.currentBookValue || depreciationResult.newBookValue;
            const depreciationAmount = depreciationResult.periodDepreciation || depreciationResult.depreciationAmount;

            // Insert depreciation record
            const depreciationRecord = await DepreciationModel.insertDepreciationRecord({
                asset_id: asset.asset_id,
                org_id: org_id || asset.org_id,
                depreciation_date: calcDate,
                depreciation_amount: depreciationAmount,
                book_value_before: bookValueBefore,
                book_value_after: bookValueAfter,
                depreciation_type: depreciationMethod,
                depreciation_rate: depreciationResult.depreciationRate || asset.depreciation_rate || 0,
                useful_life_years: usefulLifeYears,
                salvage_value: salvageValue,
                original_cost: asset.purchased_cost,
                created_by: user_id
            });

            // Update asset depreciation values
            const updatedAsset = await DepreciationModel.updateAssetDepreciation(asset.asset_id, {
                current_book_value: bookValueAfter,
                accumulated_depreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
                last_depreciation_calc_date: calcDate,
                depreciation_rate: depreciationResult.depreciationRate || asset.depreciation_rate || 0,
                changed_by: user_id
            });

            res.status(200).json({
                message: 'Depreciation calculated successfully',
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
                depreciation_type: depreciationMethod,
                calculation_date: calcDate,
                depreciation_amount: depreciationAmount,
                book_value_before: bookValueBefore,
                book_value_after: bookValueAfter,
                depreciation_record: depreciationRecord.rows[0],
                updated_asset: updatedAsset.rows[0]
            });

        } catch (error) {
            console.error('Error calculating asset depreciation:', error);
            res.status(500).json({
                error: 'Failed to calculate depreciation',
                message: error.message
            });
        }
    }

    /**
     * Calculate depreciation for multiple assets
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async calculateBulkDepreciation(req, res) {
        try {
            const { org_id, calculation_date, asset_ids } = req.body;
            const user_id = req.user?.user_id || 'SYSTEM';

            if (!org_id) {
                return res.status(400).json({
                    error: 'Organization ID required',
                    message: 'org_id is required for bulk depreciation calculation'
                });
            }

            const calcDate = calculation_date ? new Date(calculation_date) : new Date();
            const results = [];
            const errors = [];

            // Get assets for depreciation
            const assetsResult = await DepreciationModel.getAssetsForDepreciation(org_id);
            const assets = assetsResult.rows;

            // Filter by specific asset IDs if provided
            const targetAssets = asset_ids ? 
                assets.filter(asset => asset_ids.includes(asset.asset_id)) : 
                assets;

            for (const asset of targetAssets) {
                try {
                    // Calculate depreciation for each asset
                    const depreciationResult = await this.calculateSingleAssetDepreciation(
                        asset, 
                        calcDate, 
                        user_id, 
                        org_id
                    );
                    
                    results.push({
                        asset_id: asset.asset_id,
                        asset_name: asset.asset_name,
                        status: 'success',
                        depreciation_amount: depreciationResult.depreciationAmount,
                        book_value_after: depreciationResult.bookValueAfter
                    });

                } catch (error) {
                    errors.push({
                        asset_id: asset.asset_id,
                        asset_name: asset.asset_name,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            res.status(200).json({
                message: 'Bulk depreciation calculation completed',
                total_assets: targetAssets.length,
                successful: results.length,
                failed: errors.length,
                results: results,
                errors: errors
            });

        } catch (error) {
            console.error('Error in bulk depreciation calculation:', error);
            res.status(500).json({
                error: 'Failed to calculate bulk depreciation',
                message: error.message
            });
        }
    }

    /**
     * Get depreciation history for an asset
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAssetDepreciationHistory(req, res) {
        try {
            const { asset_id } = req.params;
            const { limit = 50 } = req.query;

            const historyResult = await DepreciationModel.getDepreciationHistory(asset_id, parseInt(limit));
            
            res.status(200).json({
                asset_id: asset_id,
                history: historyResult.rows,
                total_records: historyResult.rows.length
            });

        } catch (error) {
            console.error('Error getting depreciation history:', error);
            res.status(500).json({
                error: 'Failed to get depreciation history',
                message: error.message
            });
        }
    }

    /**
     * Get depreciation summary for organization
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getDepreciationSummary(req, res) {
        try {
            const { org_id } = req.params;
            const { date_from, date_to } = req.query;

            const summaryResult = await DepreciationModel.getDepreciationSummary(org_id, date_from, date_to);
            
            res.status(200).json({
                org_id: org_id,
                summary: summaryResult.rows[0] || {},
                date_range: {
                    from: date_from || 'all',
                    to: date_to || 'all'
                }
            });

        } catch (error) {
            console.error('Error getting depreciation summary:', error);
            res.status(500).json({
                error: 'Failed to get depreciation summary',
                message: error.message
            });
        }
    }

    /**
     * Get assets by depreciation method
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAssetsByDepreciationMethod(req, res) {
        try {
            const { org_id, method } = req.params;

            if (!['ND', 'SL', 'RB', 'DD'].includes(method)) {
                return res.status(400).json({
                    error: 'Invalid depreciation method',
                    message: 'Depreciation method must be one of: ND, SL, RB, DD'
                });
            }

            const assetsResult = await DepreciationModel.getAssetsByDepreciationMethod(org_id, method);
            
            res.status(200).json({
                org_id: org_id,
                depreciation_type: method,
                assets: assetsResult.rows,
                total_assets: assetsResult.rows.length
            });

        } catch (error) {
            console.error('Error getting assets by depreciation method:', error);
            res.status(500).json({
                error: 'Failed to get assets by depreciation method',
                message: error.message
            });
        }
    }

    /**
     * Get depreciation settings for organization
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getDepreciationSettings(req, res) {
        try {
            const { org_id } = req.params;

            const settingsResult = await DepreciationModel.getDepreciationSettings(org_id);
            
            res.status(200).json({
                org_id: org_id,
                settings: settingsResult.rows[0] || {}
            });

        } catch (error) {
            console.error('Error getting depreciation settings:', error);
            res.status(500).json({
                error: 'Failed to get depreciation settings',
                message: error.message
            });
        }
    }

    /**
     * Update depreciation settings
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async updateDepreciationSettings(req, res) {
        try {
            const { setting_id } = req.params;
            const updateData = req.body;
            const user_id = req.user?.user_id || 'SYSTEM';

            const updatedSettings = await DepreciationModel.updateDepreciationSettings(setting_id, {
                ...updateData,
                changed_by: user_id
            });

            res.status(200).json({
                message: 'Depreciation settings updated successfully',
                settings: updatedSettings.rows[0]
            });

        } catch (error) {
            console.error('Error updating depreciation settings:', error);
            res.status(500).json({
                error: 'Failed to update depreciation settings',
                message: error.message
            });
        }
    }

    /**
     * Generate depreciation schedule for an asset
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async generateDepreciationSchedule(req, res) {
        try {
            const { asset_id } = req.params;
            const { org_id } = req.body;

            // Get asset information
            const assetResult = await DepreciationModel.getAssetDepreciationInfo(asset_id);
            
            if (assetResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Asset not found',
                    message: 'The specified asset does not exist'
                });
            }

            const asset = assetResult.rows[0];
            
            if (asset.asset_type_depreciation_type === 'ND') {
                return res.status(400).json({
                    error: 'Asset not eligible for depreciation',
                    message: 'This asset type is set to "No Depreciation"'
                });
            }

            const usefulLifeYears = asset.useful_life_years || 5;
            const salvageValue = asset.salvage_value || 0;

            // Generate schedule
            const schedule = DepreciationService.generateDepreciationSchedule(
                asset.purchased_cost,
                salvageValue,
                usefulLifeYears,
                new Date(asset.purchased_on)
            );

            res.status(200).json({
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
                depreciation_type: asset.asset_type_depreciation_type,
                original_cost: asset.purchased_cost,
                salvage_value: salvageValue,
                useful_life_years: usefulLifeYears,
                schedule: schedule
            });

        } catch (error) {
            console.error('Error generating depreciation schedule:', error);
            res.status(500).json({
                error: 'Failed to generate depreciation schedule',
                message: error.message
            });
        }
    }

    /**
     * Helper method to calculate depreciation for a single asset
     * @param {Object} asset - Asset object
     * @param {Date} calculationDate - Date for calculation
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Depreciation result
     */
    static async calculateSingleAssetDepreciation(asset, calculationDate, userId, orgId) {
                    const usefulLifeYears = asset.useful_life_years || 5;
            const depreciationMethod = asset.asset_type_depreciation_type || 'SL';
        const salvageValue = asset.salvage_value || 0;

        let depreciationResult;
        let depreciationAmount;
        let bookValueAfter;

        if (depreciationMethod === 'SL') {
            depreciationResult = DepreciationService.calculateDepreciationForDateRange(
                new Date(asset.purchased_on),
                calculationDate,
                asset.purchased_cost,
                salvageValue,
                usefulLifeYears
            );
            depreciationAmount = depreciationResult.periodDepreciation;
            bookValueAfter = depreciationResult.currentBookValue;
        } else if (depreciationMethod === 'RB') {
            const currentBookValue = asset.current_book_value || asset.purchased_cost;
            const depreciationRate = (asset.depreciation_rate || 0.25) / 100;
            depreciationResult = DepreciationService.calculateReducingBalanceDepreciation(
                currentBookValue,
                depreciationRate
            );
            depreciationAmount = depreciationResult.depreciationAmount;
            bookValueAfter = depreciationResult.newBookValue;
        } else if (depreciationMethod === 'DD') {
            const currentBookValue = asset.current_book_value || asset.purchased_cost;
            depreciationResult = DepreciationService.calculateDoubleDecliningDepreciation(
                currentBookValue,
                usefulLifeYears,
                salvageValue
            );
            depreciationAmount = depreciationResult.depreciationAmount;
            bookValueAfter = depreciationResult.newBookValue;
        }

        // Insert depreciation record
        await DepreciationModel.insertDepreciationRecord({
            asset_id: asset.asset_id,
            org_id: orgId,
            depreciation_date: calculationDate,
            depreciation_amount: depreciationAmount,
            book_value_before: asset.current_book_value || asset.purchased_cost,
            book_value_after: bookValueAfter,
            depreciation_type: depreciationMethod,
            depreciation_rate: depreciationResult.depreciationRate || asset.depreciation_rate || 0,
            useful_life_years: usefulLifeYears,
            salvage_value: salvageValue,
            original_cost: asset.purchased_cost,
            created_by: userId
        });

        // Update asset
        await DepreciationModel.updateAssetDepreciation(asset.asset_id, {
            current_book_value: bookValueAfter,
            accumulated_depreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
            last_depreciation_calc_date: calculationDate,
            depreciation_rate: depreciationResult.depreciationRate || asset.depreciation_rate || 0,
            changed_by: userId
        });

        return {
            depreciationAmount,
            bookValueAfter
        };
    }
}

module.exports = DepreciationController;
