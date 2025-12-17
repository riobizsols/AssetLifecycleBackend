/**
 * Diagnostic script to check why maintenance workflow details are not being created
 * 
 * This script checks:
 * 1. If workflow sequences exist for the asset type
 * 2. If job roles are configured for those workflow steps
 * 3. Shows the exact configuration needed
 */

const { getDb } = require('../utils/dbContext');
const db = require('../config/db');

const getDbPool = () => {
    try {
        return getDb();
    } catch (error) {
        console.log('Using default database connection');
        return db;
    }
};

async function diagnoseMaintenanceDetails(assetId = null, assetTypeId = null) {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 DIAGNOSING MAINTENANCE WORKFLOW DETAILS CREATION');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Step 1: Get asset information
        let assetQuery = `
            SELECT 
                a.asset_id,
                a.asset_type_id,
                a.text as asset_name,
                at.text as asset_type_name,
                at.maint_required,
                a.org_id
            FROM "tblAssets" a
            INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        `;
        
        const assetParams = [];
        if (assetId) {
            assetQuery += ` WHERE a.asset_id = $1`;
            assetParams.push(assetId);
        } else if (assetTypeId) {
            assetQuery += ` WHERE a.asset_type_id = $1 LIMIT 1`;
            assetParams.push(assetTypeId);
        } else {
            assetQuery += ` WHERE at.maint_required = true LIMIT 1`;
        }
        
        const assetResult = await dbPool.query(assetQuery, assetParams);
        
        if (assetResult.rows.length === 0) {
            console.log('❌ No assets found matching the criteria');
            return;
        }
        
        const asset = assetResult.rows[0];
        console.log(`📦 Asset Information:`);
        console.log(`   Asset ID: ${asset.asset_id}`);
        console.log(`   Asset Name: ${asset.asset_name || 'N/A'}`);
        console.log(`   Asset Type ID: ${asset.asset_type_id}`);
        console.log(`   Asset Type Name: ${asset.asset_type_name || 'N/A'}`);
        console.log(`   Maintenance Required: ${asset.maint_required}`);
        console.log(`   Org ID: ${asset.org_id}\n`);
        
        // Step 2: Check for workflow sequences
        const sequencesQuery = `
            SELECT 
                wf_at_seqs_id,
                asset_type_id,
                wf_steps_id,
                seqs_no,
                org_id
            FROM "tblWFATSeqs"
            WHERE asset_type_id = $1
            ORDER BY seqs_no
        `;
        
        const sequencesResult = await dbPool.query(sequencesQuery, [asset.asset_type_id]);
        
        console.log(`📋 Workflow Sequences for Asset Type ${asset.asset_type_id}:`);
        if (sequencesResult.rows.length === 0) {
            console.log('   ❌ NO WORKFLOW SEQUENCES FOUND!');
            console.log('   ⚠️  This is why details are not being created.');
            console.log('   💡 Solution: Create workflow sequences in tblWFATSeqs for this asset type.\n');
        } else {
            console.log(`   ✅ Found ${sequencesResult.rows.length} workflow sequence(s):\n`);
            for (const seq of sequencesResult.rows) {
                console.log(`      Sequence ${seq.seqs_no}:`);
                console.log(`         - wf_at_seqs_id: ${seq.wf_at_seqs_id}`);
                console.log(`         - wf_steps_id: ${seq.wf_steps_id}`);
                console.log(`         - org_id: ${seq.org_id}\n`);
            }
        }
        
        // Step 3: Check for job roles for each workflow step
        if (sequencesResult.rows.length > 0) {
            console.log(`👥 Job Roles Configuration:\n`);
            
            for (const seq of sequencesResult.rows) {
                const jobRolesQuery = `
                    SELECT 
                        wf_job_role_id,
                        wf_steps_id,
                        job_role_id,
                        dept_id,
                        emp_int_id
                    FROM "tblWFJobRole"
                    WHERE wf_steps_id = $1
                    ORDER BY wf_job_role_id
                `;
                
                const jobRolesResult = await dbPool.query(jobRolesQuery, [seq.wf_steps_id]);
                
                console.log(`   Sequence ${seq.seqs_no} (wf_steps_id: ${seq.wf_steps_id}):`);
                if (jobRolesResult.rows.length === 0) {
                    console.log(`      ❌ NO JOB ROLES FOUND for this workflow step!`);
                    console.log(`      ⚠️  This is why details are not being created for sequence ${seq.seqs_no}.`);
                    console.log(`      💡 Solution: Create job role entries in tblWFJobRole for wf_steps_id: ${seq.wf_steps_id}\n`);
                } else {
                    console.log(`      ✅ Found ${jobRolesResult.rows.length} job role(s):\n`);
                    for (const jobRole of jobRolesResult.rows) {
                        console.log(`         - wf_job_role_id: ${jobRole.wf_job_role_id}`);
                        console.log(`         - job_role_id: ${jobRole.job_role_id}`);
                        console.log(`         - dept_id: ${jobRole.dept_id || 'NULL'}`);
                        console.log(`         - emp_int_id: ${jobRole.emp_int_id || 'NULL'}\n`);
                    }
                }
            }
        }
        
        // Step 4: Check for existing workflow headers without details
        const headersQuery = `
            SELECT 
                wfh.wfamsh_id,
                wfh.asset_id,
                wfh.status,
                wfh.created_on,
                COUNT(wfd.wfamsd_id) as detail_count
            FROM "tblWFAssetMaintSch_H" wfh
            LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
            WHERE wfh.asset_id = $1
            GROUP BY wfh.wfamsh_id, wfh.asset_id, wfh.status, wfh.created_on
            ORDER BY wfh.created_on DESC
            LIMIT 5
        `;
        
        const headersResult = await dbPool.query(headersQuery, [asset.asset_id]);
        
        console.log(`📊 Recent Workflow Headers for Asset ${asset.asset_id}:`);
        if (headersResult.rows.length === 0) {
            console.log('   No workflow headers found.\n');
        } else {
            for (const header of headersResult.rows) {
                console.log(`   Header: ${header.wfamsh_id}`);
                console.log(`      Status: ${header.status}`);
                console.log(`      Created: ${header.created_on}`);
                console.log(`      Details Count: ${header.detail_count}`);
                if (parseInt(header.detail_count) === 0) {
                    console.log(`      ⚠️  WARNING: This header has NO details!\n`);
                } else {
                    console.log(`      ✅ Has ${header.detail_count} detail(s)\n`);
                }
            }
        }
        
        // Step 5: Summary and recommendations
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📝 SUMMARY & RECOMMENDATIONS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        if (sequencesResult.rows.length === 0) {
            console.log('❌ ISSUE FOUND: No workflow sequences configured');
            console.log('   Action Required:');
            console.log('   1. Insert records into tblWFATSeqs for asset_type_id:', asset.asset_type_id);
            console.log('   2. Each record should link to a wf_steps_id from tblWFSteps');
            console.log('   3. Set seqs_no (sequence number, e.g., 10, 20, 30)');
            console.log('   4. Ensure org_id matches the asset org_id\n');
        } else {
            let hasMissingJobRoles = false;
            for (const seq of sequencesResult.rows) {
                const jobRolesCheck = await dbPool.query(
                    `SELECT COUNT(*) as count FROM "tblWFJobRole" WHERE wf_steps_id = $1`,
                    [seq.wf_steps_id]
                );
                if (parseInt(jobRolesCheck.rows[0].count) === 0) {
                    hasMissingJobRoles = true;
                    console.log(`❌ ISSUE FOUND: No job roles for sequence ${seq.seqs_no} (wf_steps_id: ${seq.wf_steps_id})`);
                }
            }
            
            if (hasMissingJobRoles) {
                console.log('   Action Required:');
                console.log('   1. Insert records into tblWFJobRole for each wf_steps_id');
                console.log('   2. Each record should have: job_role_id, dept_id (optional), emp_int_id (optional)');
                console.log('   3. The job_role_id should exist in tblJobRoles\n');
            } else {
                console.log('✅ Configuration looks correct!');
                console.log('   If details are still not being created, check:');
                console.log('   1. Server console logs during maintenance generation');
                console.log('   2. Database connection issues');
                console.log('   3. Error messages in the maintenance generation response\n');
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error during diagnosis:');
        console.error('   Message:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

// Run the diagnosis
const args = process.argv.slice(2);
let assetId = null;
let assetTypeId = null;

if (args.length > 0) {
    if (args[0].toUpperCase().startsWith('AT')) {
        assetTypeId = args[0].toUpperCase();
    } else {
        assetId = args[0].toUpperCase();
    }
}

diagnoseMaintenanceDetails(assetId, assetTypeId)
    .then(() => {
        console.log('Diagnosis completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

