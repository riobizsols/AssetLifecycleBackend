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
    
        let depreciationAmount;
        let bookValueBefore = asset.current_book_value || asset.purchased_cost;
        let bookValueAfter;
        let annualRateDecimal = 0; // Store as decimal (e.g., 0.2 for 20%)
    
        if (depreciationMethod === 'SL') {
            // Straight Line
            const annualDepreciation = (asset.purchased_cost - salvageValue) / usefulLifeYears;
            const monthlyDepreciation = annualDepreciation / 12;
            annualRateDecimal = 1 / usefulLifeYears;
    
            depreciationAmount = monthlyDepreciation;
            bookValueAfter = Math.max(bookValueBefore - depreciationAmount, salvageValue);
    
            console.log(`[DEBUG SL] Annual: ${annualDepreciation}, Monthly: ${monthlyDepreciation}`);
        } 
        else if (depreciationMethod === 'RB') {
            // Reducing Balance
            if (asset.depreciation_rate && asset.depreciation_rate > 0) {
                annualRateDecimal = asset.depreciation_rate / 100; // Convert % to decimal
            } else {
                annualRateDecimal = 1 - Math.pow(salvageValue / asset.purchased_cost, 1 / usefulLifeYears);
            }
    
            const monthlyRateDecimal = annualRateDecimal / 12;
            depreciationAmount = bookValueBefore * monthlyRateDecimal;
            bookValueAfter = Math.max(bookValueBefore - depreciationAmount, salvageValue);
    
            console.log(`[DEBUG RB] Annual Rate: ${(annualRateDecimal * 100).toFixed(4)}%, Monthly Rate: ${(monthlyRateDecimal * 100).toFixed(6)}%`);
        } 
        else if (depreciationMethod === 'DD') {
            // Double Declining Balance
            const straightLineRateDecimal = 1 / usefulLifeYears;
            const doubleDecliningRateDecimal = straightLineRateDecimal * 2;
            annualRateDecimal = doubleDecliningRateDecimal;
    
            const monthlyRateDecimal = doubleDecliningRateDecimal / 12;
            depreciationAmount = bookValueBefore * monthlyRateDecimal;
            bookValueAfter = Math.max(bookValueBefore - depreciationAmount, salvageValue);
    
            console.log(`[DEBUG DD] Straight Line Rate: ${(straightLineRateDecimal * 100).toFixed(2)}%, Double Rate: ${(doubleDecliningRateDecimal * 100).toFixed(2)}%, Monthly Rate: ${(monthlyRateDecimal * 100).toFixed(4)}%`);
        } 
        else {
            throw new Error(`Unsupported depreciation method: ${depreciationMethod}`);
        }
    
        // Adjust final depreciation if hitting salvage
        if (bookValueAfter === salvageValue) {
            depreciationAmount = bookValueBefore - salvageValue;
        }
    
        // Insert depreciation record
        await DepreciationModel.insertDepreciationRecord({
            asset_id: asset.asset_id,
            org_id: orgId,
            depreciation_amount: depreciationAmount,
            book_value_before: bookValueBefore,
            book_value_after: bookValueAfter,
            depreciation_rate: annualRateDecimal * 100, // store as %
            useful_life_years: usefulLifeYears,
            created_by: userId
        });
    
        // Update asset depreciation values
        const updateResult = await DepreciationModel.updateAssetDepreciation(asset.asset_id, {
            current_book_value: bookValueAfter,
            accumulated_depreciation: (asset.accumulated_depreciation || 0) + depreciationAmount,
            last_depreciation_calc_date: new Date(),
            depreciation_rate: annualRateDecimal * 100, // store as %
            changed_by: userId
        });
    
        console.log(`[DEBUG] Asset ${asset.asset_id} updated:`, updateResult.rows[0]);
    
        return {
            depreciationAmount,
            bookValueBefore,
            bookValueAfter
        };
    }
    
}

module.exports = CronJobService;
