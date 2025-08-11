const db = require('./config/db');

async function setupAssetGroupIds() {
    try {
        console.log('Setting up asset group ID sequences...');

        // Add ID sequences for asset group tables
        await db.query(`
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number, description)
            VALUES 
                ('asset_group_h', 'AGH', 0, 'Asset Group Header ID'),
                ('asset_group_d', 'AGD', 0, 'Asset Group Detail ID')
            ON CONFLICT (table_key) DO UPDATE SET
                prefix = EXCLUDED.prefix,
                description = EXCLUDED.description
        `);

        console.log('✅ Asset group ID sequences added successfully');

        // Verify the sequences
        const result = await db.query(`
            SELECT table_key, prefix, last_number, description 
            FROM "tblIDSequences" 
            WHERE table_key IN ('asset_group_h', 'asset_group_d')
        `);

        console.log('📊 Asset Group ID Sequences:');
        result.rows.forEach(row => {
            console.log(`  ${row.table_key}: ${row.prefix} (${row.description})`);
        });

    } catch (error) {
        console.error('❌ Error setting up asset group ID sequences:', error);
    } finally {
        process.exit(0);
    }
}

setupAssetGroupIds();
