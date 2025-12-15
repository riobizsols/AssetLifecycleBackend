/**
 * Comprehensive audit of all assets to check required configuration
 * - Workflow sequences
 * - Job roles (only JR001, JR002, JR003)
 * - Maintenance frequencies
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

async function auditAllAssets() {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 COMPREHENSIVE ASSET CONFIGURATION AUDIT');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Get all asset types that require maintenance
        const assetTypesQuery = `
            SELECT 
                asset_type_id,
                text as asset_type_name,
                maint_required,
                org_id
            FROM "tblAssetTypes"
            WHERE maint_required = true
            ORDER BY asset_type_id
        `;
        
        const assetTypesResult = await dbPool.query(assetTypesQuery);
        
        console.log(`📦 Found ${assetTypesResult.rows.length} asset types requiring maintenance\n`);
        
        const issues = [];
        const validJobRoles = ['JR001', 'JR002', 'JR003'];
        
        for (const assetType of assetTypesResult.rows) {
            const assetTypeId = assetType.asset_type_id;
            const assetTypeName = assetType.asset_type_name;
            
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📋 Asset Type: ${assetTypeId} - ${assetTypeName}`);
            console.log(`${'─'.repeat(60)}\n`);
            
            // Check 1: Workflow Sequences
            const sequencesQuery = `
                SELECT 
                    wf_at_seqs_id,
                    wf_steps_id,
                    seqs_no
                FROM "tblWFATSeqs"
                WHERE asset_type_id = $1
                ORDER BY seqs_no
            `;
            
            const sequencesResult = await dbPool.query(sequencesQuery, [assetTypeId]);
            
            if (sequencesResult.rows.length === 0) {
                console.log(`   ❌ NO WORKFLOW SEQUENCES`);
                issues.push({
                    asset_type_id: assetTypeId,
                    asset_type_name: assetTypeName,
                    issue: 'Missing workflow sequences',
                    severity: 'CRITICAL'
                });
            } else {
                console.log(`   ✅ Workflow Sequences: ${sequencesResult.rows.length}`);
                
                // Check 2: Job Roles for each sequence
                let allSequencesValid = true;
                const invalidJobRoles = [];
                
                for (const sequence of sequencesResult.rows) {
                    const jobRolesQuery = `
                        SELECT 
                            wf_job_role_id,
                            job_role_id,
                            wf_steps_id,
                            dept_id,
                            emp_int_id
                        FROM "tblWFJobRole"
                        WHERE wf_steps_id = $1
                        ORDER BY wf_job_role_id
                    `;
                    
                    const jobRolesResult = await dbPool.query(jobRolesQuery, [sequence.wf_steps_id]);
                    
                    if (jobRolesResult.rows.length === 0) {
                        console.log(`      ❌ Sequence ${sequence.seqs_no} (${sequence.wf_steps_id}): NO JOB ROLES`);
                        issues.push({
                            asset_type_id: assetTypeId,
                            asset_type_name: assetTypeName,
                            issue: `Sequence ${sequence.seqs_no} (${sequence.wf_steps_id}) has no job roles`,
                            severity: 'CRITICAL'
                        });
                        allSequencesValid = false;
                    } else {
                        const jobRoleIds = jobRolesResult.rows.map(jr => jr.job_role_id);
                        const invalidRoles = jobRoleIds.filter(jr => !validJobRoles.includes(jr));
                        
                        if (invalidRoles.length > 0) {
                            console.log(`      ⚠️  Sequence ${sequence.seqs_no} (${sequence.wf_steps_id}): INVALID JOB ROLES`);
                            console.log(`         Found: ${jobRoleIds.join(', ')}`);
                            console.log(`         Invalid: ${invalidRoles.join(', ')}`);
                            console.log(`         Expected: ${validJobRoles.join(', ')}`);
                            invalidJobRoles.push({
                                sequence: sequence.seqs_no,
                                wf_steps_id: sequence.wf_steps_id,
                                invalid: invalidRoles,
                                all: jobRoleIds
                            });
                            allSequencesValid = false;
                        } else {
                            console.log(`      ✅ Sequence ${sequence.seqs_no} (${sequence.wf_steps_id}): ${jobRoleIds.length} job role(s) - ${jobRoleIds.join(', ')}`);
                        }
                    }
                }
                
                if (invalidJobRoles.length > 0) {
                    issues.push({
                        asset_type_id: assetTypeId,
                        asset_type_name: assetTypeName,
                        issue: `Invalid job roles found (must be JR001, JR002, or JR003)`,
                        invalid_job_roles: invalidJobRoles,
                        severity: 'HIGH'
                    });
                }
            }
            
            // Check 3: Maintenance Frequencies
            const frequenciesQuery = `
                SELECT 
                    at_main_freq_id,
                    frequency,
                    uom,
                    maint_type_id
                FROM "tblATMaintFreq"
                WHERE asset_type_id = $1
                ORDER BY frequency
            `;
            
            const frequenciesResult = await dbPool.query(frequenciesQuery, [assetTypeId]);
            
            if (frequenciesResult.rows.length === 0) {
                console.log(`   ❌ NO MAINTENANCE FREQUENCIES`);
                issues.push({
                    asset_type_id: assetTypeId,
                    asset_type_name: assetTypeName,
                    issue: 'Missing maintenance frequencies',
                    severity: 'CRITICAL'
                });
            } else {
                console.log(`   ✅ Maintenance Frequencies: ${frequenciesResult.rows.length}`);
                for (const freq of frequenciesResult.rows) {
                    console.log(`      - ${freq.frequency} ${freq.uom} (type: ${freq.maint_type_id})`);
                }
            }
        }
        
        // Summary
        console.log(`\n\n${'═'.repeat(60)}`);
        console.log('📊 AUDIT SUMMARY');
        console.log(`${'═'.repeat(60)}\n`);
        
        const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
        const highIssues = issues.filter(i => i.severity === 'HIGH');
        
        console.log(`Total Asset Types: ${assetTypesResult.rows.length}`);
        console.log(`Issues Found: ${issues.length}`);
        console.log(`   Critical: ${criticalIssues.length}`);
        console.log(`   High: ${highIssues.length}\n`);
        
        if (issues.length > 0) {
            console.log('❌ ISSUES FOUND:\n');
            
            for (const issue of issues) {
                console.log(`   [${issue.severity}] ${issue.asset_type_id} - ${issue.asset_type_name}`);
                console.log(`      ${issue.issue}`);
                if (issue.invalid_job_roles) {
                    for (const inv of issue.invalid_job_roles) {
                        console.log(`      Sequence ${inv.sequence}: Invalid roles ${inv.invalid.join(', ')}`);
                    }
                }
                console.log('');
            }
            
            console.log('\n💡 RECOMMENDATIONS:');
            console.log('   1. Run fix scripts to add missing workflow sequences');
            console.log('   2. Run fix scripts to add missing job roles');
            console.log('   3. Run fix scripts to add missing maintenance frequencies');
            console.log('   4. Update invalid job roles to JR001, JR002, or JR003\n');
        } else {
            console.log('✅ All asset types are properly configured!\n');
        }
        
        // Return issues for potential fixing
        return {
            totalAssetTypes: assetTypesResult.rows.length,
            issues: issues,
            criticalIssues: criticalIssues,
            highIssues: highIssues
        };
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('   Stack:', error.stack);
        throw error;
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

auditAllAssets()
    .then((result) => {
        // Save results to a file for reference
        const fs = require('fs');
        const path = require('path');
        const outputPath = path.join(__dirname, 'audit-results.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`📄 Detailed results saved to: ${outputPath}\n`);
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

