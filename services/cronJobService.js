const DepreciationModel = require('../models/depreciationModel');
const DepreciationService = require('./depreciationService');

class CronJobService {
    /**
     * Manual trigger for depreciation calculation cron job
     * @param {string} orgId - Organization ID
     * @param {string} userId - User ID who triggered the job
     * @returns {Object} Job execution results
     */
    static async triggerDepreciationCronJob(orgId, userId = 'SYSTEM') {
        const startTime = new Date();
        const jobId = `CRON_${startTime.getTime()}_${orgId}`;
        
        console.log(`[${jobId}] Starting depreciation cron job for org: ${orgId}`);
        
        try {
            // Get all assets eligible for depreciation
            const assetsResult = await DepreciationModel.getAssetsForDepreciation(orgId);
            const assets = assetsResult.rows;
            
            if (assets.length === 0) {
                return {
                    jobId,
                    status: 'completed',
                    message: 'No assets eligible for depreciation',
                    startTime,
                    endTime: new Date(),
                    totalAssets: 0,
                    processedAssets: 0,
                    successful: 0,
                    failed: 0,
                    results: [],
                    errors: []
                };
            }
            
            console.log(`[${jobId}] Found ${assets.length} assets eligible for depreciation`);
            
            const results = [];
            const errors = [];
            let successful = 0;
            let failed = 0;
            
            // Process each asset
            for (const asset of assets) {
                try {
                    console.log(`[${jobId}] Processing asset: ${asset.asset_id} - ${asset.text}`);
                    
                    // Calculate depreciation for the asset
                    const depreciationResult = await this.calculateAssetDepreciation(asset, userId, orgId);
                    
                    results.push({
                        asset_id: asset.asset_id,
                        asset_name: asset.text,
                        status: 'success',
                        depreciation_amount: depreciationResult.depreciationAmount,
                        book_value_before: depreciationResult.bookValueBefore,
                        book_value_after: depreciationResult.bookValueAfter,
                        method: asset.asset_type_depreciation_type
                    });
                    
                    successful++;
                    console.log(`[${jobId}] Successfully processed asset: ${asset.asset_id}`);
                    
                } catch (error) {
                    console.error(`[${jobId}] Error processing asset ${asset.asset_id}:`, error.message);
                    
                    errors.push({
                        asset_id: asset.asset_id,
                        asset_name: asset.text,
                        status: 'error',
                        error: error.message
                    });
                    
                    failed++;
                }
            }
            
            const endTime = new Date();
            const executionTime = endTime - startTime;
            
            console.log(`[${jobId}] Cron job completed. Success: ${successful}, Failed: ${failed}, Time: ${executionTime}ms`);
            
            return {
                jobId,
                status: 'completed',
                message: `Depreciation calculation completed for ${assets.length} assets`,
                startTime,
                endTime,
                executionTime,
                totalAssets: assets.length,
                processedAssets: assets.length,
                successful,
                failed,
                results,
                errors
            };
            
        } catch (error) {
            const endTime = new Date();
            console.error(`[${jobId}] Cron job failed:`, error.message);
            
            return {
                jobId,
                status: 'failed',
                message: 'Cron job execution failed',
                startTime,
                endTime,
                error: error.message,
                totalAssets: 0,
                processedAssets: 0,
                successful: 0,
                failed: 0,
                results: [],
                errors: []
            };
        }
    }
    
    /**
     * Calculate depreciation for a single asset
     * @param {Object} asset - Asset object
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Depreciation result
     */
    static async calculateAssetDepreciation(asset, userId, orgId) {
        const usefulLifeYears = asset.useful_life_years || 5;
        const depreciationMethod = asset.asset_type_depreciation_type || 'SL';
        const salvageValue = asset.salvage_value || 0;
        
        let depreciationResult;
        let depreciationAmount;
        let bookValueAfter;
        let bookValueBefore = asset.current_book_value || asset.purchased_cost;
        
        if (depreciationMethod === 'SL') {
            // Calculate monthly straight line depreciation
            const annualDepreciation = (asset.purchased_cost - salvageValue) / usefulLifeYears;
            const monthlyDepreciation = annualDepreciation / 12;
            
            depreciationAmount = monthlyDepreciation;
            bookValueAfter = bookValueBefore - depreciationAmount;
            
            // Ensure book value doesn't go below salvage value
            if (bookValueAfter < salvageValue) {
                bookValueAfter = salvageValue;
                depreciationAmount = bookValueBefore - salvageValue;
            }
            
            console.log(`[DEBUG SL] Annual: ${annualDepreciation}, Monthly: ${monthlyDepreciation}`);
            console.log(`[DEBUG SL] Before: ${bookValueBefore}, After: ${bookValueAfter}, Depreciation: ${depreciationAmount}`);
        } else if (depreciationMethod === 'RB') {
            // Calculate Reducing Balance (WDV) depreciation - Auto-calculated rate
            // Formula: Double Declining Balance = (2 / useful_life_years) * 100
            const depreciationRatePercent = (2 / usefulLifeYears) * 100; // Auto-calculated based on useful life
            const annualDepreciationRate = depreciationRatePercent / 100;
            const monthlyDepreciationRate = annualDepreciationRate / 12; // Monthly rate
            
            // Monthly depreciation = Monthly Rate * Current Book Value
            depreciationAmount = bookValueBefore * monthlyDepreciationRate;
            bookValueAfter = bookValueBefore - depreciationAmount;
            
            // Ensure book value doesn't go below salvage value
            if (bookValueAfter < salvageValue) {
                bookValueAfter = salvageValue;
                depreciationAmount = bookValueBefore - salvageValue;
            }
            
            console.log(`[DEBUG RB] Auto-calculated Rate: ${depreciationRatePercent.toFixed(2)}% (2/${usefulLifeYears}), Monthly Rate: ${(monthlyDepreciationRate * 100).toFixed(4)}%`);
            console.log(`[DEBUG RB] Before: ${bookValueBefore}, After: ${bookValueAfter}, Depreciation: ${depreciationAmount}`);
        } else if (depreciationMethod === 'DD') {
            // Calculate Double Declining Balance depreciation
            // Formula: 2 * Beginning Book Value * Depreciation Rate
            // Rate = (100% / Useful life of the asset) - this stays the same
            const straightLineRate = 100 / usefulLifeYears; // e.g., 100/5 = 20%
            const doubleDecliningRate = 2 * straightLineRate; // e.g., 2 * 20% = 40%
            
            // Annual rate converted to monthly
            const annualDepreciationRate = doubleDecliningRate / 100;
            const monthlyDepreciationRate = annualDepreciationRate / 12; // Monthly rate
            
            // Monthly depreciation = Monthly Rate * Current Book Value
            depreciationAmount = bookValueBefore * monthlyDepreciationRate;
            bookValueAfter = bookValueBefore - depreciationAmount;
            
            // Ensure book value doesn't go below salvage value
            if (bookValueAfter < salvageValue) {
                bookValueAfter = salvageValue;
                depreciationAmount = bookValueBefore - salvageValue;
            }
            
            console.log(`[DEBUG DD] Straight Line Rate: ${straightLineRate.toFixed(2)}%, Double Rate: ${doubleDecliningRate.toFixed(2)}%, Monthly Rate: ${(monthlyDepreciationRate * 100).toFixed(4)}%`);
            console.log(`[DEBUG DD] Before: ${bookValueBefore}, After: ${bookValueAfter}, Depreciation: ${depreciationAmount}`);
        } else {
            throw new Error(`Unsupported depreciation method: ${depreciationMethod}`);
        }
        
        // Insert depreciation record
        await DepreciationModel.insertDepreciationRecord({
            asset_id: asset.asset_id,
            org_id: orgId,
            depreciation_amount: depreciationAmount,
            book_value_before: bookValueBefore,
            book_value_after: bookValueAfter,
            depreciation_rate: depreciationMethod === 'SL' ? (100 / usefulLifeYears) : 
                              depreciationMethod === 'RB' ? ((2 / usefulLifeYears) * 100) : 
                              depreciationMethod === 'DD' ? ((2 / usefulLifeYears) * 100) : 
                              (depreciationResult?.depreciationRate || asset.depreciation_rate || 0),
            useful_life_years: usefulLifeYears,
            created_by: userId
        });
        
        // Update asset depreciation values
        console.log(`[DEBUG] Updating asset ${asset.asset_id}:`);
        console.log(`  - Before: ${bookValueBefore}`);
        console.log(`  - After: ${bookValueAfter}`);
        console.log(`  - Depreciation: ${depreciationAmount}`);
        console.log(`  - Old Accumulated: ${asset.accumulated_depreciation || 0}`);
        console.log(`  - New Accumulated: ${(asset.accumulated_depreciation || 0) + depreciationAmount}`);
        
        const updateResult = await DepreciationModel.updateAssetDepreciation(asset.asset_id, {
            current_book_value: bookValueAfter,
            accumulated_depreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
            last_depreciation_calc_date: new Date(),
            depreciation_rate: depreciationMethod === 'SL' ? (100 / usefulLifeYears) : 
                              depreciationMethod === 'RB' ? ((2 / usefulLifeYears) * 100) : 
                              depreciationMethod === 'DD' ? ((2 / usefulLifeYears) * 100) : 
                              (depreciationResult?.depreciationRate || asset.depreciation_rate || 0),
            changed_by: userId
        });
        
        console.log(`[DEBUG] Asset update result:`, updateResult.rows[0]);
        console.log(`[DEBUG] Asset ${asset.asset_id} updated successfully`);
        
        return {
            depreciationAmount,
            bookValueBefore,
            bookValueAfter
        };
    }
}

module.exports = CronJobService;
