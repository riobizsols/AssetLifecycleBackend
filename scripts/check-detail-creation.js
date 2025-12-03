/**
 * Check why detail rows are not being created for maintenance schedules
 */

require('dotenv').config();
const { Pool } = require('pg');

async function checkDetailCreation() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING DETAIL ROW CREATION ISSUE');
        console.log('═══════════════════════════════════════════════════════════\n');

        // Check recent headers without details
        const headersWithoutDetails = await pool.query(`
            SELECT h.wfamsh_id, h.asset_id, h.status, h.created_on, h.maint_type_id,
                   COUNT(d.wfamsd_id) as detail_count
            FROM "tblWFAssetMaintSch_H" h
            LEFT JOIN "tblWFAssetMaintSch_D" d ON h.wfamsh_id = d.wfamsh_id
            WHERE h.created_by = 'system'
            AND h.created_on >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY h.wfamsh_id, h.asset_id, h.status, h.created_on, h.maint_type_id
            HAVING COUNT(d.wfamsd_id) = 0
            ORDER BY h.created_on DESC
            LIMIT 10
        `);

        console.log(`Found ${headersWithoutDetails.rows.length} headers without details:\n`);
        for (const header of headersWithoutDetails.rows) {
            console.log(`Header: ${header.wfamsh_id}`);
            console.log(`  Asset: ${header.asset_id}`);
            console.log(`  Status: ${header.status}`);
            console.log(`  Created: ${header.created_on}`);
            console.log(`  Maintenance Type: ${header.maint_type_id}`);

            // Get asset type for this asset
            const assetInfo = await pool.query(`
                SELECT asset_type_id FROM "tblAssets" WHERE asset_id = $1
            `, [header.asset_id]);

            if (assetInfo.rows.length > 0) {
                const assetTypeId = assetInfo.rows[0].asset_type_id;
                console.log(`  Asset Type: ${assetTypeId}`);

                // Check workflow sequences
                const sequences = await pool.query(`
                    SELECT wf_at_seqs_id, wf_steps_id, seqs_no
                    FROM "tblWFATSeqs"
                    WHERE asset_type_id = $1
                    ORDER BY seqs_no
                `, [assetTypeId]);

                console.log(`  Workflow Sequences Found: ${sequences.rows.length}`);
                if (sequences.rows.length === 0) {
                    console.log(`  ❌ NO WORKFLOW SEQUENCES CONFIGURED FOR ASSET TYPE ${assetTypeId}`);
                } else {
                    console.log(`  Sequences:`);
                    for (const seq of sequences.rows) {
                        console.log(`    - Sequence ${seq.seqs_no} (wf_steps_id: ${seq.wf_steps_id})`);

                        // Check job roles for this sequence
                        const jobRoles = await pool.query(`
                            SELECT wf_job_role_id, job_role_id, dept_id, emp_int_id
                            FROM "tblWFJobRole"
                            WHERE wf_steps_id = $1
                        `, [seq.wf_steps_id]);

                        console.log(`      Job Roles: ${jobRoles.rows.length}`);
                        if (jobRoles.rows.length === 0) {
                            console.log(`      ❌ NO JOB ROLES CONFIGURED FOR WORKFLOW STEP ${seq.wf_steps_id}`);
                        } else {
                            jobRoles.rows.forEach(jr => {
                                console.log(`        - Job Role: ${jr.job_role_id}, Dept: ${jr.dept_id}, User: ${jr.emp_int_id || 'NULL'}`);
                            });
                        }
                    }
                }
            } else {
                console.log(`  ⚠️  Asset not found`);
            }
            console.log('');
        }

        // Check AT001 specifically
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('CHECKING AT001 (ECG Machine) CONFIGURATION');
        console.log('═══════════════════════════════════════════════════════════\n');

        const at001Sequences = await pool.query(`
            SELECT wf_at_seqs_id, wf_steps_id, seqs_no, org_id
            FROM "tblWFATSeqs"
            WHERE asset_type_id = 'AT001'
            ORDER BY seqs_no
        `);

        console.log(`Workflow Sequences for AT001: ${at001Sequences.rows.length}\n`);
        if (at001Sequences.rows.length === 0) {
            console.log('❌ NO WORKFLOW SEQUENCES CONFIGURED FOR AT001!\n');
            console.log('This is why detail rows are not being created.');
            console.log('You need to configure workflow sequences in tblWFATSeqs for asset type AT001.\n');
        } else {
            for (const seq of at001Sequences.rows) {
                console.log(`Sequence ${seq.seqs_no}:`);
                console.log(`  wf_steps_id: ${seq.wf_steps_id}`);
                console.log(`  org_id: ${seq.org_id}`);

                const jobRoles = await pool.query(`
                    SELECT wf_job_role_id, job_role_id, dept_id, emp_int_id
                    FROM "tblWFJobRole"
                    WHERE wf_steps_id = $1
                `, [seq.wf_steps_id]);

                console.log(`  Job Roles: ${jobRoles.rows.length}`);
                if (jobRoles.rows.length === 0) {
                    console.log(`  ❌ NO JOB ROLES FOR THIS SEQUENCE!`);
                } else {
                    jobRoles.rows.forEach(jr => {
                        console.log(`    - Job Role: ${jr.job_role_id}, Dept: ${jr.dept_id}, User: ${jr.emp_int_id || 'NULL'}`);
                    });
                }
                console.log('');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkDetailCreation();


