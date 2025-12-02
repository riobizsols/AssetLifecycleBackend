const model = require("../models/maintenanceScheduleModel");

// Import supervisor approval logger
const supervisorApprovalLogger = require('../eventLoggers/supervisorApprovalEventLogger');

const normalizeOrgId = (orgId) => (orgId || '').toString().trim().toUpperCase();

const USAGE_BASED_UOMS = new Set([
    'km',
    'kms',
    'kilometer',
    'kilometers',
    'kilometre',
    'kilometres',
    'mile',
    'miles',
    'mi',
    'hour',
    'hours',
    'hr',
    'hrs'
]);

const parseUsageAssetTypeValue = (rawValue) => {
    if (!rawValue) {
        return [];
    }

    if (Array.isArray(rawValue)) {
        return rawValue;
    }

    if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();

        if (!trimmed) {
            return [];
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (error) {
            // Not a JSON array; fall back to delimiter-based parsing
        }

        return trimmed
            .split(/[,;|\n]/)
            .map(value => value.trim())
            .filter(Boolean);
    }

    return [String(rawValue).trim()].filter(Boolean);
};

// Helper function to process group maintenance
const processGroupMaintenance = async (group_id, assetType, frequencies, testDate) => {
    console.log(`\n=== Processing Group Maintenance for Group: ${group_id} ===`);
    
    // Get all assets in the group
    const groupAssetsResult = await model.getAssetsByGroupId(group_id);
    const groupAssets = groupAssetsResult.rows;
    
    if (groupAssets.length === 0) {
        console.log(`No assets found in group ${group_id}`);
        return { schedulesCreated: 0, skipped: true };
    }
    
    console.log(`Found ${groupAssets.length} assets in group ${group_id}`);
    
    // Get representative asset info (first asset for org_id, branch_code, etc.)
    const representativeAsset = groupAssets[0];
    
    // Check for in-progress group maintenance
    const existingGroupWorkflowSchedules = await model.checkExistingWorkflowMaintenanceSchedulesForGroup(group_id);
    const inProgressGroupSchedules = existingGroupWorkflowSchedules.rows.filter(s => s.status === 'IN' || s.status === 'IP');
    
    if (inProgressGroupSchedules.length > 0) {
        console.log(`Group ${group_id} has in-progress maintenance schedules, skipping`);
        return { schedulesCreated: 0, skipped: true };
    }
    
    // Determine date to consider for maintenance
    let dateToConsider = null;
    
    // Check if this is first maintenance (no completed schedules)
    const completedGroupSchedules = existingGroupWorkflowSchedules.rows.filter(s => s.status === 'CO' || s.status === 'CA');
    const completedDirectSchedules = await model.checkExistingMaintenanceSchedulesForGroup(group_id);
    const completedDirectGroupSchedules = completedDirectSchedules.rows.filter(s => s.status === 'CO' || s.status === 'CA');
    
    if (completedGroupSchedules.length === 0 && completedDirectGroupSchedules.length === 0) {
        // First maintenance: use earliest purchase date
        const earliestPurchaseDate = await model.getEarliestPurchaseDateForGroup(group_id);
        if (earliestPurchaseDate) {
            dateToConsider = new Date(earliestPurchaseDate);
            console.log(`First maintenance for group ${group_id}: Using earliest purchase date: ${dateToConsider}`);
        } else {
            console.log(`No purchase date found for group ${group_id}, skipping`);
            return { schedulesCreated: 0, skipped: true };
        }
    } else {
        // Subsequent maintenance: use latest maintenance date
        const latestMaintenanceDate = await model.getLatestMaintenanceDateForGroup(group_id);
        
        // Also check workflow schedules
        let latestWorkflowDate = null;
        if (completedGroupSchedules.length > 0) {
            latestWorkflowDate = new Date(Math.max(...completedGroupSchedules.map(s => new Date(s.act_sch_date || s.pl_sch_date))));
        }
        
        // Use the latest of all dates
        const datesToCompare = [];
        if (latestMaintenanceDate) datesToCompare.push(new Date(latestMaintenanceDate));
        if (latestWorkflowDate) datesToCompare.push(latestWorkflowDate);
        
        // Also check earliest purchase date as fallback
        const earliestPurchaseDate = await model.getEarliestPurchaseDateForGroup(group_id);
        if (earliestPurchaseDate) datesToCompare.push(new Date(earliestPurchaseDate));
        
        if (datesToCompare.length > 0) {
            dateToConsider = new Date(Math.max(...datesToCompare.map(d => d.getTime())));
            console.log(`Subsequent maintenance for group ${group_id}: Using latest maintenance date: ${dateToConsider}`);
        } else {
            const earliestPurchaseDate = await model.getEarliestPurchaseDateForGroup(group_id);
            if (earliestPurchaseDate) {
                dateToConsider = new Date(earliestPurchaseDate);
                console.log(`No previous maintenance found, using earliest purchase date: ${dateToConsider}`);
            } else {
                console.log(`No date found for group ${group_id}, skipping`);
                return { schedulesCreated: 0, skipped: true };
            }
        }
    }
    
    let schedulesCreated = 0;
    
    // Process each frequency for the group
    for (const frequency of frequencies) {
        console.log(`Processing frequency: ${frequency.frequency} ${frequency.uom} for group ${group_id}`);
        
        // Calculate planned schedule date: dateToConsider + frequency
        const plannedScheduleDate = model.calculatePlannedScheduleDate(dateToConsider, frequency.frequency, frequency.uom);
        console.log(`Group ${group_id} - Date to consider: ${dateToConsider}`);
        console.log(`Group ${group_id} - Planned schedule date: ${plannedScheduleDate}`);
        
        // Check if maintenance is due (schedule 10 days before planned date)
        const tenDaysBeforePlanned = new Date(plannedScheduleDate);
        tenDaysBeforePlanned.setDate(tenDaysBeforePlanned.getDate() - 10);
        
        const isDue = testDate >= tenDaysBeforePlanned;
        
        if (!isDue) {
            console.log(`Maintenance not due for group ${group_id} with frequency ${frequency.frequency} ${frequency.uom}`);
            continue;
        }
        
        console.log(`Maintenance is due for group ${group_id}, creating schedule...`);
        
        // Create workflow maintenance schedule header for the GROUP
        const wfamshId = await model.getNextWFAMSHId();
        
        // Use first asset's ID as representative (or could be null for pure group maintenance)
        const scheduleHeaderData = {
            wfamsh_id: wfamshId,
            at_main_freq_id: frequency.at_main_freq_id,
            maint_type_id: frequency.maint_type_id,
            asset_id: groupAssets[0].asset_id, // Representative asset
            group_id: group_id, // Set group_id instead of null
            vendor_id: representativeAsset.service_vendor_id,
            pl_sch_date: plannedScheduleDate,
            act_sch_date: null,
            status: 'IN',
            created_by: 'system',
            org_id: representativeAsset.org_id,
            branch_code: representativeAsset.branch_code
        };
        
        const headerResult = await model.insertWorkflowMaintenanceScheduleHeader(scheduleHeaderData);
        console.log(`Created workflow maintenance schedule header for GROUP ${group_id}: ${wfamshId}`);
        
        // Create workflow maintenance schedule details
        const workflowSequences = await model.getWorkflowAssetSequences(assetType.asset_type_id);
        
        if (workflowSequences.rows.length === 0) {
            console.log(`No workflow sequences found for asset type ${assetType.asset_type_id}`);
            continue;
        }
        
        let totalDetailsCreated = 0;
        
        for (const sequence of workflowSequences.rows) {
            const workflowJobRoles = await model.getWorkflowJobRoles(sequence.wf_steps_id);
            
            if (workflowJobRoles.rows.length === 0) {
                continue;
            }
            
            for (const jobRole of workflowJobRoles.rows) {
                const wfamsdId = await model.getNextWFAMSDId();
                
                const seqNo = parseInt(sequence.seqs_no);
                const status = seqNo === 10 ? 'AP' : 'IN';
                
                const scheduleDetailData = {
                    wfamsd_id: wfamsdId,
                    wfamsh_id: wfamshId,
                    job_role_id: jobRole.job_role_id,
                    user_id: jobRole.emp_int_id,
                    dept_id: jobRole.dept_id,
                    sequence: sequence.seqs_no,
                    status: status,
                    notes: `Group maintenance for ${groupAssets.length} assets`,
                    created_by: 'system',
                    org_id: representativeAsset.org_id
                };
                
                await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
                totalDetailsCreated++;
            }
        }
        
        console.log(`Total details created for group ${group_id} header ${wfamshId}: ${totalDetailsCreated}`);
        schedulesCreated++;
    }
    
    return { schedulesCreated, skipped: false, assetIds: groupAssets.map(a => a.asset_id) };
};

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
        
        // Fetch usage-based maintenance configurations
        const usageSettingsResult = await model.getUsageBasedMaintenanceSettings();
        const usageSettingsByOrg = {};

        if (usageSettingsResult?.rows?.length) {
            for (const setting of usageSettingsResult.rows) {
                const orgId = normalizeOrgId(setting.org_id);
                if (!orgId) {
                    continue;
                }

                if (!usageSettingsByOrg[orgId]) {
                    usageSettingsByOrg[orgId] = {
                        assetTypeLeadTimes: {},
                        legacyAssetTypeIds: new Set(),
                        defaultLeadTime: 0
                    };
                }

                const rawKey = (setting.key || '').toString().trim();
                if (!rawKey) {
                    continue;
                }

                const upperKey = rawKey.toUpperCase();

                if (upperKey === 'AT_ID_USAGE_BASED') {
                    const assetTypeValues = parseUsageAssetTypeValue(setting.value);
                    assetTypeValues
                        .map(value => value.toUpperCase())
                        .forEach(value => usageSettingsByOrg[orgId].legacyAssetTypeIds.add(value));
                    continue;
                }

                if (upperKey === 'AT_UB_LEAD_TIME') {
                    const leadTimeValue = Number(setting.value);
                    if (!Number.isNaN(leadTimeValue)) {
                        usageSettingsByOrg[orgId].defaultLeadTime = leadTimeValue;
                    }
                    continue;
                }

                // New-format configuration: key holds the asset type id, value holds the lead time
                const leadTimeValue = Number(setting.value);
                if (Number.isNaN(leadTimeValue)) {
                    console.warn(`Usage-based maintenance: lead time for asset type key ${rawKey} is not numeric (${setting.value}), skipping.`);
                    continue;
                }

                usageSettingsByOrg[orgId].assetTypeLeadTimes[upperKey] = leadTimeValue;
            }
        }
        
        if (assetTypes.length === 0) {
            return res.status(200).json({
                message: "No asset types found that require maintenance",
                schedules_created: 0
            });
        }
        
        let totalSchedulesCreated = 0;
        let processedAssets = 0;
        let skippedAssets = 0;
        let groupSchedulesCreated = 0;
        let processedGroups = 0;
        
        // Track assets that are in groups to skip them in individual processing
        const assetsInGroups = new Set();
        
        // Process each asset type
        for (const assetType of assetTypes) {
            console.log(`Processing asset type: ${assetType.asset_type_id} - ${assetType.text}`);
            
            // Step 2b: Get maintenance frequency for this asset type
            const frequencyResult = await model.getMaintenanceFrequency(assetType.asset_type_id);
            const frequencies = frequencyResult.rows;
            
            if (frequencies.length === 0) {
                console.log(`No maintenance frequency found for asset type ${assetType.asset_type_id}`);
                continue;
            }
            
            const assetTypeOrgId = normalizeOrgId(assetType.org_id);
            const usageSettingsForOrg = usageSettingsByOrg[assetTypeOrgId] || {
                assetTypeLeadTimes: {},
                legacyAssetTypeIds: new Set(),
                defaultLeadTime: 0
            };
            const assetTypeIdUpper = (assetType.asset_type_id || '').toUpperCase();
            const assetTypeLeadTimes = usageSettingsForOrg.assetTypeLeadTimes || {};
            const hasExplicitLeadTime = Object.prototype.hasOwnProperty.call(assetTypeLeadTimes, assetTypeIdUpper);
            const legacyConfigured = usageSettingsForOrg.legacyAssetTypeIds?.has(assetTypeIdUpper);
            const isUsageBasedAssetType = hasExplicitLeadTime || legacyConfigured;
            const assetTypeUsageLeadTime = hasExplicitLeadTime
                ? Number(assetTypeLeadTimes[assetTypeIdUpper])
                : Number(usageSettingsForOrg.defaultLeadTime) || 0;
            
            if (isUsageBasedAssetType) {
                console.log(`Asset type ${assetType.asset_type_id} configured for usage-based maintenance with lead time ${assetTypeUsageLeadTime}`);
            }
            
            // Step 2a: Get groups for this asset type FIRST
            const groupsResult = await model.getGroupsByAssetType(assetType.asset_type_id);
            const groups = groupsResult.rows;
            
            console.log(`Found ${groups.length} groups for asset type ${assetType.asset_type_id}`);
            
            if (isUsageBasedAssetType) {
                if (groups.length > 0) {
                    console.log(`Skipping group maintenance generation for usage-based asset type ${assetType.asset_type_id}`);
                }
            } else {
                // Process groups first
                for (const group of groups) {
                    if (!group.group_id) continue;
                    
                    processedGroups++;
                    console.log(`\nProcessing group ${group.group_id} with ${group.asset_count} assets`);
                    
                    const groupResult = await processGroupMaintenance(
                        group.group_id,
                        assetType,
                        frequencies,
                        testDate
                    );
                    
                    if (!groupResult.skipped) {
                        groupSchedulesCreated += groupResult.schedulesCreated;
                        totalSchedulesCreated += groupResult.schedulesCreated;
                        
                        // Track assets in this group to skip them later
                        if (groupResult.assetIds) {
                            groupResult.assetIds.forEach(assetId => assetsInGroups.add(assetId));
                        }
                    }
                }
            }
            
            // Step 2c: Get assets for this asset type (for individual processing)
            const assetsResult = await model.getAssetsByAssetType(assetType.asset_type_id);
            const assets = assetsResult.rows;
            
            console.log(`Found ${assets.length} total assets for asset type ${assetType.asset_type_id}`);
            
            if (assets.length === 0) {
                console.log(`No assets found for asset type ${assetType.asset_type_id}`);
                continue;
            }
            
            // Process each asset (skip those in groups)
            for (const asset of assets) {
                // Skip assets that are in groups (already processed)
                if (assetsInGroups.has(asset.asset_id) || (!isUsageBasedAssetType && asset.group_id)) {
                    console.log(`Skipping asset ${asset.asset_id} - already processed as part of a group`);
                    continue;
                }
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
                    
                    const frequencyUom = (frequency.uom || '').toString().toLowerCase();
                    const frequencyValue = Number(frequency.frequency);
                    const isUsageBasedFrequency = isUsageBasedAssetType && USAGE_BASED_UOMS.has(frequencyUom);
                    
                    let shouldCreateSchedule = false;
                    let plannedScheduleDate = null;
                    let triggerContext = '';
                    
                    if (isUsageBasedFrequency) {
                        if (!Number.isFinite(frequencyValue) || frequencyValue <= 0) {
                            console.log(`Invalid usage frequency value (${frequency.frequency}) for asset ${asset.asset_id}, skipping.`);
                            continue;
                        }
                        
                        const threshold = Math.max(frequencyValue - assetTypeUsageLeadTime, 0);
                        const totalUsage = await model.getAssetUsageSinceDate(asset.asset_id, dateToConsider);
                        
                        console.log(`Usage check → Asset ${asset.asset_id}: total usage since ${dateToConsider.toISOString()} is ${totalUsage} ${frequency.uom}. Threshold: ${threshold} ${frequency.uom} (frequency ${frequencyValue}, lead time ${assetTypeUsageLeadTime}).`);
                        
                        if (totalUsage >= threshold) {
                            shouldCreateSchedule = true;
                            plannedScheduleDate = new Date(testDate);
                            triggerContext = `usage threshold met (${totalUsage}/${frequencyValue} ${frequency.uom}, lead time ${assetTypeUsageLeadTime})`;
                        } else {
                            console.log(`Usage below threshold for asset ${asset.asset_id}. Current: ${totalUsage} ${frequency.uom}, threshold: ${threshold}. Skipping.`);
                            continue;
                        }
                    } else {
                        plannedScheduleDate = model.calculatePlannedScheduleDate(dateToConsider, frequency.frequency, frequency.uom);
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
                        
                        shouldCreateSchedule = true;
                        triggerContext = `time-based schedule (planned ${plannedScheduleDate.toISOString()}, window opened ${tenDaysBeforePlanned.toISOString()})`;
                        
                        console.log(`Maintenance is due for asset ${asset.asset_id}, creating schedule...`);
                        console.log(`Test date: ${testDate}, 10 days before planned: ${tenDaysBeforePlanned}, Planned: ${plannedScheduleDate}`);
                    }
                    
                    if (!shouldCreateSchedule || !plannedScheduleDate) {
                        continue;
                    }
                    
                    console.log(`Creating maintenance schedule for asset ${asset.asset_id} - trigger: ${triggerContext}`);
                    
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
                        org_id: asset.org_id,
                        branch_code: asset.branch_code
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
                            
                            // Set status based on sequence number
                            const seqNo = parseInt(sequence.seqs_no);
                            const status = seqNo === 10 ? 'AP' : 'IN';
                            
                            console.log(`Sequence number: ${sequence.seqs_no} (type: ${typeof sequence.seqs_no}), parsed: ${seqNo}, status: ${status}`);
                            
                            const scheduleDetailData = {
                                wfamsd_id: wfamsdId,
                                wfamsh_id: wfamshId,
                                job_role_id: jobRole.job_role_id,
                                user_id: jobRole.emp_int_id, // Use emp_int_id from tblWFJobRole
                                dept_id: jobRole.dept_id,
                                sequence: sequence.seqs_no, // Use seqs_no (integer) instead of wf_at_seqs_id (string)
                                status: status, // 'AP' for sequence 10, 'IN' for others
                                notes: null,
                                created_by: 'system',
                                org_id: asset.org_id
                            };
                            
                            await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
                            console.log(`Created workflow maintenance schedule detail: ${wfamsdId} for sequence ${sequence.seqs_no}, job role ${jobRole.job_role_id}, dept ${jobRole.dept_id}, user ${jobRole.emp_int_id}, status: ${status}`);
                            totalDetailsCreated++;
                        }
                    }
                    
                    console.log(`Total details created for header ${wfamshId}: ${totalDetailsCreated}`);
                    
                    totalSchedulesCreated++;
                }
            }
        }
        
        console.log(`Maintenance schedule generation completed.`);
        console.log(`Groups processed: ${processedGroups}`);
        console.log(`Group schedules created: ${groupSchedulesCreated}`);
        console.log(`Total assets processed: ${processedAssets}`);
        console.log(`Assets skipped: ${skippedAssets}`);
        console.log(`Total schedules created: ${totalSchedulesCreated}`);
        
        res.status(200).json({
            message: "Maintenance schedules generated successfully",
            asset_types_processed: assetTypes.length,
            groups_processed: processedGroups,
            group_schedules_created: groupSchedulesCreated,
            assets_processed: processedAssets,
            assets_skipped: skippedAssets,
            schedules_created: totalSchedulesCreated,
            test_date_used: testDate
        });
        
    } catch (error) {
        console.error('❌ Error generating maintenance schedules:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code,
            ...(error.query && { query: error.query }),
            ...(error.parameters && { parameters: error.parameters })
        });
        
        res.status(500).json({
            error: "Failed to generate maintenance schedules",
            message: error.message,
            details: error.message,
            name: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            ...(error.query && { query: error.query }),
            ...(error.parameters && { parameters: error.parameters })
        });
    }
};

// Generate maintenance schedules with workflow bypass logic
const generateMaintenanceSchedulesWithWorkflowBypass = async (req, res) => {
    try {
        console.log('Starting maintenance schedule generation with workflow bypass...');
        
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
                schedules_created: 0,
                workflow_schedules: 0,
                direct_schedules: 0
            });
        }
        
        let totalSchedulesCreated = 0;
        let workflowSchedulesCreated = 0;
        let directSchedulesCreated = 0;
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
            
            // Step 2c: Check if this asset type requires workflow
            const requiresWorkflow = await model.checkAssetTypeWorkflow(assetType.asset_type_id);
            console.log(`Asset type ${assetType.asset_type_id} requires workflow: ${requiresWorkflow}`);
            
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
                
                // Step 3d: Check tblWFAssetMaintSch_H for status "IN" or "IP" (only if workflow is required)
                if (requiresWorkflow) {
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
                    
                    if (requiresWorkflow) {
                        // Create workflow maintenance schedule (existing logic)
                        console.log(`Asset type ${asset.asset_type_id} requires workflow, creating workflow schedule`);
                        
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
                            org_id: asset.org_id,
                            branch_code: asset.branch_code
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
                                
                                // Set status based on sequence number
                                const seqNo = parseInt(sequence.seqs_no);
                                const status = seqNo === 10 ? 'AP' : 'IN';
                                
                                console.log(`Sequence number: ${sequence.seqs_no} (type: ${typeof sequence.seqs_no}), parsed: ${seqNo}, status: ${status}`);
                                
                                // ROLE-BASED WORKFLOW: Store only job_role_id, not user_id
                                // This allows all users with this role to receive notifications and approve
                                const scheduleDetailData = {
                                    wfamsd_id: wfamsdId,
                                    wfamsh_id: wfamshId,
                                    job_role_id: jobRole.job_role_id,
                                    user_id: null, // Changed: No specific user, role-based instead
                                    dept_id: jobRole.dept_id,
                                    sequence: sequence.seqs_no, // Use seqs_no (integer) instead of wf_at_seqs_id (string)
                                    status: status, // 'AP' for sequence 10, 'IN' for others
                                    notes: null,
                                    created_by: 'system',
                                    org_id: asset.org_id
                                };
                                
                                await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
                                console.log(`Created workflow maintenance schedule detail (ROLE-BASED): ${wfamsdId} for sequence ${sequence.seqs_no}, job role ${jobRole.job_role_id}, dept ${jobRole.dept_id}, status: ${status}`);
                                totalDetailsCreated++;
                            }
                        }
                        
                        console.log(`Total details created for header ${wfamshId}: ${totalDetailsCreated}`);
                        workflowSchedulesCreated++;
                        
                    } else {
                        // Create direct maintenance schedule (bypassing workflow)
                        console.log(`Asset type ${asset.asset_type_id} does not require workflow, creating direct maintenance schedule`);
                        
                        const amsId = await model.getNextAMSId();
                        
                        const directScheduleData = {
                            ams_id: amsId,
                            asset_id: asset.asset_id,
                            maint_type_id: frequency.maint_type_id,
                            vendor_id: asset.service_vendor_id,
                            at_main_freq_id: frequency.at_main_freq_id,
                            maintained_by: null, // Will be set when maintenance is performed
                            notes: null, // Will be set when maintenance is performed
                            status: 'IN', // Initial status for direct maintenance
                            act_maint_st_date: plannedScheduleDate,
                            created_by: 'system',
                            org_id: asset.org_id
                        };
                        
                        await model.insertDirectMaintenanceSchedule(directScheduleData);
                        console.log(`Created direct maintenance schedule: ${amsId} for asset ${asset.asset_id}`);
                        directSchedulesCreated++;
                    }
                    
                    totalSchedulesCreated++;
                }
            }
        }
        
        console.log(`Maintenance schedule generation with workflow bypass completed.`);
        console.log(`Total assets processed: ${processedAssets}`);
        console.log(`Assets skipped: ${skippedAssets}`);
        console.log(`Total schedules created: ${totalSchedulesCreated}`);
        console.log(`Workflow schedules created: ${workflowSchedulesCreated}`);
        console.log(`Direct schedules created: ${directSchedulesCreated}`);
        
        res.status(200).json({
            message: "Maintenance schedules generated successfully with workflow bypass logic",
            asset_types_processed: assetTypes.length,
            assets_processed: processedAssets,
            assets_skipped: skippedAssets,
            total_schedules_created: totalSchedulesCreated,
            workflow_schedules_created: workflowSchedulesCreated,
            direct_schedules_created: directSchedulesCreated,
            test_date_used: testDate
        });
        
    } catch (error) {
        console.error('Error generating maintenance schedules with workflow bypass:', error);
        res.status(500).json({
            error: "Failed to generate maintenance schedules with workflow bypass",
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

// Get all maintenance schedules from tblAssetMaintSch
const getAllMaintenanceSchedules = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const orgId = req.query.orgId || req.user?.org_id || 'ORG001';
        const branchId = req.user?.branch_id;
        const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL
        
        console.log('=== Maintenance Schedule Controller Debug ===');
        console.log('org_id from req.user:', orgId);
        console.log('branch_id from req.user:', branchId);
        
        // Log API called (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logSupervisorApprovalListApiCalled({
                method: req.method,
                url: req.originalUrl,
                userId
            }).catch(err => console.error('Logging error:', err));
        }
        
        const result = await model.getAllMaintenanceSchedules(orgId, branchId);
        
        // Format the data for frontend - include all columns from tblAssetMaintSch plus joined data
        const formattedData = result.rows.map(record => {
            // Get all columns from tblAssetMaintSch
            const baseRecord = {};
            Object.keys(record).forEach(key => {
                if (!['asset_type_id', 'serial_number', 'asset_description', 'asset_type_name', 'maintenance_type_name', 'vendor_name', 'days_until_due'].includes(key)) {
                    baseRecord[key] = record[key];
                }
            });
            
            // Add joined data
            return {
                ...baseRecord,
                asset_type_id: record.asset_type_id,
                serial_number: record.serial_number,
                asset_description: record.asset_description,
                asset_type_name: record.asset_type_name,
                maintenance_type_name: record.maintenance_type_name,
                vendor_name: record.vendor_name,
                days_until_due: record.days_until_due
            };
        });

        // Log success (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logSupervisorApprovalsRetrieved({
                count: formattedData.length,
                empIntId: userId, // Using userId as empIntId for now
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }

        res.json({
            success: true,
            message: 'Maintenance schedules retrieved successfully',
            data: formattedData,
            count: formattedData.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getAllMaintenanceSchedules:', error);
        
        const { context } = req.query;
        
        // Log error (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logDataRetrievalError({
                operation: 'Get Supervisor Approval List',
                error,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance schedules',
            error: error.message
        });
    }
};

// Get maintenance schedule details by ID from tblAssetMaintSch
const getMaintenanceScheduleById = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
        const orgId = req.query.orgId || req.user?.org_id || 'ORG001';
        const branchId = req.user?.branch_id;
        const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL
        
        console.log('=== Maintenance Schedule Detail Controller Debug ===');
        console.log('org_id from req.user:', orgId);
        console.log('branch_id from req.user:', branchId);
        console.log('ams_id:', id);
        
        // Log API called (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logSupervisorApprovalDetailApiCalled({
                method: req.method,
                url: req.originalUrl,
                wfamshId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
        }
        
        if (!id) {
            if (context === 'SUPERVISORAPPROVAL') {
                supervisorApprovalLogger.logMissingRequiredFields({
                    operation: 'Get Supervisor Approval Detail',
                    missingFields: ['id'],
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
            }
            
            return res.status(400).json({
                success: false,
                message: 'Maintenance schedule ID is required'
            });
        }
        
        const result = await model.getMaintenanceScheduleById(id, orgId, branchId);
        
        if (result.rows.length === 0) {
            if (context === 'SUPERVISORAPPROVAL') {
                supervisorApprovalLogger.logApprovalNotFound({
                    wfamshId: id,
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
            }
            
            return res.status(404).json({
                success: false,
                message: 'Maintenance schedule not found'
            });
        }
        
        const record = result.rows[0];
        
        // Format the data for frontend - include all columns from tblAssetMaintSch
        const formattedData = { ...record };

        // Log success (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logSupervisorApprovalDetailRetrieved({
                wfamshId: id,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }

        res.json({
            success: true,
            message: 'Maintenance schedule details retrieved successfully',
            data: formattedData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in getMaintenanceScheduleById:', error);
        
        const { context } = req.query;
        
        // Log error (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logDataRetrievalError({
                operation: 'Get Supervisor Approval Detail',
                error,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve maintenance schedule details',
            error: error.message
        });
    }
};

// Update maintenance schedule in tblAssetMaintSch
const updateMaintenanceSchedule = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
            const orgId = req.query.orgId || req.user?.org_id;
        const updateData = req.body;
        const { context } = req.query; // SUPERVISORAPPROVAL or default to MAINTENANCEAPPROVAL
        const changedBy = req.user ? req.user.user_id : 'system'; // Get user from token
        const changedOn = new Date(); // Set changed_on to current timestamp

        // Log API called (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logMaintenanceUpdateApiCalled({
                method: req.method,
                url: req.originalUrl,
                wfamshId: id,
                updateData,
                userId
            }).catch(err => console.error('Logging error:', err));
        }

        if (!id) {
            if (context === 'SUPERVISORAPPROVAL') {
                supervisorApprovalLogger.logMissingRequiredFields({
                    operation: 'Update Supervisor Maintenance',
                    missingFields: ['id'],
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
            }
            return res.status(400).json({ success: false, message: 'Maintenance schedule ID is required' });
        }
        if (!updateData.status) {
            if (context === 'SUPERVISORAPPROVAL') {
                supervisorApprovalLogger.logMissingRequiredFields({
                    operation: 'Update Supervisor Maintenance',
                    missingFields: ['status'],
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
            }
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const result = await model.updateMaintenanceSchedule(id, { ...updateData, changed_by: changedBy, changed_on: changedOn }, orgId);

        if (result.rows.length === 0) {
            if (context === 'SUPERVISORAPPROVAL') {
                supervisorApprovalLogger.logApprovalNotFound({
                    wfamshId: id,
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
            }
            return res.status(404).json({ success: false, message: 'Maintenance schedule not found or not updated' });
        }

        // Log success (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logMaintenanceUpdated({
                wfamshId: id,
                updateFields: Object.keys(updateData),
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }

        res.status(200).json({ success: true, message: 'Maintenance schedule updated successfully', data: result.rows[0] });
    } catch (error) {
        console.error('Error in updateMaintenanceSchedule:', error);
        
        const { context } = req.query;
        
        // Log error (context-aware)
        if (context === 'SUPERVISORAPPROVAL') {
            supervisorApprovalLogger.logMaintenanceUpdateError({
                wfamshId: req.params.id,
                updateData: req.body,
                error,
                userId,
                duration: Date.now() - startTime
            }).catch(err => console.error('Logging error:', err));
        }
        res.status(500).json({ success: false, message: 'Failed to update maintenance schedule', error: error.message });
    }
};

module.exports = {
    generateMaintenanceSchedules,
    generateMaintenanceSchedulesWithWorkflowBypass,
    getMaintenanceSchedulesForAsset,
    getAssetTypesRequiringMaintenance,
    getMaintenanceFrequencyForAssetType,
    getAllMaintenanceSchedules,
    getMaintenanceScheduleById,
    updateMaintenanceSchedule
}; 