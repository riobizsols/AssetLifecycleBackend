/**
 * Test maintenance generation for a specific asset to see what's happening
 */

const { getDb } = require('../utils/dbContext');
const db = require('../config/db');
const model = require('../models/maintenanceScheduleModel');

const getDbPool = () => {
    try {
        return getDb();
    } catch (error) {
        return db;
    }
};

async function testMaintenanceGeneration(assetId = 'ASS117') {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🧪 TESTING MAINTENANCE GENERATION');
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
                a.branch_id,
                b.branch_code,
                at.text as asset_type_name,
                at.maint_required
            FROM "tblAssets" a
            INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
            LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
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
        
        // Check workflow sequences
        const sequencesResult = await model.getWorkflowAssetSequences(asset.asset_type_id);
        console.log(`📋 Workflow Sequences: ${sequencesResult.rows.length}\n`);
        
        if (sequencesResult.rows.length === 0) {
            console.log('❌ No workflow sequences found!');
            return;
        }
        
        // Simulate creating a header
        console.log('🔧 Simulating workflow header creation...\n');
        
        const wfamshId = await model.getNextWFAMSHId();
        console.log(`   Generated Header ID: ${wfamshId}\n`);
        
        // Try to create details for each sequence
        console.log('🔧 Testing detail creation for each sequence...\n');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const sequence of sequencesResult.rows) {
            console.log(`   Testing Sequence ${sequence.seqs_no} (wf_steps_id: ${sequence.wf_steps_id})...`);
            
            try {
                const workflowJobRoles = await model.getWorkflowJobRoles(sequence.wf_steps_id);
                console.log(`      Found ${workflowJobRoles.rows.length} job role(s)`);
                
                if (workflowJobRoles.rows.length === 0) {
                    console.log(`      ⚠️  No job roles - would skip this sequence\n`);
                    continue;
                }
                
                for (const jobRole of workflowJobRoles.rows) {
                    try {
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
                            notes: null,
                            created_by: 'system',
                            org_id: asset.org_id
                        };
                        
                        // Try to insert (but rollback)
                        const insertResult = await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
                        
                        console.log(`      ✅ Successfully created detail: ${wfamsdId}`);
                        console.log(`         - job_role_id: ${jobRole.job_role_id}`);
                        console.log(`         - dept_id: ${jobRole.dept_id || 'NULL'}`);
                        console.log(`         - user_id: ${jobRole.emp_int_id || 'NULL'}`);
                        console.log(`         - status: ${status}\n`);
                        
                        // Delete the test record
                        await dbPool.query(
                            `DELETE FROM "tblWFAssetMaintSch_D" WHERE wfamsd_id = $1`,
                            [wfamsdId]
                        );
                        
                        successCount++;
                    } catch (detailError) {
                        console.log(`      ❌ Error creating detail:`);
                        console.log(`         Message: ${detailError.message}`);
                        console.log(`         Code: ${detailError.code || 'N/A'}`);
                        if (detailError.constraint) {
                            console.log(`         Constraint: ${detailError.constraint}`);
                        }
                        console.log('');
                        errorCount++;
                    }
                }
            } catch (error) {
                console.log(`      ❌ Error getting job roles: ${error.message}\n`);
                errorCount++;
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 TEST RESULTS');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`✅ Successful detail creations: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}\n`);
        
        if (errorCount > 0) {
            console.log('⚠️  There were errors during detail creation.');
            console.log('   Check the error messages above for details.\n');
        } else if (successCount === 0) {
            console.log('⚠️  No details were created. Possible reasons:');
            console.log('   1. No job roles configured for the sequences');
            console.log('   2. All sequences were skipped\n');
        } else {
            console.log('✅ Detail creation test passed!');
            console.log('   The issue might be in the maintenance generation logic itself.\n');
        }
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

const args = process.argv.slice(2);
const assetId = args[0] ? args[0].toUpperCase() : 'ASS117';

testMaintenanceGeneration(assetId)
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

