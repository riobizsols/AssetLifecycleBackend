const db = require('./config/db');

async function fixTableStructure() {
    const client = await db.connect();
    
    try {
        console.log('🔧 Fixing tblScrapSales_H table structure...');
        
        // Check current structure
        const checkQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tblScrapSales_H' 
            AND column_name = 'total_sale_value';
        `;
        
        const checkResult = await client.query(checkQuery);
        console.log('📋 Current total_sale_value type:', checkResult.rows[0]?.data_type);
        
        if (checkResult.rows[0]?.data_type === 'ARRAY') {
            console.log('🔧 Converting total_sale_value from ARRAY to NUMERIC...');
            
            // Alter the column type
            const alterQuery = `
                ALTER TABLE "tblScrapSales_H" 
                ALTER COLUMN total_sale_value TYPE NUMERIC(10,2) 
                USING total_sale_value[1]::NUMERIC(10,2);
            `;
            
            await client.query(alterQuery);
            console.log('✅ Successfully converted total_sale_value to NUMERIC(10,2)');
            
            // Verify the change
            const verifyResult = await client.query(checkQuery);
            console.log('📋 New total_sale_value type:', verifyResult.rows[0]?.data_type);
            
        } else {
            console.log('✅ total_sale_value is already the correct type');
        }
        
    } catch (error) {
        console.error('❌ Error fixing table structure:', error.message);
        console.log('💡 You may need to run this as a database administrator');
    } finally {
        client.release();
        await db.end();
    }
}

fixTableStructure().catch(console.error);
