const db = require('./config/db');

async function setupAssetGroups() {
    try {
        console.log('Setting up asset group system...');

        // 1. Create tblAssetGroup_H table
        await db.query(`
            CREATE TABLE IF NOT EXISTS "tblAssetGroup_H" (
                assetgroup_h_id VARCHAR PRIMARY KEY,
                org_id VARCHAR NOT NULL,
                text VARCHAR NOT NULL,
                created_by VARCHAR NOT NULL,
                created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                changed_by VARCHAR,
                changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ tblAssetGroup_H table created');

        // 2. Create tblAssetGroup_D table
        await db.query(`
            CREATE TABLE IF NOT EXISTS "tblAssetGroup_D" (
                assetgroup_d_id VARCHAR PRIMARY KEY,
                assetgroup_h_id VARCHAR NOT NULL,
                asset_id VARCHAR NOT NULL,
                FOREIGN KEY (assetgroup_h_id) REFERENCES "tblAssetGroup_H"(assetgroup_h_id) ON DELETE CASCADE,
                FOREIGN KEY (asset_id) REFERENCES "tblAssets"(asset_id) ON DELETE CASCADE
            );
        `);
        console.log('✅ tblAssetGroup_D table created');

        // 3. Add ID sequences for asset group tables
        await db.query(`
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number, description)
            VALUES 
                ('asset_group_h', 'AGH', 0, 'Asset Group Header ID'),
                ('asset_group_d', 'AGD', 0, 'Asset Group Detail ID')
            ON CONFLICT (table_key) DO UPDATE SET
                prefix = EXCLUDED.prefix,
                description = EXCLUDED.description
        `);
        console.log('✅ Asset group ID sequences added');

        // 4. Verify the setup
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('tblAssetGroup_H', 'tblAssetGroup_D')
            AND table_schema = 'public'
        `);

        const sequencesResult = await db.query(`
            SELECT table_key, prefix, last_number, description 
            FROM "tblIDSequences" 
            WHERE table_key IN ('asset_group_h', 'asset_group_d')
        `);

        console.log('\n📊 Asset Group Setup Summary:');
        console.log(`Tables created: ${tablesResult.rows.length}`);
        console.log(`ID sequences added: ${sequencesResult.rows.length}`);

        console.log('\n🎉 Asset group system setup completed successfully!');
        console.log('You can now use the asset group APIs:');
        console.log('  POST /api/asset-groups - Create asset group');
        console.log('  GET /api/asset-groups - Get all asset groups');
        console.log('  GET /api/asset-groups/:id - Get asset group by ID');
        console.log('  PUT /api/asset-groups/:id - Update asset group');
        console.log('  DELETE /api/asset-groups/:id - Delete asset group');

    } catch (error) {
        console.error('❌ Error setting up asset group system:', error);
    } finally {
        process.exit(0);
    }
}

setupAssetGroups();
