const db = require('./config/db');

// Simulate the new SSD ID generation logic
async function testSsdIdGeneration() {
    try {
        console.log('🔍 Testing new SSD ID generation approach...\n');
        
        // Simulate getting base SSD ID
        const baseQuery = `
            SELECT COALESCE(MAX(CAST(SUBSTRING(ssd_id FROM 4) AS INTEGER)), 0) + 1 as next_seq
            FROM "tblScrapSales_D"
            WHERE ssd_id LIKE 'SSD%'
        `;
        
        const baseResult = await db.query(baseQuery);
        const baseNumber = baseResult.rows[0].next_seq;
        const baseSsdId = `SSD${baseNumber.toString().padStart(4, '0')}`;
        
        console.log(`📋 Base SSD ID: ${baseSsdId} (number: ${baseNumber})`);
        
        // Simulate generating multiple IDs for multiple assets
        const assetCount = 3;
        const generatedIds = [];
        
        for (let i = 0; i < assetCount; i++) {
            const ssd_id = `SSD${(baseNumber + i).toString().padStart(4, '0')}`;
            generatedIds.push(ssd_id);
            console.log(`🔢 Generated SSD ID for asset ${i + 1}: ${ssd_id}`);
        }
        
        console.log('\n📋 All generated IDs:', generatedIds);
        
        // Check for duplicates
        const uniqueIds = new Set(generatedIds);
        if (uniqueIds.size === generatedIds.length) {
            console.log('✅ No duplicate IDs generated');
        } else {
            console.log('❌ Duplicate IDs found!');
        }
        
        // Check if they're sequential
        const sequential = generatedIds.every((id, index) => {
            if (index === 0) return true;
            const current = parseInt(id.substring(3));
            const previous = parseInt(generatedIds[index - 1].substring(3));
            return current === previous + 1;
        });
        
        console.log(`Sequential IDs: ${sequential ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('❌ Error testing SSD ID generation:', error.message);
    } finally {
        await db.end();
    }
}

testSsdIdGeneration().catch(console.error);
