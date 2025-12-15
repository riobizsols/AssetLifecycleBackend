/**
 * Check the current maintenance status for an asset
 */

const { getDb } = require('../utils/dbContext');
const db = require('../config/db');

const getDbPool = () => {
    try {
        return getDb();
    } catch (error) {
        return db;
    }
};

async function checkMaintenanceStatus(assetId = 'ASS117') {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING MAINTENANCE STATUS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Get asset info
        const assetQuery = `
            SELECT 
                a.asset_id,
                a.asset_type_id,
                a.purchased_on,
                a.service_vendor_id,
                a.org_id,
                a.text as asset_name,
                at.text as asset_type_name,
                at.maint_required
            FROM "tblAssets" a
            INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            WHERE a.asset_id = $1
        `;
        
        const assetResult = await dbPool.query(assetQuery, [assetId]);
        
        if (assetResult.rows.length === 0) {
            console.log(`❌ Asset ${assetId} not found!`);
            return;
        }
        
        const asset = assetResult.rows[0];
        console.log(`📦 Asset: ${asset.asset_id} - ${asset.asset_name}`);
        console.log(`   Asset Type: ${asset.asset_type_id} (${asset.asset_type_name})`);
        console.log(`   Purchased On: ${asset.purchased_on}`);
        console.log(`   Maintenance Required: ${asset.maint_required}\n`);
        
        // Check for in-progress maintenance schedules (tblAssetMaintSch)
        const maintSchQuery = `
            SELECT 
                ams_id,
                status,
                act_maint_st_date,
                created_on
            FROM "tblAssetMaintSch"
            WHERE asset_id = $1
            ORDER BY created_on DESC
        `;
        
        const maintSchResult = await dbPool.query(maintSchQuery, [assetId]);
        
        console.log(`📋 Maintenance Schedules (tblAssetMaintSch): ${maintSchResult.rows.length} total\n`);
        if (maintSchResult.rows.length > 0) {
            const inProgress = maintSchResult.rows.filter(s => s.status === 'IN');
            const completed = maintSchResult.rows.filter(s => s.status === 'CO' || s.status === 'CA');
            
            console.log(`   In-Progress: ${inProgress.length}`);
            if (inProgress.length > 0) {
                console.log(`   ⚠️  Asset has in-progress maintenance schedules - would be skipped!\n`);
                for (const s of inProgress) {
                    console.log(`      - ${s.ams_id}: ${s.status} (created: ${s.created_on})`);
                }
            }
            
            console.log(`   Completed/Cancelled: ${completed.length}\n`);
        } else {
            console.log(`   ✅ No maintenance schedules found\n`);
        }
        
        // Check for in-progress workflow schedules (tblWFAssetMaintSch_H)
        const workflowQuery = `
            SELECT 
                wfamsh_id,
                asset_id,
                status,
                pl_sch_date,
                created_on
            FROM "tblWFAssetMaintSch_H"
            WHERE asset_id = $1
            ORDER BY created_on DESC
        `;
        
        const workflowResult = await dbPool.query(workflowQuery, [assetId]);
        
        console.log(`📋 Workflow Headers (tblWFAssetMaintSch_H): ${workflowResult.rows.length} total\n`);
        if (workflowResult.rows.length > 0) {
            const inProgress = workflowResult.rows.filter(s => s.status === 'IN' || s.status === 'IP');
            const completed = workflowResult.rows.filter(s => s.status === 'CO' || s.status === 'CA');
            
            console.log(`   In-Progress: ${inProgress.length}`);
            if (inProgress.length > 0) {
                console.log(`   ⚠️  Asset has in-progress workflow schedules - would be skipped!\n`);
                for (const s of inProgress) {
                    console.log(`      - ${s.wfamsh_id}: ${s.status} (created: ${s.created_on})`);
                    
                    // Check details for this header
                    const detailsQuery = `
                        SELECT 
                            wfamsd_id,
                            sequence,
                            status,
                            job_role_id
                        FROM "tblWFAssetMaintSch_D"
                        WHERE wfamsh_id = $1
                        ORDER BY sequence
                    `;
                    
                    const detailsResult = await dbPool.query(detailsQuery, [s.wfamsh_id]);
                    console.log(`         Details: ${detailsResult.rows.length}`);
                    if (detailsResult.rows.length === 0) {
                        console.log(`         ❌ NO DETAILS FOUND for this header!\n`);
                    } else {
                        for (const d of detailsResult.rows) {
                            console.log(`            - ${d.wfamsd_id}: seq ${d.sequence}, status ${d.status}, job_role ${d.job_role_id}`);
                        }
                        console.log('');
                    }
                }
            }
            
            console.log(`   Completed/Cancelled: ${completed.length}\n`);
        } else {
            console.log(`   ✅ No workflow headers found\n`);
        }
        
        // Check maintenance frequencies
        const freqQuery = `
            SELECT 
                at_main_freq_id,
                frequency,
                uom,
                maint_type_id
            FROM "tblATMaintFreq"
            WHERE asset_type_id = $1
            ORDER BY frequency
        `;
        
        const freqResult = await dbPool.query(freqQuery, [asset.asset_type_id]);
        
        console.log(`📅 Maintenance Frequencies: ${freqResult.rows.length} total\n`);
        if (freqResult.rows.length === 0) {
            console.log(`   ⚠️  No maintenance frequencies configured!\n`);
        } else {
            for (const freq of freqResult.rows) {
                console.log(`   - ${freq.frequency} ${freq.uom} (type: ${freq.maint_type_id})`);
            }
            console.log('');
        }
        
        // Calculate if maintenance is due
        if (asset.purchased_on && freqResult.rows.length > 0) {
            const purchasedDate = new Date(asset.purchased_on);
            const today = new Date();
            
            console.log(`📊 Maintenance Due Date Calculation:\n`);
            for (const freq of freqResult.rows) {
                const plannedDate = new Date(purchasedDate);
                const frequency = parseInt(freq.frequency);
                const uom = freq.uom.toLowerCase();
                
                if (uom === 'days') {
                    plannedDate.setDate(plannedDate.getDate() + frequency);
                } else if (uom === 'weeks') {
                    plannedDate.setDate(plannedDate.getDate() + (frequency * 7));
                } else if (uom === 'months') {
                    plannedDate.setMonth(plannedDate.getMonth() + frequency);
                } else if (uom === 'years') {
                    plannedDate.setFullYear(plannedDate.getFullYear() + frequency);
                }
                
                const tenDaysBefore = new Date(plannedDate);
                tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);
                
                const isDue = today >= tenDaysBefore;
                
                console.log(`   Frequency: ${freq.frequency} ${freq.uom}`);
                console.log(`      Planned Date: ${plannedDate.toISOString().split('T')[0]}`);
                console.log(`      Window Opens: ${tenDaysBefore.toISOString().split('T')[0]}`);
                console.log(`      Is Due: ${isDue ? '✅ YES' : '❌ NO'}\n`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

const args = process.argv.slice(2);
const assetId = args[0] ? args[0].toUpperCase() : 'ASS117';

checkMaintenanceStatus(assetId)
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

