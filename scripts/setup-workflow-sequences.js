/**
 * Setup workflow sequences for an asset type
 * This script creates workflow sequences based on an example asset type
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

async function setupWorkflowSequences(targetAssetTypeId, sourceAssetTypeId = null) {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 SETTING UP WORKFLOW SEQUENCES');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Check if target asset type exists
        const assetTypeCheck = await dbPool.query(
            `SELECT asset_type_id, text, org_id FROM "tblAssetTypes" WHERE asset_type_id = $1`,
            [targetAssetTypeId]
        );
        
        if (assetTypeCheck.rows.length === 0) {
            console.log(`❌ Asset type ${targetAssetTypeId} not found!`);
            return;
        }
        
        const targetAssetType = assetTypeCheck.rows[0];
        console.log(`📦 Target Asset Type: ${targetAssetTypeId} (${targetAssetType.text})`);
        console.log(`   Org ID: ${targetAssetType.org_id}\n`);
        
        // Check if sequences already exist
        const existingCheck = await dbPool.query(
            `SELECT COUNT(*) as count FROM "tblWFATSeqs" WHERE asset_type_id = $1`,
            [targetAssetTypeId]
        );
        
        if (parseInt(existingCheck.rows[0].count) > 0) {
            console.log(`⚠️  Workflow sequences already exist for ${targetAssetTypeId}`);
            console.log(`   Use the diagnose script to check the configuration.\n`);
            return;
        }
        
        // Find source asset type to copy from
        let sourceSequences = null;
        
        if (sourceAssetTypeId) {
            const sourceCheck = await dbPool.query(
                `SELECT asset_type_id FROM "tblAssetTypes" WHERE asset_type_id = $1`,
                [sourceAssetTypeId]
            );
            
            if (sourceCheck.rows.length === 0) {
                console.log(`❌ Source asset type ${sourceAssetTypeId} not found!`);
                return;
            }
            
            sourceSequences = await dbPool.query(
                `SELECT wf_steps_id, seqs_no, org_id FROM "tblWFATSeqs" WHERE asset_type_id = $1 ORDER BY seqs_no`,
                [sourceAssetTypeId]
            );
            
            if (sourceSequences.rows.length === 0) {
                console.log(`❌ No sequences found for source asset type ${sourceAssetTypeId}`);
                return;
            }
            
            console.log(`📋 Copying sequences from ${sourceAssetTypeId}...\n`);
        } else {
            // Find an asset type with sequences
            const exampleQuery = `
                SELECT DISTINCT asset_type_id 
                FROM "tblWFATSeqs" 
                WHERE org_id = $1
                LIMIT 1
            `;
            
            const exampleResult = await dbPool.query(exampleQuery, [targetAssetType.org_id]);
            
            if (exampleResult.rows.length === 0) {
                console.log(`❌ No example sequences found for org_id ${targetAssetType.org_id}`);
                console.log(`   Please provide a source asset type ID to copy from.\n`);
                return;
            }
            
            sourceAssetTypeId = exampleResult.rows[0].asset_type_id;
            sourceSequences = await dbPool.query(
                `SELECT wf_steps_id, seqs_no, org_id FROM "tblWFATSeqs" WHERE asset_type_id = $1 ORDER BY seqs_no`,
                [sourceAssetTypeId]
            );
            
            console.log(`📋 Using sequences from example asset type ${sourceAssetTypeId}...\n`);
        }
        
        // Get next wf_at_seqs_id
        const getNextId = async () => {
            const idQuery = `
                SELECT wf_at_seqs_id 
                FROM "tblWFATSeqs" 
                ORDER BY CAST(SUBSTRING(wf_at_seqs_id FROM '\\d+$') AS INTEGER) DESC 
                LIMIT 1
            `;
            
            const idResult = await dbPool.query(idQuery);
            
            if (idResult.rows.length === 0) {
                return 'WFAS001';
            }
            
            const lastId = idResult.rows[0].wf_at_seqs_id;
            const match = lastId.match(/\d+/);
            if (match) {
                const nextNum = parseInt(match[0]) + 1;
                return `WFAS${String(nextNum).padStart(3, '0')}`;
            }
            
            return 'WFAS001';
        };
        
        // Create sequences
        console.log(`Creating ${sourceSequences.rows.length} workflow sequence(s)...\n`);
        
        for (const seq of sourceSequences.rows) {
            const wf_at_seqs_id = await getNextId();
            
            const insertQuery = `
                INSERT INTO "tblWFATSeqs" (
                    wf_at_seqs_id,
                    asset_type_id,
                    wf_steps_id,
                    seqs_no,
                    org_id
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            
            const insertResult = await dbPool.query(insertQuery, [
                wf_at_seqs_id,
                targetAssetTypeId,
                seq.wf_steps_id,
                seq.seqs_no,
                targetAssetType.org_id
            ]);
            
            console.log(`   ✅ Created sequence ${seq.seqs_no}: ${wf_at_seqs_id} (wf_steps_id: ${seq.wf_steps_id})`);
        }
        
        console.log(`\n✅ Successfully created ${sourceSequences.rows.length} workflow sequence(s) for ${targetAssetTypeId}`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Verify the sequences are correct`);
        console.log(`   2. Ensure job roles are configured in tblWFJobRole for each wf_steps_id`);
        console.log(`   3. Run the maintenance generation again\n`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

// Run the setup
const args = process.argv.slice(2);
const targetAssetTypeId = args[0] ? args[0].toUpperCase() : null;
const sourceAssetTypeId = args[1] ? args[1].toUpperCase() : null;

if (!targetAssetTypeId) {
    console.log('Usage: node setup-workflow-sequences.js <target_asset_type_id> [source_asset_type_id]');
    console.log('Example: node setup-workflow-sequences.js AT059 AT062');
    process.exit(1);
}

setupWorkflowSequences(targetAssetTypeId, sourceAssetTypeId)
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

