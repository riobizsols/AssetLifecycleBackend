const inspectionModel = require("../models/inspectionScheduleModel");

/**
 * Inspection Schedule Controller
 * Main logic for generating inspection schedules via cron or manual trigger
 */

/**
 * Main function: Generate inspection schedules
 * Can be called by cron or manual endpoint
 */
const generateInspectionSchedules = async (req, res) => {
  const startTime = Date.now();
  const results = {
    success: true,
    message: "Inspection schedule generation started",
    stats: {
      assetTypesProcessed: 0,
      assetsProcessed: 0,
      groupsProcessed: 0,
      inspectionsCreated: 0,
      inspectionsSkipped: 0,
      errors: []
    },
    details: []
  };

  try {
    // Get organization ID from request or default
    const org_id = req.body.org_id || req.user?.org_id || 1;
    
    console.log(`\n🔍 [INSPECTION CRON] Starting inspection generation for org_id: ${org_id}`);
    console.log(`⏰ [INSPECTION CRON] Timestamp: ${new Date().toISOString()}`);

    // Step 1: Get all asset types requiring inspection
    const assetTypesResult = await inspectionModel.getAssetTypesRequiringInspection(org_id);
    const assetTypes = assetTypesResult.rows;

    if (assetTypes.length === 0) {
      console.log("⚠️  [INSPECTION CRON] No asset types require inspection");
      results.message = "No asset types require inspection";
      
      if (res) {
        return res.status(200).json(results);
      }
      return results;
    }

    console.log(`📋 [INSPECTION CRON] Found ${assetTypes.length} asset types requiring inspection`);

    // Step 2: Process each asset type
    for (const assetType of assetTypes) {
      try {
        results.stats.assetTypesProcessed++;
        
        console.log(`\n📦 [INSPECTION CRON] Processing: ${assetType.asset_type_name} (ID: ${assetType.asset_type_id})`);

        // Get inspection frequency configuration
        const frequencyResult = await inspectionModel.getInspectionFrequency(
          assetType.asset_type_id,
          org_id
        );

        if (frequencyResult.rows.length === 0) {
          console.log(`  ⚠️  No inspection frequency configured - SKIPPING`);
          results.stats.inspectionsSkipped++;
          continue;
        }

        const frequency = frequencyResult.rows[0];
        console.log(`  ⏱️  Frequency: ${frequency.frequency} ${frequency.uom}`);
        console.log(`  📅 Lead time: ${frequency.insp_lead_time || 10} days`);

        // Check if workflow exists for this asset type
        const workflowResult = await inspectionModel.checkWorkflowExists(
          assetType.asset_type_id,
          org_id
        );
        const workflowSequences = workflowResult.rows;
        const hasWorkflow = workflowSequences.length > 0;

        console.log(`  🔄 Workflow: ${hasWorkflow ? 'YES (' + workflowSequences.length + ' levels)' : 'NO (direct schedule)'}`);

        // Process individual assets (not in groups)
        const assetsResult = await inspectionModel.getAssetsByAssetType(
          assetType.asset_type_id,
          org_id
        );
        const assets = assetsResult.rows;

        console.log(`  🔧 Individual assets: ${assets.length}`);

        for (const asset of assets) {
          try {
            await processAssetInspection(
              asset,
              frequency,
              workflowSequences,
              hasWorkflow,
              org_id,
              results
            );
            results.stats.assetsProcessed++;
          } catch (error) {
            console.error(`  ❌ Error processing asset ${asset.asset_id}:`);
            console.error(`     Message: ${error.message}`);
            console.error(`     Code: ${error.code}`);
            console.error(`     Detail: ${error.detail}`);
            console.error(`     Hint: ${error.hint}`);
            results.stats.errors.push({
              asset_id: asset.asset_id,
              error: error.message
            });
          }
        }

        // Process asset groups
        const groupsResult = await inspectionModel.getGroupsByAssetType(
          assetType.asset_type_id,
          org_id
        );
        const groups = groupsResult.rows;

        if (groups.length > 0) {
          console.log(`  📦 Asset groups: ${groups.length}`);

          for (const group of groups) {
            try {
              await processGroupInspection(
                group,
                frequency,
                workflowSequences,
                hasWorkflow,
                org_id,
                results
              );
              results.stats.groupsProcessed++;
            } catch (error) {
              console.error(`  ❌ Error processing group ${group.group_id}:`, error.message);
              results.stats.errors.push({
                group_id: group.group_id,
                error: error.message
              });
            }
          }
        }

      } catch (error) {
        console.error(`❌ [INSPECTION CRON] Error processing asset type ${assetType.asset_type_name}:`, error);
        results.stats.errors.push({
          asset_type: assetType.asset_type_name,
          error: error.message
        });
      }
    }

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ [INSPECTION CRON] Completed in ${duration}s`);
    console.log(`📊 [INSPECTION CRON] Summary:`);
    console.log(`   - Asset Types: ${results.stats.assetTypesProcessed}`);
    console.log(`   - Assets: ${results.stats.assetsProcessed}`);
    console.log(`   - Groups: ${results.stats.groupsProcessed}`);
    console.log(`   - Inspections Created: ${results.stats.inspectionsCreated}`);
    console.log(`   - Inspections Skipped: ${results.stats.inspectionsSkipped}`);
    console.log(`   - Errors: ${results.stats.errors.length}`);

    results.message = `Inspection generation completed. Created: ${results.stats.inspectionsCreated}, Skipped: ${results.stats.inspectionsSkipped}`;
    results.duration_seconds = parseFloat(duration);

    if (res) {
      return res.status(200).json(results);
    }
    return results;

  } catch (error) {
    console.error("❌ [INSPECTION CRON] Fatal error:", error);
    results.success = false;
    results.message = `Fatal error: ${error.message}`;
    results.error = error.message;

    if (res) {
      return res.status(500).json(results);
    }
    return results;
  }
};

/**
 * Process inspection for a single asset
 */
const processAssetInspection = async (
  asset,
  frequency,
  workflowSequences,
  hasWorkflow,
  org_id,
  results
) => {
  // Check for existing in-progress inspection
  const existingWorkflow = await inspectionModel.checkExistingWorkflowInspection(
    asset.asset_id,
    org_id
  );

  if (existingWorkflow.rows.length > 0) {
    console.log(`    ⏭️  Asset ${asset.asset_id} - Already has in-progress inspection (${existingWorkflow.rows[0].status})`);
    results.stats.inspectionsSkipped++;
    return;
  }

  const existingDirect = await inspectionModel.checkExistingDirectInspection(
    asset.asset_id,
    org_id
  );

  if (existingDirect.rows.length > 0) {
    console.log(`    ⏭️  Asset ${asset.asset_id} - Already has in-progress inspection (${existingDirect.rows[0].status})`);
    results.stats.inspectionsSkipped++;
    return;
  }

  // Get last completed inspection date
  const lastInspectionDate = await inspectionModel.getLastCompletedInspectionDate(
    asset.asset_id,
    org_id
  );

  // Determine base date for calculation
  const baseDate = lastInspectionDate || asset.purchased_on;
  
  if (!baseDate) {
    console.log(`    ⚠️  Asset ${asset.asset_id} - No purchase date or last inspection date`);
    results.stats.inspectionsSkipped++;
    return;
  }

  // Calculate next inspection date
  const nextInspectionDate = inspectionModel.calculateNextInspectionDate(
    baseDate,
    frequency.frequency,
    frequency.uom
  );

  // Apply lead time (default 10 days)
  const leadTime = frequency.insp_lead_time || 10;
  const createDate = new Date(nextInspectionDate);
  createDate.setDate(createDate.getDate() - leadTime);

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight

  if (today < createDate) {
    console.log(`    ⏰ Asset ${asset.asset_id} - Not yet due (create on: ${createDate.toISOString().split('T')[0]})`);
    results.stats.inspectionsSkipped++;
    return;
  }

  console.log(`    ✅ Asset ${asset.asset_id} - DUE for inspection`);
  console.log(`       Last: ${baseDate ? new Date(baseDate).toISOString().split('T')[0] : 'Never'}`);
  console.log(`       Next: ${nextInspectionDate.toISOString().split('T')[0]}`);

  // CREATE INSPECTION
  if (hasWorkflow) {
    await createWorkflowInspection(
      asset,
      frequency,
      workflowSequences,
      nextInspectionDate,
      org_id
    );
    console.log(`       ✨ Created WORKFLOW inspection`);
  } else {
    await createDirectInspection(
      asset,
      frequency,
      nextInspectionDate,
      org_id
    );
    console.log(`       ✨ Created DIRECT inspection`);
  }

  results.stats.inspectionsCreated++;
  results.details.push({
    asset_id: asset.asset_id,
    scheduled_date: nextInspectionDate.toISOString().split('T')[0],
    type: hasWorkflow ? 'workflow' : 'direct'
  });
};

/**
 * Process inspection for a group of assets
 */
const processGroupInspection = async (
  group,
  frequency,
  workflowSequences,
  hasWorkflow,
  org_id,
  results
) => {
  // Get assets in this group
  const groupAssetsResult = await inspectionModel.getAssetsByGroupId(group.group_id, org_id);
  const groupAssets = groupAssetsResult.rows;

  if (groupAssets.length === 0) {
    console.log(`    ⚠️  Group ${group.group_id} - No assets found`);
    return;
  }

  // Use first asset in group for date calculations
  const firstAsset = groupAssets[0];

  // Check for existing in-progress group inspection
  // Note: For groups, we check using the first asset's ID
  const existingWorkflow = await inspectionModel.checkExistingWorkflowInspection(
    firstAsset.asset_id,
    org_id
  );

  if (existingWorkflow.rows.length > 0 && existingWorkflow.rows[0].group_id === group.group_id) {
    console.log(`    ⏭️  Group ${group.group_id} - Already has in-progress inspection`);
    results.stats.inspectionsSkipped++;
    return;
  }

  // Get last completed group inspection
  const lastInspectionDate = await inspectionModel.getLastCompletedInspectionDate(
    firstAsset.asset_id,
    org_id
  );

  const baseDate = lastInspectionDate || firstAsset.purchased_on;

  if (!baseDate) {
    console.log(`    ⚠️  Group ${group.group_id} - No base date available`);
    results.stats.inspectionsSkipped++;
    return;
  }

  // Calculate next inspection date
  const nextInspectionDate = inspectionModel.calculateNextInspectionDate(
    baseDate,
    frequency.frequency,
    frequency.uom
  );

  // Apply lead time
  const leadTime = frequency.insp_lead_time || 10;
  const createDate = new Date(nextInspectionDate);
  createDate.setDate(createDate.getDate() - leadTime);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < createDate) {
    console.log(`    ⏰ Group ${group.group_id} - Not yet due`);
    results.stats.inspectionsSkipped++;
    return;
  }

  console.log(`    ✅ Group ${group.group_id} - DUE (${groupAssets.length} assets)`);

  // CREATE GROUP INSPECTION
  if (hasWorkflow) {
    await createWorkflowInspection(
      { ...firstAsset, group_id: group.group_id },
      frequency,
      workflowSequences,
      nextInspectionDate,
      org_id
    );
    console.log(`       ✨ Created WORKFLOW group inspection`);
  } else {
    await createDirectInspection(
      { ...firstAsset, group_id: group.group_id },
      frequency,
      nextInspectionDate,
      org_id
    );
    console.log(`       ✨ Created DIRECT group inspection`);
  }

  results.stats.inspectionsCreated++;
};

/**
 * Create workflow inspection (multi-level approval)
 */
const createWorkflowInspection = async (
  asset,
  frequency,
  workflowSequences,
  scheduledDate,
  org_id
) => {
  // Generate unique header ID
  const wfaiish_id = inspectionModel.generateUniqueId('WFAIISH');

  // Create header record
  await inspectionModel.createWorkflowInspectionHeader({
    wfaiish_id,
    aatif_id: frequency.aatif_id,
    asset_id: asset.asset_id,
    group_id: asset.group_id || null,
    vendor_id: asset.vendor_id || null,
    pl_sch_date: scheduledDate,
    status: 'IN', // Initiated
    created_by: 'SYSTEM',
    org_id,
    branch_code: asset.branch_code,
    emp_int_id: frequency.emp_int_id || null
  });

  // Create detail records for each approval level
  console.log(`\n      🔍 DEBUG: Creating details for ${workflowSequences.length} approval levels`);
  
  for (let i = 0; i < workflowSequences.length; i++) {
    const sequence = workflowSequences[i];
    
    console.log(`      🔍 Sequence ${i + 1} object:`, JSON.stringify(sequence));
    console.log(`      🔍 sequence.wf_steps_id value: "${sequence.wf_steps_id}"`);
    console.log(`      🔍 All sequence keys:`, Object.keys(sequence));
    
    // Get job role details
    const jobRoleResult = await inspectionModel.getInspectionJobRole(
      sequence.wf_steps_id,
      org_id
    );

    if (jobRoleResult.rows.length === 0) {
      console.log(`      ⚠️  No job role found for step ${sequence.wf_steps_id}`);
      continue;
    }

    const jobRole = jobRoleResult.rows[0];
    const wfaiisd_id = inspectionModel.generateUniqueId('WFAIISD');

    // First sequence = Action Pending (AP), others = Initiated (IN)
    const status = i === 0 ? 'AP' : 'IN';

    await inspectionModel.createWorkflowInspectionDetail({
      wfaiisd_id,
      wfaiish_id,
      job_role_id: jobRole.job_role_id,
      dept_id: jobRole.dept_id,
      sequence: i + 1,
      status,
      created_by: 'SYSTEM',
      org_id,
      user_id: jobRole.emp_int_id || null
    });

    console.log(`       📝 Approver ${i + 1}: JobRole ${jobRole.job_role_id} (${status})`);
  }
};

/**
 * Create direct inspection (no workflow)
 */
const createDirectInspection = async (
  asset,
  frequency,
  scheduledDate,
  org_id
) => {
  const ais_id = inspectionModel.generateUniqueId('AIS');

  await inspectionModel.createDirectInspectionSchedule({
    ais_id,
    aatif_id: frequency.aatif_id,
    asset_id: asset.asset_id,
    group_id: asset.group_id || null,
    pl_sch_date: scheduledDate,
    status: 'PN', // Pending
    created_by: 'SYSTEM',
    org_id,
    branch_code: asset.branch_code
  });
};

const getInspections = async (req, res) => {
  try {
    const org_id = req.user?.org_id || req.query.orgId || 'ORG001';
    const empIntId = req.user?.emp_int_id || null;
    const result = await inspectionModel.getInspectionList(org_id, empIntId);
    return res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inspections' });
  }
};

const getInspectionDetail = async (req, res) => {
  try {
    const org_id = req.user?.org_id || req.query.orgId || 'ORG001';
    const id = req.params.id;
    const result = await inspectionModel.getInspectionDetailsById(id, org_id);
    
    if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Inspection not found' });
    }
    
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching inspection detail:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inspection detail' });
  }
};

const updateInspection = async (req, res) => {
  try {
    const org_id = req.user?.org_id || req.body.org_id || 'ORG001';
    const id = req.params.id;
    const updateData = req.body;
    
    // Filter allowed fields
    const allowedFields = ['act_insp_st_date', 'act_insp_end_date', 'status', 'notes', 'trigger_maintenance', 'vendor_id', 'inspector_name', 'inspector_email', 'inspector_phno'];
    const filteredUpdate = {};
    
    allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
            filteredUpdate[field] = updateData[field];
        }
    });

    if (Object.keys(filteredUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // Ensure emp_int_id is stored as the current user's employee id when saving from inspection list
    if (req.user?.emp_int_id) {
      // Check if this inspection is vendor-maintained; if so, do not set emp_int_id
      try {
        const existing = await inspectionModel.getInspectionDetailsById(id, org_id);
        const aatif_id = existing.rows.length ? existing.rows[0].aatif_id : null;
        let isVendor = false;
        if (aatif_id) {
          const aifRes = await inspectionModel.getInspectionFrequency ? await inspectionModel.getInspectionFrequency(aatif_id, org_id) : null;
          // aifRes may be a db result or null; normalize
          if (aifRes && aifRes.rows && aifRes.rows.length) {
            const maintainedBy = aifRes.rows[0].maintained_by || '';
            isVendor = String(maintainedBy).toLowerCase() === 'vendor';
          }
        } else if (existing.rows.length && existing.rows[0].vendor_id) {
          isVendor = true;
        }

        if (!isVendor) {
          filteredUpdate.emp_int_id = req.user.emp_int_id;
        }
      } catch (e) {
        // On error, fallback to setting emp_int_id for safety
        filteredUpdate.emp_int_id = req.user.emp_int_id;
      }
    }

    const result = await inspectionModel.updateInspectionRecord(id, org_id, filteredUpdate);
    
    if (result.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Inspection not found or update failed' });
    }
    
    return res.json({ success: true, message: 'Inspection updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating inspection:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inspection' });
  }
};

const getInspectionChecklist = async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const org_id = req.user?.org_id || req.query.orgId || 'ORG001';
    
    const result = await inspectionModel.getInspectionChecklistByAssetType(assetTypeId, org_id);
    return res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching inspection checklist:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inspection checklist' });
  }
};

const getInspectionRecords = async (req, res) => {
  try {
    const { id } = req.params; // inspection id (ais_id)
    const org_id = req.user?.org_id || req.query.orgId || 'ORG001';
    
    const result = await inspectionModel.getInspectionRecords(id, org_id);
    return res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching inspection records:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch inspection records' });
  }
};

const saveInspectionRecord = async (req, res) => {
  try {
    const org_id = req.user?.org_id || req.body.org_id || 'ORG001';
    const callerUserId = req.user?.user_id || req.body.created_by || 'SYSTEM';
    const callerEmpIntId = req.user?.emp_int_id || req.body.emp_int_id || null;

    // Log incoming request for debugging (full headers + body)
    console.log('API: saveInspectionRecord called - headers:', req.headers);
    console.log('API: saveInspectionRecord called - full body:', JSON.stringify(req.body));

    const { ais_id, records, insp_check_id, recorded_value, notes, inspector_name, inspector_email, inspector_phone, trigger_maintenance } = req.body;

    if (!ais_id) {
      console.log('API: saveInspectionRecord - missing ais_id in request body');
      return res.status(400).json({ success: false, message: 'ais_id is required' });
    }

    console.log('API: saveInspectionRecord metadata', { ais_id, recordsCount: Array.isArray(records) ? records.length : 0, insp_check_id: insp_check_id || null, callerUserId, callerEmpIntId });

    // Fetch inspection schedule to determine if inhouse or vendor and assigned emp
    const inspRes = await inspectionModel.getInspectionDetailsById(ais_id, org_id);
    if (!inspRes || inspRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Inspection not found' });
    const insp = inspRes.rows[0];

    const isVendor = !!(
      (insp.maintained_by && String(insp.maintained_by).toLowerCase() === 'vendor') ||
      (!!insp.vendor_id)
    ); // vendor-maintained when maintained_by === 'vendor' or vendor_id is present
    const assignedEmp = insp.inspected_by || insp.emp_int_id || null;

    // Permission: if inhouse (no vendor), only assigned emp_int_id may save
    if (!isVendor && assignedEmp) {
      if (!callerEmpIntId || String(callerEmpIntId) !== String(assignedEmp)) {
        return res.status(403).json({ success: false, message: 'Only assigned technician can record inspection values for inhouse maintenance.' });
      }
    }

    // Prepare list of records to save
    let recordsToSave = [];
    if (Array.isArray(records) && records.length > 0) {
      // Use the frequency id (aatif_id) as the link (aatisch_id) to satisfy DB FK
      const linkId = insp.aatif_id || null;
      recordsToSave = records.map(r => ({ aatisch_id: linkId, insp_check_id: r.insp_check_id, recorded_value: r.recorded_value, created_by: callerUserId, org_id }));
    } else if (insp_check_id && (recorded_value !== undefined)) {
      const linkId = insp.aatif_id || null;
      recordsToSave = [{ aatisch_id: linkId, insp_check_id, recorded_value, created_by: callerUserId, org_id }];
    } else {
      // nothing to save
      recordsToSave = [];
    }

    // Validation: For inhouse inspections, technician must provide values for all checklist items
    if (!isVendor) {
      try {
        const checklistRes = await inspectionModel.getInspectionChecklistByAssetType(insp.asset_type_id, org_id);
        const checklistItems = checklistRes.rows || [];

        // Build set of provided insp_check_id
        const provided = new Set(recordsToSave.map(r => String(r.insp_check_id)));

        const missing = checklistItems
          .map(ci => String(ci.insp_check_id))
          .filter(id => !provided.has(id));

        if (missing.length > 0) {
          return res.status(400).json({ success: false, message: 'Missing checklist values for in-house inspection', missing });
        }
      } catch (err) {
        console.error('Error validating checklist for inhouse inspection:', err);
        return res.status(500).json({ success: false, message: 'Failed to validate checklist items' });
      }
    }

    // Basic validation: each record must have a non-empty recorded_value
    for (const r of recordsToSave) {
      if (r.recorded_value === undefined || r.recorded_value === null || String(r.recorded_value).trim() === '') {
        return res.status(400).json({ success: false, message: 'Empty recorded value in records', record: r });
      }
    }

    const saved = [];
    console.log('Records to save (expanded):', JSON.stringify(recordsToSave));
    for (const r of recordsToSave) {
      try {
        console.log('Saving record:', r);
        const result = await inspectionModel.saveInspectionRecord(r);
        console.log('Save result for insp_check_id', r.insp_check_id, ':', result && (result.rowCount || (result.rows && result.rows.length)) ? result.rows || result : result);
        if (result && result.rows && result.rows[0]) {
          saved.push(result.rows[0]);
          console.log('Saved row:', result.rows[0]);
        }
      } catch (recErr) {
        console.error('Error saving record (stack):', recErr && recErr.stack ? recErr.stack : recErr, { record: r, ais_id });
        // Continue trying to save other records but note the error
      }
    }

    console.log('Saved records count:', saved.length, 'expected:', recordsToSave.length);

    // Update inspection schedule notes and inspector info if provided
    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (trigger_maintenance !== undefined) updateData.trigger_maintenance = trigger_maintenance;

    if (isVendor && inspector_name) {
      // append inspector info to notes for record
      const inspectorInfo = `Inspector: ${inspector_name}${inspector_email ? ' | ' + inspector_email : ''}${inspector_phone ? ' | ' + inspector_phone : ''}`;
      updateData.notes = (updateData.notes ? updateData.notes + '\n' : '') + inspectorInfo;
      // set changed_by to inspector name so table reflects who saved
      updateData.changed_by = inspector_name;
      // Also persist inspector fields to the schedule so they are visible in the UI
      updateData.inspector_name = inspector_name;
      if (inspector_email !== undefined) updateData.inspector_email = inspector_email;
      if (inspector_phone !== undefined) updateData.inspector_phno = inspector_phone;
    }

    let updatedSchedule = null;
    if (Object.keys(updateData).length > 0) {
      console.log('Updating inspection schedule with:', updateData);
      const updRes = await inspectionModel.updateInspectionRecord(ais_id, org_id, updateData);
      console.log('Update schedule result:', updRes && (updRes.rowCount || (updRes.rows && updRes.rows.length)) ? updRes.rows || updRes : updRes);
      if (updRes && updRes.rows && updRes.rows[0]) updatedSchedule = updRes.rows[0];
    }

    console.log('saveInspectionRecord completed - savedRecords:', saved.length, 'updatedSchedulePresent:', !!updatedSchedule);

    return res.json({ success: true, data: { savedRecords: saved, updatedSchedule } });
  } catch (error) {
    console.error('Error saving inspection record:', error, { body: req.body });
    return res.status(500).json({ success: false, message: 'Failed to save inspection record', error: error.message });
  }
};

module.exports = {
  generateInspectionSchedules,
  getInspections,
  getInspectionDetail,
  updateInspection,
  getInspectionChecklist,
  getInspectionRecords,
  saveInspectionRecord
};
