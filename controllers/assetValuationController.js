const AssetValuationModel = require('../models/assetValuationModel');
const { exportToExcel, exportToCSV } = require('../utils/exportUtils');
const {
    logReportApiCall,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logNoDataFound, 
    logLargeResultSet,
    logUnauthorizedReportAccess,
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');

class AssetValuationController {
    /**
     * Get asset valuation data with filtering and pagination
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAssetValuationData(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;
        const APP_ID = 'ASSETVALUATION';
        
        try {
            // Log API called
            await logReportApiCall({
                appId: APP_ID,
                operation: 'Get Asset Valuation Report',
                method: req.method,
                url: req.originalUrl,
                requestData: req.query,
                userId
            });
            
            // Validate required parameters
            if (!req.user?.org_id) {
                await logUnauthorizedReportAccess({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    userId,
                    duration: Date.now() - startTime
                });
                
                return res.status(400).json({
                    success: false,
                    message: 'Organization ID is required'
                });
            }
            
            const orgId = req.user.org_id;  
            
            // Extract query parameters
            const {
                assetStatus,
                includeScrapAssets,
                currentValueMin,
                currentValueMax,
                category,
                location,
                department,
                acquisitionDateFrom,
                acquisitionDateTo,
                page,
                limit,
                sortBy,
                sortOrder,
                advancedConditions
            } = req.query;

            // Validate required parameters
            if (!page || !limit) {
                return res.status(400).json({
                    success: false,
                    message: 'Page and limit parameters are required'
                });
            }

            // Parse advanced conditions
            
            let parsedAdvancedConditions = null;
            if (advancedConditions) {
                try {
                    parsedAdvancedConditions = typeof advancedConditions === 'string' 
                        ? JSON.parse(advancedConditions) 
                        : advancedConditions;
                } catch (error) {
                    console.error('Error parsing advanced conditions:', error);
                    console.error('Raw advancedConditions that failed to parse:', advancedConditions);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advanced conditions format'
                    });
                }
            }

            // Add user's branch_id as default filter
            const userBranchId = req.user?.branch_id;
            const hasSuperAccess = req.user?.hasSuperAccess || false;
            if (!hasSuperAccess && userBranchId) {
                console.log('🔍 [AssetValuationController] Added user branch_id filter:', userBranchId);
            } else if (hasSuperAccess) {
                console.log('🔍 [AssetValuationController] User has super access - no branch filter applied');
            }

            // Parse array parameters
            const filters = {
                branch_id: (!hasSuperAccess && userBranchId) ? userBranchId : null,
                hasSuperAccess: hasSuperAccess, // Pass to model
                assetStatus: assetStatus || null,
                includeScrapAssets: includeScrapAssets === 'true' || includeScrapAssets === true,
                currentValueMin: currentValueMin ? parseFloat(currentValueMin) : null,
                currentValueMax: currentValueMax ? parseFloat(currentValueMax) : null,
                category: category ? (Array.isArray(category) ? category : [category]) : null,
                location: location ? (Array.isArray(location) ? location : [location]) : null,
                department: department ? (Array.isArray(department) ? department : [department]) : null,
                acquisitionDateFrom: acquisitionDateFrom || null,
                acquisitionDateTo: acquisitionDateTo || null,
                page: parseInt(page),
                limit: parseInt(limit),
                sortBy: sortBy || null,
                sortOrder: sortOrder || null,
                advancedConditions: parsedAdvancedConditions
            };

            // Debug logs removed for cleaner console
            
            // Log filters applied
            const appliedFilters = Object.keys(filters).filter(key => 
                filters[key] !== null && !['page', 'limit', 'sortBy', 'sortOrder'].includes(key)
            );
            
            if (appliedFilters.length > 0) {
                await logReportFiltersApplied({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    filters: Object.fromEntries(appliedFilters.map(key => [key, filters[key]])),
                    userId
                });
            }

            // Log data retrieval started
            await logReportDataRetrieval({
                appId: APP_ID,
                reportType: 'Asset Valuation',
                filters,
                userId
            });

            const result = await AssetValuationModel.getAssetValuationData(filters, orgId);
            const recordCount = result.assets?.length || 0;

            // Log no data or success
            if (recordCount === 0) {
                await logNoDataFound({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    filters,
                    userId,
                    duration: Date.now() - startTime
                });
            } else {
                await logReportDataRetrieved({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    recordCount,
                    filters,
                    duration: Date.now() - startTime,
                    userId
                });
                
                // Warn if large result set
                if (result.pagination?.total > 1000) {
                    await logLargeResultSet({
                        appId: APP_ID,
                        reportType: 'Asset Valuation',
                        recordCount: result.pagination.total,
                        threshold: 1000,
                        userId
                    });
                }
            }

            res.status(200).json({
                success: true,
                message: 'Asset valuation data retrieved successfully',
                data: result.assets,
                pagination: result.pagination,
                totals: result.totals,
                filters: result.filters
            });

        } catch (error) {
            console.error('Error in getAssetValuationData:', error);
            
            // Determine error level
            const isDbError = error.code && (error.code.startsWith('23') || error.code.startsWith('42') || error.code === 'ECONNREFUSED');
            
            if (error.code === 'ECONNREFUSED') {
                await logDatabaseConnectionFailure({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    error,
                    userId,
                    duration: Date.now() - startTime
                });
            } else if (isDbError) {
                await logDatabaseQueryError({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    query: 'getAssetValuationData',
                    error,
                    userId,
                    duration: Date.now() - startTime
                });
            } else {
                await logReportGenerationError({
                    appId: APP_ID,
                    reportType: 'Asset Valuation',
                    error,
                    filters: req.query,
                    userId,
                    duration: Date.now() - startTime
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve asset valuation data',
                error: error.message
            });
        }
    }

    /**
     * Get asset valuation summary for dashboard
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getAssetValuationSummary(req, res) {
        try {
            // Validate required parameters
            if (!req.user?.org_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization ID is required'
                });
            }
            
            const orgId = req.user.org_id;

            const summary = await AssetValuationModel.getAssetValuationSummary(orgId);

            res.status(200).json({
                success: true,
                message: 'Asset valuation summary retrieved successfully',
                data: summary
            });

        } catch (error) {
            console.error('Error in getAssetValuationSummary:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve asset valuation summary',
                error: error.message
            });
        }
    }

    /**
     * Get available filter options
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getFilterOptions(req, res) {
        try {
            // Validate required parameters
            if (!req.user?.org_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Organization ID is required'
                });
            }
            
            const orgId = req.user.org_id;

            const filterOptions = await AssetValuationModel.getFilterOptions(orgId);

            res.status(200).json({
                success: true,
                message: 'Filter options retrieved successfully',
                data: filterOptions
            });

        } catch (error) {
            console.error('Error in getFilterOptions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve filter options',
                error: error.message
            });
        }
    }

    /**
     * Export asset valuation data to Excel
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async exportToExcel(req, res) {
        try {
            const orgId = req.user?.org_id || 'ORG001';
            
            // Extract query parameters (same as getAssetValuationData)
            const {
                assetStatus,
                includeScrapAssets,
                currentValueMin,
                currentValueMax,
                category,
                location,
                department,
                acquisitionDateFrom,
                acquisitionDateTo,
                sortBy = 'asset_id',
                sortOrder = 'ASC'
            } = req.query;

            const userBranchId = req.user?.branch_id;
            const hasSuperAccess = req.user?.hasSuperAccess || false;
            const filters = {
                branch_id: (!hasSuperAccess && userBranchId) ? userBranchId : null,
                hasSuperAccess: hasSuperAccess, // Pass to model
                assetStatus: assetStatus || 'In-Use',
                includeScrapAssets: includeScrapAssets === 'true',
                currentValueMin: currentValueMin ? parseFloat(currentValueMin) : null,
                currentValueMax: currentValueMax ? parseFloat(currentValueMax) : null,
                category: category ? (Array.isArray(category) ? category : [category]) : null,
                location: location ? (Array.isArray(location) ? location : [location]) : null,
                department: department ? (Array.isArray(department) ? department : [department]) : null,
                acquisitionDateFrom: acquisitionDateFrom || null,
                acquisitionDateTo: acquisitionDateTo || null,
                page: 1,
                limit: 10000, // Large limit for export
                sortBy,
                sortOrder
            };

            const result = await AssetValuationModel.getAssetValuationData(filters, orgId);
                    
            // Get summary data for comprehensive report
            const summary = await AssetValuationModel.getAssetValuationSummary(orgId);

            // Prepare comprehensive data for Excel export
            const excelData = result.assets.map(asset => ({
                'Asset Code': asset['Asset Code'],
                'Asset Name': asset['Name'],
                'Category': asset['Category'],
                'Location': asset['Location'],
                'Department': asset['Department'],
                'Asset Status': asset['Asset Status'],
                'Acquisition Date': asset['Acquisition Date'],
                'Current Value (₹)': asset['Current Value'],
                'Original Cost (₹)': asset['Original Cost'],
                'Accumulated Depreciation (₹)': asset['Accumulated Depreciation'],
                'Net Book Value (₹)': asset['Net Book Value'],
                'Depreciation Method': asset['Depreciation Method'],
                'Useful Life (Years)': asset['Useful Life'],
                'Serial Number': asset['serial_number'],
                'Description': asset['description'],
                'Vendor': asset['Vendor'],
                'Purchased By': asset['purchased_by'],
                'Warranty Period': asset['warranty_period'],
                'Expiry Date': asset['expiry_date']
            }));

            // Calculate filtered totals from the actual result data
            const filteredInUseAssets = result.assets.filter(asset => asset['Asset Status'] === 'In-Use');
            const filteredScrapAssets = result.assets.filter(asset => asset['Asset Status'] === 'Scrap');
            
            const filteredInUseTotals = {
                count: filteredInUseAssets.length,
                totalCurrentValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredScrapTotals = {
                count: filteredScrapAssets.length,
                totalCurrentValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredOverallTotals = {
                count: result.assets.length,
                totalCurrentValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };

            // Prepare comprehensive summary data based on applied filters
            const summaryData = [
                {
                    'Report Section': 'FILTERED RESULTS SUMMARY',
                    'Description': 'Values based on applied filters',
                    'Count': '',
                    'Current Value (₹)': '',
                    'Original Cost (₹)': '',
                    'Accumulated Depreciation (₹)': '',
                    'Net Book Value (₹)': ''
                },
                {
                    'Report Section': 'In-Use Assets (Filtered)',
                    'Description': 'Assets currently in use matching filter criteria',
                    'Count': filteredInUseTotals.count,
                    'Current Value (₹)': filteredInUseTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredInUseTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredInUseTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredInUseTotals.totalNetBookValue.toFixed(2)
                },
                {
                    'Report Section': 'Scrap Assets (Filtered)',
                    'Description': 'Scrapped assets matching filter criteria',
                    'Count': filteredScrapTotals.count,
                    'Current Value (₹)': filteredScrapTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredScrapTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredScrapTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredScrapTotals.totalNetBookValue.toFixed(2)
                },
                {
                    'Report Section': 'Overall Total (Filtered)',
                    'Description': 'Combined totals for all filtered assets',
                    'Count': filteredOverallTotals.count,
                    'Current Value (₹)': filteredOverallTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredOverallTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredOverallTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredOverallTotals.totalNetBookValue.toFixed(2)
                },
                {
                    'Report Section': 'ORGANIZATION-WIDE TOTALS',
                    'Description': 'All assets in organization (unfiltered)',
                    'Count': '',
                    'Current Value (₹)': '',
                    'Original Cost (₹)': '',
                    'Accumulated Depreciation (₹)': '',
                    'Net Book Value (₹)': ''
                },
                {
                    'Report Section': 'Total In-Use Assets (All)',
                    'Description': 'All in-use assets in organization',
                    'Count': summary.inUse.asset_count,
                    'Current Value (₹)': summary.inUse.total_current_value,
                    'Original Cost (₹)': summary.inUse.total_original_cost,
                    'Accumulated Depreciation (₹)': summary.inUse.total_accumulated_depreciation,
                    'Net Book Value (₹)': summary.inUse.total_net_book_value || 0
                },
                {
                    'Report Section': 'Total Scrap Assets (All)',
                    'Description': 'All scrap assets in organization',
                    'Count': summary.scrap.asset_count,
                    'Current Value (₹)': summary.scrap.total_current_value,
                    'Original Cost (₹)': summary.scrap.total_original_cost,
                    'Accumulated Depreciation (₹)': summary.scrap.total_accumulated_depreciation,
                    'Net Book Value (₹)': summary.scrap.total_net_book_value || 0
                },
                {
                    'Report Section': 'Overall Total (All)',
                    'Description': 'All assets in organization',
                    'Count': summary.overall.asset_count,
                    'Current Value (₹)': summary.overall.total_current_value,
                    'Original Cost (₹)': summary.overall.total_original_cost,
                    'Accumulated Depreciation (₹)': summary.overall.total_accumulated_depreciation,
                    'Net Book Value (₹)': summary.overall.total_net_book_value || 0
                }
            ];

            // Prepare filter information
            const filterInfo = [
                {
                    'Filter Applied': 'Asset Status',
                    'Value': filters.assetStatus || 'All'
                },
                {
                    'Filter Applied': 'Include Scrap Assets',
                    'Value': filters.includeScrapAssets ? 'Yes' : 'No'
                },
                {
                    'Filter Applied': 'Current Value Range',
                    'Value': filters.currentValueMin && filters.currentValueMax 
                        ? `₹${filters.currentValueMin} - ₹${filters.currentValueMax}`
                        : filters.currentValueMin 
                            ? `≥ ₹${filters.currentValueMin}`
                            : filters.currentValueMax
                                ? `≤ ₹${filters.currentValueMax}`
                                : 'All'
                },
                {
                    'Filter Applied': 'Category',
                    'Value': filters.category ? (Array.isArray(filters.category) ? filters.category.join(', ') : filters.category) : 'All'
                },
                {
                    'Filter Applied': 'Location',
                    'Value': filters.location ? (Array.isArray(filters.location) ? filters.location.join(', ') : filters.location) : 'All'
                },
                {
                    'Filter Applied': 'Acquisition Date Range',
                    'Value': filters.acquisitionDateFrom && filters.acquisitionDateTo
                        ? `${filters.acquisitionDateFrom} to ${filters.acquisitionDateTo}`
                        : filters.acquisitionDateFrom
                            ? `From ${filters.acquisitionDateFrom}`
                            : filters.acquisitionDateTo
                                ? `Until ${filters.acquisitionDateTo}`
                                : 'All'
                },
                {
                    'Filter Applied': 'Report Generated On',
                    'Value': new Date().toLocaleString()
                }
            ];

            // Prepare comprehensive Excel export with multiple sheets
            const sheetsData = {
                'Asset Details': excelData,
                'Summary': summaryData,
                'Filter Information': filterInfo
            };

            const fileName = `Asset_Valuation_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
            
            // Set response headers for file download
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            // Export to Excel
            await exportToExcel(sheetsData, res);

        } catch (error) {
            console.error('Error in exportToExcel:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export asset valuation data to Excel',
                error: error.message
            });
        }
    }

    /**
     * Export asset valuation data to CSV
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async exportToCSV(req, res) {
        try {
            const orgId = req.user?.org_id || 'ORG001';
            
            // Extract query parameters (same as getAssetValuationData)
            const {
                assetStatus,
                includeScrapAssets,
                currentValueMin,
                currentValueMax,
                category,
                location,
                department,
                acquisitionDateFrom,
                acquisitionDateTo,
                sortBy = 'asset_id',
                sortOrder = 'ASC'
            } = req.query;

            const userBranchId = req.user?.branch_id;
            const hasSuperAccess = req.user?.hasSuperAccess || false;
            const filters = {
                branch_id: (!hasSuperAccess && userBranchId) ? userBranchId : null,
                hasSuperAccess: hasSuperAccess, // Pass to model
                assetStatus: assetStatus || 'In-Use',
                includeScrapAssets: includeScrapAssets === 'true',
                currentValueMin: currentValueMin ? parseFloat(currentValueMin) : null,
                currentValueMax: currentValueMax ? parseFloat(currentValueMax) : null,
                category: category ? (Array.isArray(category) ? category : [category]) : null,
                location: location ? (Array.isArray(location) ? location : [location]) : null,
                department: department ? (Array.isArray(department) ? department : [department]) : null,
                acquisitionDateFrom: acquisitionDateFrom || null,
                acquisitionDateTo: acquisitionDateTo || null,
                page: 1,
                limit: 10000, // Large limit for export
                sortBy,
                sortOrder
            };

            const result = await AssetValuationModel.getAssetValuationData(filters, orgId);
            
            // Get summary data for comprehensive report
            const summary = await AssetValuationModel.getAssetValuationSummary(orgId);

            // Calculate filtered totals from the actual result data
            const filteredInUseAssets = result.assets.filter(asset => asset['Asset Status'] === 'In-Use');
            const filteredScrapAssets = result.assets.filter(asset => asset['Asset Status'] === 'Scrap');
            
            const filteredInUseTotals = {
                count: filteredInUseAssets.length,
                totalCurrentValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredScrapTotals = {
                count: filteredScrapAssets.length,
                totalCurrentValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredOverallTotals = {
                count: result.assets.length,
                totalCurrentValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };

            // Prepare summary data for CSV
            const summaryData = [
                {
                    'Report Section': 'FILTERED RESULTS SUMMARY',
                    'Description': 'Values based on applied filters',
                    'Count': '',
                    'Current Value (₹)': '',
                    'Original Cost (₹)': '',
                    'Accumulated Depreciation (₹)': '',
                    'Net Book Value (₹)': ''
                },
                {
                    'Report Section': 'In-Use Assets (Filtered)',
                    'Description': 'Assets currently in use matching filter criteria',
                    'Count': filteredInUseTotals.count,
                    'Current Value (₹)': filteredInUseTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredInUseTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredInUseTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredInUseTotals.totalNetBookValue.toFixed(2)
                },
                {
                    'Report Section': 'Scrap Assets (Filtered)',
                    'Description': 'Scrapped assets matching filter criteria',
                    'Count': filteredScrapTotals.count,
                    'Current Value (₹)': filteredScrapTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredScrapTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredScrapTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredScrapTotals.totalNetBookValue.toFixed(2)
                },
                {
                    'Report Section': 'Overall Total (Filtered)',
                    'Description': 'Combined totals for all filtered assets',
                    'Count': filteredOverallTotals.count,
                    'Current Value (₹)': filteredOverallTotals.totalCurrentValue.toFixed(2),
                    'Original Cost (₹)': filteredOverallTotals.totalOriginalCost.toFixed(2),
                    'Accumulated Depreciation (₹)': filteredOverallTotals.totalAccumulatedDepreciation.toFixed(2),
                    'Net Book Value (₹)': filteredOverallTotals.totalNetBookValue.toFixed(2)
                }
            ];

            // Prepare data for CSV export
            const csvData = result.assets.map(asset => ({
                'Asset Code': asset['Asset Code'],
                'Asset Name': asset['Name'],
                'Category': asset['Category'],
                'Location': asset['Location'],
                'Department': asset['Department'],
                'Asset Status': asset['Asset Status'],
                'Acquisition Date': asset['Acquisition Date'],
                'Current Value (₹)': asset['Current Value'],
                'Original Cost (₹)': asset['Original Cost'],
                'Accumulated Depreciation (₹)': asset['Accumulated Depreciation'],
                'Net Book Value (₹)': asset['Net Book Value'],
                'Depreciation Method': asset['Depreciation Method'],
                'Useful Life (Years)': asset['Useful Life'],
                'Serial Number': asset['serial_number'],
                'Description': asset['description'],
                'Vendor': asset['Vendor'],
                'Purchased By': asset['purchased_by'],
                'Warranty Period': asset['warranty_period'],
                'Expiry Date': asset['expiry_date']
            }));

            const fileName = `Asset_Valuation_Report_${new Date().toISOString().slice(0, 10)}.csv`;
            
            // Set response headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            // Combine summary and asset data for CSV export
            const combinedData = [...summaryData, ...csvData];
            
            // Export to CSV
            await exportToCSV(combinedData, res);

        } catch (error) {
            console.error('Error in exportToCSV:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export asset valuation data to CSV',
                error: error.message
            });
        }
    }

    /**
     * Export asset valuation data to JSON
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async exportToJSON(req, res) {
        try {
            const orgId = req.user?.org_id || 'ORG001';
            
            // Extract query parameters (same as getAssetValuationData)
            const {
                assetStatus,
                includeScrapAssets,
                currentValueMin,
                currentValueMax,
                category,
                location,
                department,
                acquisitionDateFrom,
                acquisitionDateTo,
                sortBy = 'asset_id',
                sortOrder = 'ASC'
            } = req.query;

            const userBranchId = req.user?.branch_id;
            const hasSuperAccess = req.user?.hasSuperAccess || false;
            const filters = {
                branch_id: (!hasSuperAccess && userBranchId) ? userBranchId : null,
                hasSuperAccess: hasSuperAccess, // Pass to model
                assetStatus: assetStatus || 'In-Use',
                includeScrapAssets: includeScrapAssets === 'true',
                currentValueMin: currentValueMin ? parseFloat(currentValueMin) : null,
                currentValueMax: currentValueMax ? parseFloat(currentValueMax) : null,
                category: category ? (Array.isArray(category) ? category : [category]) : null,
                location: location ? (Array.isArray(location) ? location : [location]) : null,
                department: department ? (Array.isArray(department) ? department : [department]) : null,
                acquisitionDateFrom: acquisitionDateFrom || null,
                acquisitionDateTo: acquisitionDateTo || null,
                page: 1,
                limit: 10000, // Large limit for export
                sortBy,
                sortOrder
            };

            const result = await AssetValuationModel.getAssetValuationData(filters, orgId);
            
            // Get summary data for comprehensive report
            const summary = await AssetValuationModel.getAssetValuationSummary(orgId);

            // Calculate filtered totals from the actual result data
            const filteredInUseAssets = result.assets.filter(asset => asset['Asset Status'] === 'In-Use');
            const filteredScrapAssets = result.assets.filter(asset => asset['Asset Status'] === 'Scrap');
            
            const filteredInUseTotals = {
                count: filteredInUseAssets.length,
                totalCurrentValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredInUseAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredScrapTotals = {
                count: filteredScrapAssets.length,
                totalCurrentValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: filteredScrapAssets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };
            
            const filteredOverallTotals = {
                count: result.assets.length,
                totalCurrentValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Current Value']) || 0), 0),
                totalOriginalCost: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Original Cost']) || 0), 0),
                totalAccumulatedDepreciation: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Accumulated Depreciation']) || 0), 0),
                totalNetBookValue: result.assets.reduce((sum, asset) => sum + (parseFloat(asset['Net Book Value']) || 0), 0)
            };

            // Prepare comprehensive JSON export data
            const jsonData = {
                exportInfo: {
                    generatedAt: new Date().toISOString(),
                    reportType: 'Asset Valuation Report',
                    filters: {
                        assetStatus: filters.assetStatus || 'All',
                        includeScrapAssets: filters.includeScrapAssets ? 'Yes' : 'No',
                        currentValueRange: filters.currentValueMin && filters.currentValueMax 
                            ? `₹${filters.currentValueMin} - ₹${filters.currentValueMax}`
                            : filters.currentValueMin 
                                ? `≥ ₹${filters.currentValueMin}`
                                : filters.currentValueMax
                                    ? `≤ ₹${filters.currentValueMax}`
                                    : 'All',
                        category: filters.category ? (Array.isArray(filters.category) ? filters.category.join(', ') : filters.category) : 'All',
                        location: filters.location ? (Array.isArray(filters.location) ? filters.location.join(', ') : filters.location) : 'All',
                        acquisitionDateRange: filters.acquisitionDateFrom && filters.acquisitionDateTo
                            ? `${filters.acquisitionDateFrom} to ${filters.acquisitionDateTo}`
                            : filters.acquisitionDateFrom
                                ? `From ${filters.acquisitionDateFrom}`
                                : filters.acquisitionDateTo
                                    ? `Until ${filters.acquisitionDateTo}`
                                    : 'All'
                    },
                    totalRecords: result.pagination.total
                },
                filteredResults: {
                    inUse: {
                        count: filteredInUseTotals.count,
                        totalCurrentValue: filteredInUseTotals.totalCurrentValue,
                        totalOriginalCost: filteredInUseTotals.totalOriginalCost,
                        totalAccumulatedDepreciation: filteredInUseTotals.totalAccumulatedDepreciation,
                        totalNetBookValue: filteredInUseTotals.totalNetBookValue
                    },
                    scrap: {
                        count: filteredScrapTotals.count,
                        totalCurrentValue: filteredScrapTotals.totalCurrentValue,
                        totalOriginalCost: filteredScrapTotals.totalOriginalCost,
                        totalAccumulatedDepreciation: filteredScrapTotals.totalAccumulatedDepreciation,
                        totalNetBookValue: filteredScrapTotals.totalNetBookValue
                    },
                    overall: {
                        count: filteredOverallTotals.count,
                        totalCurrentValue: filteredOverallTotals.totalCurrentValue,
                        totalOriginalCost: filteredOverallTotals.totalOriginalCost,
                        totalAccumulatedDepreciation: filteredOverallTotals.totalAccumulatedDepreciation,
                        totalNetBookValue: filteredOverallTotals.totalNetBookValue
                    }
                },
                organizationWideTotals: summary,
                assets: result.assets.map(asset => ({
                    assetCode: asset['Asset Code'],
                    name: asset['Name'],
                    category: asset['Category'],
                    location: asset['Location'],
                    department: asset['Department'],
                    assetStatus: asset['Asset Status'],
                    acquisitionDate: asset['Acquisition Date'],
                    currentValue: asset['Current Value'],
                    originalCost: asset['Original Cost'],
                    accumulatedDepreciation: asset['Accumulated Depreciation'],
                    netBookValue: asset['Net Book Value'],
                    depreciationMethod: asset['Depreciation Method'],
                    usefulLife: asset['Useful Life'],
                    serialNumber: asset['serial_number'],
                    description: asset['description'],
                    vendor: asset['Vendor'],
                    purchasedBy: asset['purchased_by'],
                    warrantyPeriod: asset['warranty_period'],
                    expiryDate: asset['expiry_date']
                }))
            };

            const fileName = `Asset_Valuation_Report_${new Date().toISOString().slice(0, 10)}.json`;
            
            // Set response headers for file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            // Send JSON data
            res.json(jsonData);

        } catch (error) {
            console.error('Error in exportToJSON:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export asset valuation data to JSON',
                error: error.message
            });
        }
    }
}

module.exports = AssetValuationController;
