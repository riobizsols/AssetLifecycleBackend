const DepreciationModel = require('../models/depreciationModel');
const DepreciationService = require('../services/depreciationService');
const depreciationLogger = require('../eventLoggers/depreciationEventLogger');

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
        const startTime = Date.now();
        const { asset_id } = req.params;
        const { calculation_date, org_id } = req.body;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logCalculateAssetDepreciationApiCalled({
                assetId: asset_id,
                calculationDate: calculation_date,
                orgId: org_id,
                requestData: { operation: 'calculate_asset_depreciation' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logFetchingAssetDepreciationInfo({
                assetId: asset_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Get asset depreciation information
            const assetResult = await DepreciationModel.getAssetDepreciationInfo(asset_id);
            
            if (assetResult.rows.length === 0) {
                depreciationLogger.logAssetNotFound({
                    assetId: asset_id,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(404).json({
                    error: 'Asset not found',
                    message: 'The specified asset does not exist'
                });
            }

            const asset = assetResult.rows[0];
            
            // Check if asset is eligible for depreciation
            if (asset.asset_type_depreciation_type === 'ND') {
                depreciationLogger.logAssetNotEligibleForDepreciation({
                    assetId: asset_id,
                    depreciationType: asset.asset_type_depreciation_type,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Asset not eligible for depreciation',
                    message: 'This asset type is set to "No Depreciation"'
                });
            }

            if (!asset.purchased_cost || asset.purchased_cost <= 0) {
                depreciationLogger.logInvalidAssetCost({
                    assetId: asset_id,
                    purchasedCost: asset.purchased_cost,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Invalid asset cost',
                    message: 'Asset must have a valid purchase cost for depreciation calculation'
                });
            }

            // Use asset-specific values or fall back to defaults
            const usefulLifeYears = asset.useful_life_years || 5;
            const depreciationMethod = asset.asset_type_depreciation_type || 'SL';
            const salvageValue = asset.salvage_value || 0;

            depreciationLogger.logValidatingDepreciationParams({
                assetId: asset_id,
                originalCost: asset.purchased_cost,
                salvageValue: salvageValue,
                usefulLifeYears: usefulLifeYears,
                depreciationMethod: depreciationMethod,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Validate parameters
            const validation = DepreciationService.validateDepreciationParams({
                originalCost: asset.purchased_cost,
                salvageValue: salvageValue,
                usefulLifeYears: usefulLifeYears,
                depreciationMethod: depreciationMethod
            });

            if (!validation.isValid) {
                depreciationLogger.logDepreciationParamsInvalid({
                    assetId: asset_id,
                    errors: validation.errors,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Invalid depreciation parameters',
                    details: validation.errors
                });
            }

            // Calculate depreciation based on method
            let depreciationResult;
            const calcDate = calculation_date ? new Date(calculation_date) : new Date();

            depreciationLogger.logCalculatingDepreciation({
                assetId: asset_id,
                depreciationMethod: depreciationMethod,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

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
                // Use explicit rate if provided, otherwise let the service calculate it
                const explicitRate = asset.depreciation_rate ? (asset.depreciation_rate / 100) : null;
                depreciationResult = DepreciationService.calculateReducingBalanceDepreciation(
                    currentBookValue,
                    asset.purchased_cost,
                    salvageValue,
                    usefulLifeYears,
                    explicitRate
                );
            } else if (depreciationMethod === 'DD') {
                const currentBookValue = asset.current_book_value || asset.purchased_cost;
                depreciationResult = DepreciationService.calculateDoubleDecliningDepreciation(
                    currentBookValue,
                    usefulLifeYears,
                    salvageValue
                );
            } else {
                depreciationLogger.logDepreciationMethodNotSupported({
                    assetId: asset_id,
                    depreciationMethod: depreciationMethod,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Unsupported depreciation method',
                    message: `Depreciation method '${depreciationMethod}' is not supported`
                });
            }

            // Prepare data for database update
            const bookValueBefore = asset.current_book_value || asset.purchased_cost;
            const bookValueAfter = depreciationResult.currentBookValue || depreciationResult.newBookValue;
            const depreciationAmount = depreciationResult.periodDepreciation || depreciationResult.depreciationAmount;

            depreciationLogger.logDepreciationCalculated({
                assetId: asset_id,
                depreciationAmount: depreciationAmount,
                bookValueBefore: bookValueBefore,
                bookValueAfter: bookValueAfter,
                depreciationMethod: depreciationMethod,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logInsertingDepreciationRecord({
                assetId: asset_id,
                depreciationAmount: depreciationAmount,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

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

            depreciationLogger.logDepreciationRecordInserted({
                assetId: asset_id,
                recordId: depreciationRecord.rows[0]?.depreciation_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logUpdatingAssetDepreciation({
                assetId: asset_id,
                bookValueAfter: bookValueAfter,
                accumulatedDepreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Update asset depreciation values
            const updatedAsset = await DepreciationModel.updateAssetDepreciation(asset.asset_id, {
                current_book_value: bookValueAfter,
                accumulated_depreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
                last_depreciation_calc_date: calcDate,
                depreciation_rate: depreciationResult.depreciationRate || asset.depreciation_rate || 0,
                changed_by: user_id
            });

            depreciationLogger.logAssetDepreciationUpdated({
                assetId: asset_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

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
            depreciationLogger.logAssetDepreciationCalculationError({
                assetId: asset_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { org_id, calculation_date, asset_ids } = req.body;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logCalculateBulkDepreciationApiCalled({
                orgId: org_id,
                calculationDate: calculation_date,
                assetIds: asset_ids,
                requestData: { operation: 'calculate_bulk_depreciation' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            if (!org_id) {
                depreciationLogger.logMissingOrgId({
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Organization ID required',
                    message: 'org_id is required for bulk depreciation calculation'
                });
            }

            const calcDate = calculation_date ? new Date(calculation_date) : new Date();
            const results = [];
            const errors = [];

            depreciationLogger.logFetchingAssetsForDepreciation({
                orgId: org_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Get assets for depreciation
            const assetsResult = await DepreciationModel.getAssetsForDepreciation(org_id);
            const assets = assetsResult.rows;

            depreciationLogger.logAssetsRetrievedForDepreciation({
                orgId: org_id,
                count: assets.length,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Filter by specific asset IDs if provided
            const targetAssets = asset_ids ? 
                assets.filter(asset => asset_ids.includes(asset.asset_id)) : 
                assets;

            depreciationLogger.logProcessingBulkDepreciation({
                orgId: org_id,
                totalAssets: targetAssets.length,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

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

            depreciationLogger.logBulkDepreciationCompleted({
                orgId: org_id,
                totalAssets: targetAssets.length,
                successful: results.length,
                failed: errors.length,
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

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
            depreciationLogger.logBulkDepreciationError({
                orgId: org_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { asset_id } = req.params;
        const { limit = 50 } = req.query;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logGetAssetDepreciationHistoryApiCalled({
                assetId: asset_id,
                limit: parseInt(limit),
                requestData: { operation: 'get_asset_depreciation_history' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logQueryingDepreciationHistory({
                assetId: asset_id,
                limit: parseInt(limit),
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            const historyResult = await DepreciationModel.getDepreciationHistory(asset_id, parseInt(limit));
            
            depreciationLogger.logDepreciationHistoryRetrieved({
                assetId: asset_id,
                count: historyResult.rows.length,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));
            
            res.status(200).json({
                asset_id: asset_id,
                history: historyResult.rows,
                total_records: historyResult.rows.length
            });

        } catch (error) {
            console.error('Error getting depreciation history:', error);
            depreciationLogger.logDepreciationHistoryError({
                assetId: asset_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { org_id } = req.params;
        const { date_from, date_to } = req.query;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logGetDepreciationSummaryApiCalled({
                orgId: org_id,
                dateFrom: date_from,
                dateTo: date_to,
                requestData: { operation: 'get_depreciation_summary' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logQueryingDepreciationSummary({
                orgId: org_id,
                dateFrom: date_from,
                dateTo: date_to,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            const summaryResult = await DepreciationModel.getDepreciationSummary(org_id, date_from, date_to);
            
            depreciationLogger.logDepreciationSummaryRetrieved({
                orgId: org_id,
                summary: summaryResult.rows[0] || {},
                userId: user_id
            }).catch(err => console.error('Logging error:', err));
            
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
            depreciationLogger.logDepreciationSummaryError({
                orgId: org_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { org_id, method } = req.params;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logGetAssetsByDepreciationMethodApiCalled({
                orgId: org_id,
                method: method,
                requestData: { operation: 'get_assets_by_depreciation_method' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            if (!['ND', 'SL', 'RB', 'DD'].includes(method)) {
                depreciationLogger.logInvalidDepreciationMethod({
                    method: method,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Invalid depreciation method',
                    message: 'Depreciation method must be one of: ND, SL, RB, DD'
                });
            }

            depreciationLogger.logQueryingAssetsByDepreciationMethod({
                orgId: org_id,
                method: method,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            const assetsResult = await DepreciationModel.getAssetsByDepreciationMethod(org_id, method);
            
            depreciationLogger.logAssetsByDepreciationMethodRetrieved({
                orgId: org_id,
                method: method,
                count: assetsResult.rows.length,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));
            
            res.status(200).json({
                org_id: org_id,
                depreciation_type: method,
                assets: assetsResult.rows,
                total_assets: assetsResult.rows.length
            });

        } catch (error) {
            console.error('Error getting assets by depreciation method:', error);
            depreciationLogger.logAssetsByDepreciationMethodError({
                orgId: org_id,
                method: method,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { org_id } = req.params;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logGetDepreciationSettingsApiCalled({
                orgId: org_id,
                requestData: { operation: 'get_depreciation_settings' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logQueryingDepreciationSettings({
                orgId: org_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            const settingsResult = await DepreciationModel.getDepreciationSettings(org_id);
            
            depreciationLogger.logDepreciationSettingsRetrieved({
                orgId: org_id,
                settings: settingsResult.rows[0] || {},
                userId: user_id
            }).catch(err => console.error('Logging error:', err));
            
            res.status(200).json({
                org_id: org_id,
                settings: settingsResult.rows[0] || {}
            });

        } catch (error) {
            console.error('Error getting depreciation settings:', error);
            depreciationLogger.logDepreciationSettingsError({
                orgId: org_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { setting_id } = req.params;
        const updateData = req.body;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logUpdateDepreciationSettingsApiCalled({
                settingId: setting_id,
                updateData: updateData,
                requestData: { operation: 'update_depreciation_settings' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logUpdatingDepreciationSettings({
                settingId: setting_id,
                updateData: updateData,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            const updatedSettings = await DepreciationModel.updateDepreciationSettings(setting_id, {
                ...updateData,
                changed_by: user_id
            });

            depreciationLogger.logDepreciationSettingsUpdated({
                settingId: setting_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            res.status(200).json({
                message: 'Depreciation settings updated successfully',
                settings: updatedSettings.rows[0]
            });

        } catch (error) {
            console.error('Error updating depreciation settings:', error);
            depreciationLogger.logDepreciationSettingsUpdateError({
                settingId: setting_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
        const startTime = Date.now();
        const { asset_id } = req.params;
        const { org_id } = req.body;
        const user_id = req.user?.user_id || 'SYSTEM';
        
        try {
            depreciationLogger.logGenerateDepreciationScheduleApiCalled({
                assetId: asset_id,
                orgId: org_id,
                requestData: { operation: 'generate_depreciation_schedule' },
                userId: user_id,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));

            depreciationLogger.logFetchingAssetForSchedule({
                assetId: asset_id,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Get asset information
            const assetResult = await DepreciationModel.getAssetDepreciationInfo(asset_id);
            
            if (assetResult.rows.length === 0) {
                depreciationLogger.logAssetNotFound({
                    assetId: asset_id,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(404).json({
                    error: 'Asset not found',
                    message: 'The specified asset does not exist'
                });
            }

            const asset = assetResult.rows[0];
            
            if (asset.asset_type_depreciation_type === 'ND') {
                depreciationLogger.logAssetNotEligibleForSchedule({
                    assetId: asset_id,
                    depreciationType: asset.asset_type_depreciation_type,
                    userId: user_id
                }).catch(err => console.error('Logging error:', err));
                
                return res.status(400).json({
                    error: 'Asset not eligible for depreciation',
                    message: 'This asset type is set to "No Depreciation"'
                });
            }

            const usefulLifeYears = asset.useful_life_years || 5;
            const salvageValue = asset.salvage_value || 0;

            depreciationLogger.logGeneratingDepreciationSchedule({
                assetId: asset_id,
                originalCost: asset.purchased_cost,
                salvageValue: salvageValue,
                usefulLifeYears: usefulLifeYears,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

            // Generate schedule
            const schedule = DepreciationService.generateDepreciationSchedule(
                asset.purchased_cost,
                salvageValue,
                usefulLifeYears,
                new Date(asset.purchased_on)
            );

            depreciationLogger.logDepreciationScheduleGenerated({
                assetId: asset_id,
                scheduleLength: schedule.length,
                userId: user_id
            }).catch(err => console.error('Logging error:', err));

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
            depreciationLogger.logDepreciationScheduleError({
                assetId: asset_id,
                error,
                userId: user_id
            }).catch(logErr => console.error('Logging error:', logErr));
            
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
