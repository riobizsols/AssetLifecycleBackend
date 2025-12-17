/**
 * Setup maintenance frequencies for an asset type
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

async function setupMaintenanceFrequencies(targetAssetTypeId, sourceAssetTypeId = null) {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 SETTING UP MAINTENANCE FREQUENCIES');
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
        
        // Check if frequencies already exist
        const existingCheck = await dbPool.query(
            `SELECT COUNT(*) as count FROM "tblATMaintFreq" WHERE asset_type_id = $1`,
            [targetAssetTypeId]
        );
        
        if (parseInt(existingCheck.rows[0].count) > 0) {
            console.log(`⚠️  Maintenance frequencies already exist for ${targetAssetTypeId}`);
            const existingFreqs = await dbPool.query(
                `SELECT at_main_freq_id, frequency, uom, maint_type_id FROM "tblATMaintFreq" WHERE asset_type_id = $1`,
                [targetAssetTypeId]
            );
            console.log(`   Existing frequencies:\n`);
            for (const freq of existingFreqs.rows) {
                console.log(`   - ${freq.frequency} ${freq.uom} (type: ${freq.maint_type_id})`);
            }
            console.log('');
            return;
        }
        
        // Find source asset type to copy from
        let sourceFrequencies = null;
        
        if (sourceAssetTypeId) {
            const sourceCheck = await dbPool.query(
                `SELECT asset_type_id FROM "tblAssetTypes" WHERE asset_type_id = $1`,
                [sourceAssetTypeId]
            );
            
            if (sourceCheck.rows.length === 0) {
                console.log(`❌ Source asset type ${sourceAssetTypeId} not found!`);
                return;
            }
            
            sourceFrequencies = await dbPool.query(
                `SELECT frequency, uom, maint_type_id FROM "tblATMaintFreq" WHERE asset_type_id = $1`,
                [sourceAssetTypeId]
            );
            
            if (sourceFrequencies.rows.length === 0) {
                console.log(`❌ No frequencies found for source asset type ${sourceAssetTypeId}`);
                return;
            }
            
            console.log(`📋 Copying frequencies from ${sourceAssetTypeId}...\n`);
        } else {
            // Find an asset type with frequencies
            const exampleQuery = `
                SELECT DISTINCT asset_type_id 
                FROM "tblATMaintFreq" 
                WHERE org_id = $1
                LIMIT 1
            `;
            
            const exampleResult = await dbPool.query(exampleQuery, [targetAssetType.org_id]);
            
            if (exampleResult.rows.length === 0) {
                console.log(`❌ No example frequencies found for org_id ${targetAssetType.org_id}`);
                console.log(`   Please provide a source asset type ID to copy from.\n`);
                return;
            }
            
            sourceAssetTypeId = exampleResult.rows[0].asset_type_id;
            sourceFrequencies = await dbPool.query(
                `SELECT frequency, uom, maint_type_id FROM "tblATMaintFreq" WHERE asset_type_id = $1`,
                [sourceAssetTypeId]
            );
            
            console.log(`📋 Using frequencies from example asset type ${sourceAssetTypeId}...\n`);
        }
        
        // Get next at_main_freq_id
        const getNextId = async () => {
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
        
        // Create frequencies
        console.log(`Creating ${sourceFrequencies.rows.length} maintenance frequency(ies)...\n`);
        
        for (const freq of sourceFrequencies.rows) {
            const at_main_freq_id = await getNextId();
            
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
            
            // Generate text description if not provided
            const textValue = freq.text || `${freq.frequency} ${freq.uom} Maintenance`;
            const maintainedBy = freq.maintained_by || 'Vendor';
            const intStatus = freq.int_status !== undefined ? freq.int_status : 1;
            
            const insertResult = await dbPool.query(insertQuery, [
                at_main_freq_id,
                targetAssetTypeId,
                freq.frequency,
                freq.uom,
                freq.maint_type_id,
                targetAssetType.org_id,
                textValue,
                maintainedBy,
                intStatus
            ]);
            
            console.log(`   ✅ Created frequency: ${at_main_freq_id} - ${freq.frequency} ${freq.uom} (type: ${freq.maint_type_id})`);
        }
        
        console.log(`\n✅ Successfully created ${sourceFrequencies.rows.length} maintenance frequency(ies) for ${targetAssetTypeId}`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Verify the frequencies are correct`);
        console.log(`   2. Run the maintenance generation again\n`);
        
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
    console.log('Usage: node setup-maintenance-frequencies.js <target_asset_type_id> [source_asset_type_id]');
    console.log('Example: node setup-maintenance-frequencies.js AT059 AT062');
    process.exit(1);
}

setupMaintenanceFrequencies(targetAssetTypeId, sourceAssetTypeId)
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

