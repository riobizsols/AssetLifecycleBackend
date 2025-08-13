const db = require('./config/db');

async function checkTableStructure() {
    try {
        console.log('🔍 Checking tblScrapSales_H table structure...');
        
        // Check if table exists and get its structure
        const tableQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'tblScrapSales_H' 
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        `;
        
        const result = await db.query(tableQuery);
        
        if (result.rows.length === 0) {
            console.log('❌ Table tblScrapSales_H does not exist!');
            return;
        }
        
        console.log('✅ Table structure:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        // Check for any array columns
        const arrayColumns = result.rows.filter(row => row.data_type.includes('ARRAY'));
        if (arrayColumns.length > 0) {
            console.log('⚠️ Found array columns that might cause issues:');
            arrayColumns.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('✅ No array columns found');
        }
        
    } catch (error) {
        console.error('❌ Error checking table structure:', error.message);
    } finally {
        await db.end();
    }
}

checkTableStructure().catch(console.error);
