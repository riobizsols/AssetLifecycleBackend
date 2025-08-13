const db = require('./config/db');

async function setupDepreciation() {
    try {
        console.log('Setting up depreciation system...');

        // 1. Add only depreciation_method column to tblAssetTypes table
        await db.query(`
            ALTER TABLE "tblAssetTypes"
            ADD COLUMN IF NOT EXISTS depreciation_method VARCHAR(2) DEFAULT 'ND';
        `);
        console.log('✅ Depreciation method column added to tblAssetTypes');

        // 2. Add depreciation columns to tblAssets table
        await db.query(`
            ALTER TABLE "tblAssets"
            ADD COLUMN IF NOT EXISTS salvage_value REAL DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS useful_life_years INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS depreciation_rate REAL DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS current_book_value REAL DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS accumulated_depreciation REAL DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS last_depreciation_calc_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS depreciation_start_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;
        `);
        console.log('✅ Depreciation columns added to tblAssets');

        // 3. Create tblAssetDepHist table for tracking depreciation history
        await db.query(`
            CREATE TABLE IF NOT EXISTS "tblAssetDepHist" (
                depreciation_id VARCHAR PRIMARY KEY,
                asset_id VARCHAR NOT NULL,
                org_id VARCHAR NOT NULL,
                depreciation_date DATE NOT NULL,
                depreciation_amount DECIMAL(15,2) NOT NULL,
                book_value_before DECIMAL(15,2) NOT NULL,
                book_value_after DECIMAL(15,2) NOT NULL,
                depreciation_method VARCHAR(2) NOT NULL,
                depreciation_rate DECIMAL(5,2) NOT NULL,
                useful_life_years INTEGER NOT NULL,
                salvage_value DECIMAL(15,2) NOT NULL,
                original_cost DECIMAL(15,2) NOT NULL,
                created_by VARCHAR NOT NULL,
                created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                changed_by VARCHAR,
                changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (asset_id) REFERENCES "tblAssets"(asset_id) ON DELETE CASCADE
            );
        `);
        console.log('✅ tblAssetDepHist table created');

        // 4. Create tblDepreciationSettings table for organization-wide settings
        await db.query(`
            CREATE TABLE IF NOT EXISTS "tblDepreciationSettings" (
                setting_id VARCHAR PRIMARY KEY,
                org_id VARCHAR NOT NULL,
                fiscal_year_start_month INTEGER DEFAULT 1,
                fiscal_year_start_day INTEGER DEFAULT 1,
                depreciation_calculation_frequency VARCHAR(20) DEFAULT 'MONTHLY',
                auto_calculate_depreciation BOOLEAN DEFAULT true,
                created_by VARCHAR NOT NULL,
                created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                changed_by VARCHAR,
                changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ tblDepreciationSettings table created');

        // 5. Insert default depreciation settings for existing organizations
        await db.query(`
            INSERT INTO "tblDepreciationSettings" (setting_id, org_id, fiscal_year_start_month, fiscal_year_start_day, depreciation_calculation_frequency, auto_calculate_depreciation, created_by)
            VALUES
                ('DS001', 'ORG001', 1, 1, 'MONTHLY', true, 'SYSTEM'),
                ('DS002', 'ORG002', 1, 1, 'MONTHLY', true, 'SYSTEM')
            ON CONFLICT (setting_id) DO UPDATE SET
                fiscal_year_start_month = EXCLUDED.fiscal_year_start_month,
                fiscal_year_start_day = EXCLUDED.fiscal_year_start_day,
                depreciation_calculation_frequency = EXCLUDED.depreciation_calculation_frequency,
                auto_calculate_depreciation = EXCLUDED.auto_calculate_depreciation,
                changed_by = EXCLUDED.created_by,
                changed_on = CURRENT_TIMESTAMP;
        `);
        console.log('✅ Default depreciation settings inserted');

        // 6. Update existing assets with default depreciation values
        await db.query(`
            UPDATE "tblAssets"
            SET
                current_book_value = COALESCE(purchased_cost, 0),
                useful_life_years = 5,
                depreciation_rate = 0.00,
                depreciation_start_date = COALESCE(purchased_on, CURRENT_TIMESTAMP)
            WHERE current_book_value IS NULL OR current_book_value = 0;
        `);
        console.log('✅ Existing assets updated with default depreciation values');

        // 7. Update existing asset types with default depreciation method
        await db.query(`
            UPDATE "tblAssetTypes"
            SET depreciation_method = 'ND'
            WHERE depreciation_method IS NULL;
        `);
        console.log('✅ Existing asset types updated with default depreciation method');

        console.log('\n📊 Depreciation System Setup Complete!');
        console.log('✅ Database tables and columns created');
        console.log('✅ Default settings configured');
        console.log('✅ Existing data updated');
        console.log('\n🎉 Depreciation system is ready for use!');

    } catch (error) {
        console.error('❌ Error setting up depreciation system:', error);
        throw error;
    }
}

// Export for use in other files
module.exports = { setupDepreciation };

// Run setup if this file is executed directly
if (require.main === module) {
    setupDepreciation()
        .then(() => {
            console.log('Depreciation setup completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Depreciation setup failed:', error);
            process.exit(1);
        });
}
