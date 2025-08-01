const model = require("../models/maintenanceScheduleModel");

// Main function to generate maintenance schedules
const generateMaintenanceSchedules = async (req, res) => {
    try {
        console.log('Starting maintenance schedule generation...');
        
        // Get test date from request body if provided, otherwise use current date
        const testDate = req.body.test_date ? new Date(req.body.test_date) : new Date();
        console.log(`Using date for comparison: ${testDate}`);
        
        // Step 1: Get asset types that require maintenance
        const assetTypesResult = await model.getAssetTypesRequiringMaintenance();
        const assetTypes = assetTypesResult.rows;
        
        console.log(`Found ${assetTypes.length} asset types requiring maintenance`);
        
        if (assetTypes.length === 0) {
            return res.status(200).json({
                message: "No asset types found that require maintenance",
                schedules_created: 0
            });
        }
        
        let totalSchedulesCreated = 0;
        let processedAssets = 0;
        let skippedAssets = 0;
        
        // Process each asset type
        for (const assetType of assetTypes) {
            console.log(`Processing asset type: ${assetType.asset_type_id} - ${assetType.text}`);
            
            // Step 2a: Get assets for this asset type
            const assetsResult = await model.getAssetsByAssetType(assetType.asset_type_id);
            const assets = assetsResult.rows;
            
            console.log(`Found ${assets.length} assets for asset type ${assetType.asset_type_id}`);
            
            if (assets.length === 0) {
                console.log(`No assets found for asset type ${assetType.asset_type_id}`);
                continue;
            }
            
            // Step 2b: Get maintenance frequency for this asset type
            const frequencyResult = await model.getMaintenanceFrequency(assetType.asset_type_id);
            const frequencies = frequencyResult.rows;
            
            if (frequencies.length === 0) {
                console.log(`No maintenance frequency found for asset type ${assetType.asset_type_id}`);
                continue;
            }
            
            // Process each asset
            for (const asset of assets) {
                console.log(`Processing asset: ${asset.asset_id} - ${asset.asset_name}`);
                processedAssets++;
                
                let shouldSkipAsset = false;
                let dateToConsider = new Date(asset.purchased_on);
                
                // Step 3a: Check tblAssetMaintSch for status "IN"
                const existingMaintenanceSchedules = await model.checkExistingMaintenanceSchedules(asset.asset_id);
                const inProgressSchedules = existingMaintenanceSchedules.rows.filter(s => s.status === 'IN');
                
                if (inProgressSchedules.length > 0) {
                    console.log(`Asset ${asset.asset_id} has in-progress maintenance schedules, skipping`);
                    skippedAssets++;
                    continue;
                }
                
                // Step 3b & 3c: Check for completed/cancelled schedules and get latest date
                const completedSchedules = existingMaintenanceSchedules.rows.filter(s => s.status === 'CO' || s.status === 'CA');
                if (completedSchedules.length > 0) {
                    const latestMaintenanceDate = new Date(Math.max(...completedSchedules.map(s => new Date(s.act_maint_st_date))));
                    dateToConsider = new Date(Math.max(dateToConsider.getTime(), latestMaintenanceDate.getTime()));
                    console.log(`Asset ${asset.asset_id} has completed maintenance, using latest date: ${dateToConsider}`);
                }
                
                // Step 3d: Check tblWFAssetMaintSch_H for status "IN" or "IP"
                const existingWorkflowSchedules = await model.checkExistingWorkflowMaintenanceSchedules(asset.asset_id);
                const inProgressWorkflowSchedules = existingWorkflowSchedules.rows.filter(s => s.status === 'IN' || s.status === 'IP');
                
                if (inProgressWorkflowSchedules.length > 0) {
                    console.log(`Asset ${asset.asset_id} has in-progress workflow schedules, skipping`);
                    skippedAssets++;
                    continue;
                }
                
                // Step 3e & 3f: Check for completed/cancelled workflow schedules and get latest date
                const completedWorkflowSchedules = existingWorkflowSchedules.rows.filter(s => s.status === 'CO' || s.status === 'CA');
                if (completedWorkflowSchedules.length > 0) {
                    const latestWorkflowDate = new Date(Math.max(...completedWorkflowSchedules.map(s => new Date(s.act_sch_date))));
                    dateToConsider = new Date(Math.max(dateToConsider.getTime(), latestWorkflowDate.getTime()));
                    console.log(`Asset ${asset.asset_id} has completed workflow schedules, using latest date: ${dateToConsider}`);
                }
                
                // Process each frequency for this asset
                for (const frequency of frequencies) {
                    console.log(`Processing frequency: ${frequency.frequency} ${frequency.uom} for asset ${asset.asset_id}`);
                    
                    // Calculate planned schedule date: dateToConsider + frequency
                    const plannedScheduleDate = model.calculatePlannedScheduleDate(dateToConsider, frequency.frequency, frequency.uom);
                    console.log(`Asset ${asset.asset_id} purchased on: ${asset.purchased_on}`);
                    console.log(`Date to consider: ${dateToConsider}`);
                    console.log(`Planned schedule date: ${plannedScheduleDate} (dateToConsider + ${frequency.frequency} ${frequency.uom})`);
                    
                    // Step 3g: Check if maintenance is due (schedule 10 days before planned date)
                    const tenDaysBeforePlanned = new Date(plannedScheduleDate);
                    tenDaysBeforePlanned.setDate(tenDaysBeforePlanned.getDate() - 10);
                    
                    const isDue = testDate >= tenDaysBeforePlanned;
                    
                    if (!isDue) {
                        console.log(`Maintenance not due for asset ${asset.asset_id} with frequency ${frequency.frequency} ${frequency.uom}`);
                        console.log(`Test date: ${testDate}, 10 days before planned: ${tenDaysBeforePlanned}, Planned: ${plannedScheduleDate}`);
                        continue;
                    }
                    
                    console.log(`Maintenance is due for asset ${asset.asset_id}, creating schedule...`);
                    console.log(`Test date: ${testDate}, 10 days before planned: ${tenDaysBeforePlanned}, Planned: ${plannedScheduleDate}`);
                    
                    // Step 3h & 3i: Create workflow maintenance schedule header
                    const wfamshId = await model.getNextWFAMSHId();
                    
                    const scheduleHeaderData = {
                        wfamsh_id: wfamshId,
                        at_main_freq_id: frequency.at_main_freq_id,
                        maint_type_id: frequency.maint_type_id,
                        asset_id: asset.asset_id,
                        group_id: null,
                        vendor_id: asset.service_vendor_id,
                        pl_sch_date: plannedScheduleDate,
                        act_sch_date: null,
                        status: 'IN',
                        created_by: 'system',
                        org_id: asset.org_id
                    };
                    
                    const headerResult = await model.insertWorkflowMaintenanceScheduleHeader(scheduleHeaderData);
                    console.log(`Created workflow maintenance schedule header: ${wfamshId}`);
                    
                    // Step 3j: Create workflow maintenance schedule details
                    const workflowSequences = await model.getWorkflowAssetSequences(asset.asset_type_id);
                    
                    console.log(`Found ${workflowSequences.rows.length} workflow sequences for asset type ${asset.asset_type_id}`);
                    
                    if (workflowSequences.rows.length === 0) {
                        console.log(`No workflow sequences found for asset type ${asset.asset_type_id}`);
                        continue;
                    }
                    
                    let totalDetailsCreated = 0;
                    
                    for (const sequence of workflowSequences.rows) {
                        console.log(`Processing sequence ${sequence.seqs_no} with wf_steps_id: ${sequence.wf_steps_id}`);
                        
                        const workflowJobRoles = await model.getWorkflowJobRoles(sequence.wf_steps_id);
                        console.log(`Found ${workflowJobRoles.rows.length} job roles for sequence ${sequence.seqs_no}`);
                        
                        if (workflowJobRoles.rows.length === 0) {
                            console.log(`No job roles found for sequence ${sequence.seqs_no}, skipping...`);
                            continue;
                        }
                        
                        for (const jobRole of workflowJobRoles.rows) {
                            const wfamsdId = await model.getNextWFAMSDId();
                            
                            const scheduleDetailData = {
                                wfamsd_id: wfamsdId,
                                wfamsh_id: wfamshId,
                                job_role_id: jobRole.job_role_id,
                                user_id: null,
                                dept_id: jobRole.dept_id,
                                sequence: sequence.seqs_no, // Use seqs_no (integer) instead of wf_at_seqs_id (string)
                                status: 'IN',
                                notes: null,
                                created_by: 'system',
                                org_id: asset.org_id
                            };
                            
                            await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
                            console.log(`Created workflow maintenance schedule detail: ${wfamsdId} for sequence ${sequence.seqs_no}, job role ${jobRole.job_role_id}, dept ${jobRole.dept_id}`);
                            totalDetailsCreated++;
                        }
                    }
                    
                    console.log(`Total details created for header ${wfamshId}: ${totalDetailsCreated}`);
                    
                    totalSchedulesCreated++;
                }
            }
        }
        
        console.log(`Maintenance schedule generation completed.`);
        console.log(`Total assets processed: ${processedAssets}`);
        console.log(`Assets skipped: ${skippedAssets}`);
        console.log(`Schedules created: ${totalSchedulesCreated}`);
        
        res.status(200).json({
            message: "Maintenance schedules generated successfully",
            asset_types_processed: assetTypes.length,
            assets_processed: processedAssets,
            assets_skipped: skippedAssets,
            schedules_created: totalSchedulesCreated,
            test_date_used: testDate
        });
        
    } catch (error) {
        console.error('Error generating maintenance schedules:', error);
        res.status(500).json({
            error: "Failed to generate maintenance schedules",
            details: error.message
        });
    }
};

// Get maintenance schedules for an asset
const getMaintenanceSchedulesForAsset = async (req, res) => {
    try {
        const { asset_id } = req.params;
        
        // Get workflow maintenance schedules
        const workflowSchedules = await model.checkExistingWorkflowMaintenanceSchedules(asset_id);
        
        // Get regular maintenance schedules
        const maintenanceSchedules = await model.checkExistingMaintenanceSchedules(asset_id);
        
        res.status(200).json({
            asset_id,
            workflow_schedules: workflowSchedules.rows,
            maintenance_schedules: maintenanceSchedules.rows
        });
        
    } catch (error) {
        console.error('Error fetching maintenance schedules:', error);
        res.status(500).json({
            error: "Failed to fetch maintenance schedules",
            details: error.message
        });
    }
};

// Get asset types requiring maintenance
const getAssetTypesRequiringMaintenance = async (req, res) => {
    try {
        const result = await model.getAssetTypesRequiringMaintenance();
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching asset types requiring maintenance:', error);
        res.status(500).json({
            error: "Failed to fetch asset types",
            details: error.message
        });
    }
};

// Get maintenance frequency for asset type
const getMaintenanceFrequencyForAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const result = await model.getMaintenanceFrequency(asset_type_id);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching maintenance frequency:', error);
        res.status(500).json({
            error: "Failed to fetch maintenance frequency",
            details: error.message
        });
    }
};

module.exports = {
    generateMaintenanceSchedules,
    getMaintenanceSchedulesForAsset,
    getAssetTypesRequiringMaintenance,
    getMaintenanceFrequencyForAssetType
}; 