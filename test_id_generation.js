const db = require('./config/db');

// Import the ID generation functions
const { generateSshId, generateSsdId } = require('./models/scrapSalesModel');

async function testIdGeneration() {
    try {
        console.log('🔍 Testing SSH and SSD ID Generation\n');
        
        // Test SSH ID generation
        console.log('📋 Testing SSH ID generation...');
        const sshId = await generateSshId();
        console.log(`✅ Generated SSH ID: ${sshId}`);
        
        // Verify SSH ID format
        if (sshId.startsWith('SSH') && sshId.length === 7) {
            console.log('✅ SSH ID format is correct (SSH + 4 digits)');
        } else {
            console.log('❌ SSH ID format is incorrect');
        }
        
        // Test SSD ID generation
        console.log('\n📋 Testing SSD ID generation...');
        const ssdId = await generateSsdId();
        console.log(`✅ Generated SSD ID: ${ssdId}`);
        
        // Verify SSD ID format
        if (ssdId.startsWith('SSD') && ssdId.length === 7) {
            console.log('✅ SSD ID format is correct (SSD + 4 digits)');
        } else {
            console.log('❌ SSD ID format is incorrect');
        }
        
        // Test multiple generations to see sequence
        console.log('\n📋 Testing multiple ID generations...');
        const sshIds = [];
        const ssdIds = [];
        
        for (let i = 0; i < 3; i++) {
            sshIds.push(await generateSshId());
            ssdIds.push(await generateSsdId());
        }
        
        console.log('SSH IDs generated:', sshIds);
        console.log('SSD IDs generated:', ssdIds);
        
        // Check if they're sequential
        const sshSequential = sshIds.every((id, index) => {
            if (index === 0) return true;
            const current = parseInt(id.substring(3));
            const previous = parseInt(sshIds[index - 1].substring(3));
            return current === previous + 1;
        });
        
        const ssdSequential = ssdIds.every((id, index) => {
            if (index === 0) return true;
            const current = parseInt(id.substring(3));
            const previous = parseInt(ssdIds[index - 1].substring(3));
            return current === previous + 1;
        });
        
        console.log(`SSH IDs sequential: ${sshSequential ? '✅' : '❌'}`);
        console.log(`SSD IDs sequential: ${ssdSequential ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('❌ Error testing ID generation:', error.message);
    } finally {
        await db.end();
    }
}

testIdGeneration().catch(console.error);
