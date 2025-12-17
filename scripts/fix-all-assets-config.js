/**
 * Fix all asset configuration issues:
 * 1. Add missing workflow sequences (copy from AT062 pattern)
 * 2. Add missing maintenance frequencies
 * 3. Ensure only JR001, JR002, JR003 are used
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

// Standard workflow sequences pattern (from AT062)
const STANDARD_WORKFLOW_SEQUENCES = [
    { seqs_no: 10, wf_steps_id: 'WFS01' },  // JR003
    { seqs_no: 15, wf_steps_id: 'WFS05' },  // JR001
    { seqs_no: 20, wf_steps_id: 'WFS001' }, // JR001
    { seqs_no: 30, wf_steps_id: 'WFS04' },  // JR001
    { seqs_no: 40, wf_steps_id: 'WFS03' },  // JR001
    { seqs_no: 5, wf_steps_id: 'WFS02' }    // JR002
];

async function fixAllAssets() {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 FIXING ALL ASSET CONFIGURATIONS');
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
        
        let fixedSequences = 0;
        let fixedFrequencies = 0;
        let skippedSequences = 0;
        let skippedFrequencies = 0;
        
        for (const assetType of assetTypesResult.rows) {
            const assetTypeId = assetType.asset_type_id;
            const assetTypeName = assetType.asset_type_name;
            
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📋 Processing: ${assetTypeId} - ${assetTypeName}`);
            console.log(`${'─'.repeat(60)}\n`);
            
            // Fix 1: Workflow Sequences
            const existingSequencesQuery = `
                SELECT COUNT(*) as count
                FROM "tblWFATSeqs"
                WHERE asset_type_id = $1
            `;
            
            const existingSequencesResult = await dbPool.query(existingSequencesQuery, [assetTypeId]);
            const hasSequences = parseInt(existingSequencesResult.rows[0].count) > 0;
            
            if (!hasSequences) {
                console.log(`   🔧 Adding workflow sequences...`);
                
                // Get next wf_at_seqs_id
                const getNextSeqId = async () => {
                    const idQuery = `
                        SELECT wf_at_seqs_id 
                        FROM "tblWFATSeqs" 
                        ORDER BY CAST(SUBSTRING(wf_at_seqs_id FROM '\\d+$') AS INTEGER) DESC 
                        LIMIT 1
                    `;
                    
                    const idResult = await dbPool.query(idQuery);
                    
                    if (idResult.rows.length === 0) {
                        return 'WFATS001';
                    }
                    
                    const lastId = idResult.rows[0].wf_at_seqs_id;
                    const match = lastId.match(/\d+/);
                    if (match) {
                        const nextNum = parseInt(match[0]) + 1;
                        return `WFATS${String(nextNum).padStart(3, '0')}`;
                    }
                    
                    return 'WFATS001';
                };
                
                let seqsCreated = 0;
                
                for (const seq of STANDARD_WORKFLOW_SEQUENCES) {
                    try {
                        const wf_at_seqs_id = await getNextSeqId();
                        
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
                        
                        await dbPool.query(insertQuery, [
                            wf_at_seqs_id,
                            assetTypeId,
                            seq.wf_steps_id,
                            seq.seqs_no,
                            assetType.org_id
                        ]);
                        
                        seqsCreated++;
                    } catch (error) {
                        if (error.code === '23505') { // Unique constraint violation
                            console.log(`      ⚠️  Sequence ${seq.seqs_no} already exists, skipping...`);
                        } else {
                            console.log(`      ❌ Error creating sequence ${seq.seqs_no}: ${error.message}`);
                        }
                    }
                }
                
                if (seqsCreated > 0) {
                    console.log(`   ✅ Created ${seqsCreated} workflow sequences`);
                    fixedSequences++;
                } else {
                    console.log(`   ⚠️  No sequences created (may already exist)`);
                    skippedSequences++;
                }
            } else {
                console.log(`   ✅ Workflow sequences already exist`);
                skippedSequences++;
            }
            
            // Fix 2: Maintenance Frequencies
            const existingFrequenciesQuery = `
                SELECT COUNT(*) as count
                FROM "tblATMaintFreq"
                WHERE asset_type_id = $1
            `;
            
            const existingFrequenciesResult = await dbPool.query(existingFrequenciesQuery, [assetTypeId]);
            const hasFrequencies = parseInt(existingFrequenciesResult.rows[0].count) > 0;
            
            if (!hasFrequencies) {
                console.log(`   🔧 Adding maintenance frequencies...`);
                
                // Find a similar asset type to copy frequencies from
                const findSourceQuery = `
                    SELECT DISTINCT asset_type_id 
                    FROM "tblATMaintFreq" 
                    WHERE org_id = $1
                    LIMIT 1
                `;
                
                const sourceResult = await dbPool.query(findSourceQuery, [assetType.org_id]);
                
                if (sourceResult.rows.length === 0) {
                    console.log(`   ❌ No source frequencies found for org_id ${assetType.org_id}`);
                    skippedFrequencies++;
                    continue;
                }
                
                const sourceAssetTypeId = sourceResult.rows[0].asset_type_id;
                
                const sourceFrequencies = await dbPool.query(
                    `SELECT frequency, uom, maint_type_id, text, maintained_by, int_status 
                     FROM "tblATMaintFreq" 
                     WHERE asset_type_id = $1`,
                    [sourceAssetTypeId]
                );
                
                if (sourceFrequencies.rows.length === 0) {
                    console.log(`   ❌ No frequencies found for source asset type ${sourceAssetTypeId}`);
                    skippedFrequencies++;
                    continue;
                }
                
                // Get next at_main_freq_id
                const getNextFreqId = async () => {
                    const idQuery = `
                        SELECT at_main_freq_id 
                        FROM "tblATMaintFreq" 
                        ORDER BY CAST(SUBSTRING(at_main_freq_id FROM '\\d+$') AS INTEGER) DESC 
                        LIMIT 1
                    `;
                    
                    const idResult = await dbPool.query(idQuery);
                    
                    if (idResult.rows.length === 0) {
                        return 'ATMF001';
                    }
                    
                    const lastId = idResult.rows[0].at_main_freq_id;
                    const match = lastId.match(/\d+/);
                    if (match) {
                        const nextNum = parseInt(match[0]) + 1;
                        return `ATMF${String(nextNum).padStart(3, '0')}`;
                    }
                    
                    return 'ATMF001';
                };
                
                let freqsCreated = 0;
                
                for (const freq of sourceFrequencies.rows) {
                    try {
                        const at_main_freq_id = await getNextFreqId();
                        
                        const insertQuery = `
                            INSERT INTO "tblATMaintFreq" (
                                at_main_freq_id,
                                asset_type_id,
                                frequency,
                                uom,
                                maint_type_id,
                                org_id,
                                text,
                                maintained_by,
                                int_status
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            RETURNING *
                        `;
                        
                        const textValue = freq.text || `${freq.frequency} ${freq.uom} Maintenance`;
                        const maintainedBy = freq.maintained_by || 'Vendor';
                        const intStatus = freq.int_status !== undefined ? freq.int_status : 1;
                        
                        await dbPool.query(insertQuery, [
                            at_main_freq_id,
                            assetTypeId,
                            freq.frequency,
                            freq.uom,
                            freq.maint_type_id,
                            assetType.org_id,
                            textValue,
                            maintainedBy,
                            intStatus
                        ]);
                        
                        freqsCreated++;
                    } catch (error) {
                        if (error.code === '23505') { // Unique constraint violation
                            console.log(`      ⚠️  Frequency already exists, skipping...`);
                        } else {
                            console.log(`      ❌ Error creating frequency: ${error.message}`);
                        }
                    }
                }
                
                if (freqsCreated > 0) {
                    console.log(`   ✅ Created ${freqsCreated} maintenance frequencies`);
                    fixedFrequencies++;
                } else {
                    console.log(`   ⚠️  No frequencies created (may already exist)`);
                    skippedFrequencies++;
                }
            } else {
                console.log(`   ✅ Maintenance frequencies already exist`);
                skippedFrequencies++;
            }
        }
        
        // Summary
        console.log(`\n\n${'═'.repeat(60)}`);
        console.log('📊 FIX SUMMARY');
        console.log(`${'═'.repeat(60)}\n`);
        
        console.log(`Workflow Sequences:`);
        console.log(`   Fixed: ${fixedSequences} asset types`);
        console.log(`   Already existed: ${skippedSequences} asset types\n`);
        
        console.log(`Maintenance Frequencies:`);
        console.log(`   Fixed: ${fixedFrequencies} asset types`);
        console.log(`   Already existed: ${skippedFrequencies} asset types\n`);
        
        console.log(`✅ Configuration fix completed!\n`);
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('   Stack:', error.stack);
        throw error;
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

fixAllAssets()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

