/**
 * Check available workflow steps that can be used for asset types
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

async function checkWorkflowSteps() {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔍 CHECKING AVAILABLE WORKFLOW STEPS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Get all workflow steps
        const stepsQuery = `
            SELECT 
                wf_steps_id,
                text as step_name,
                org_id
            FROM "tblWFSteps"
            ORDER BY wf_steps_id
        `;
        
        const stepsResult = await dbPool.query(stepsQuery);
        
        console.log(`📋 Available Workflow Steps (${stepsResult.rows.length} total):\n`);
        if (stepsResult.rows.length === 0) {
            console.log('   ❌ No workflow steps found in tblWFSteps');
            console.log('   💡 You need to create workflow steps first.\n');
        } else {
            for (const step of stepsResult.rows) {
                console.log(`   - ${step.wf_steps_id}: ${step.step_name || 'N/A'} (org_id: ${step.org_id})`);
            }
        }
        
        // Check example workflow sequences from other asset types
        const exampleQuery = `
            SELECT DISTINCT
                wf.asset_type_id,
                at.text as asset_type_name,
                COUNT(wf.wf_at_seqs_id) as sequence_count
            FROM "tblWFATSeqs" wf
            LEFT JOIN "tblAssetTypes" at ON wf.asset_type_id = at.asset_type_id
            GROUP BY wf.asset_type_id, at.text
            ORDER BY sequence_count DESC
            LIMIT 5
        `;
        
        const exampleResult = await dbPool.query(exampleQuery);
        
        console.log(`\n📊 Example Asset Types with Workflow Sequences:\n`);
        if (exampleResult.rows.length === 0) {
            console.log('   No examples found. You may need to create the first workflow sequence.\n');
        } else {
            for (const example of exampleResult.rows) {
                console.log(`   - ${example.asset_type_id} (${example.asset_type_name || 'N/A'}): ${example.sequence_count} sequence(s)`);
            }
        }
        
        // Show a sample workflow sequence structure
        if (exampleResult.rows.length > 0) {
            const sampleQuery = `
                SELECT 
                    wf_at_seqs_id,
                    asset_type_id,
                    wf_steps_id,
                    seqs_no,
                    org_id
                FROM "tblWFATSeqs"
                WHERE asset_type_id = $1
                ORDER BY seqs_no
                LIMIT 3
            `;
            
            const sampleResult = await dbPool.query(sampleQuery, [exampleResult.rows[0].asset_type_id]);
            
            console.log(`\n📝 Sample Workflow Sequence Structure for ${exampleResult.rows[0].asset_type_id}:\n`);
            for (const sample of sampleResult.rows) {
                console.log(`   Sequence ${sample.seqs_no}:`);
                console.log(`      - wf_at_seqs_id: ${sample.wf_at_seqs_id}`);
                console.log(`      - wf_steps_id: ${sample.wf_steps_id}`);
                console.log(`      - org_id: ${sample.org_id}\n`);
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════════\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('   Stack:', error.stack);
    }
}

checkWorkflowSteps()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

