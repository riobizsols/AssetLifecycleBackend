const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test function to check if server is running
async function testServerConnection() {
    try {
        const response = await axios.get(`${BASE_URL.replace('/api', '')}/`);
        console.log('✅ Server is running:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Server is not running or not accessible');
        return false;
    }
}

// Test function to get all scrap sales
async function testGetAllScrapSales() {
    try {
        console.log('\n🔍 Testing: Get All Scrap Sales');
        const response = await axios.get(`${BASE_URL}/scrap-sales`);
        console.log('✅ Success:', response.data.message);
        console.log('📊 Scrap sales found:', response.data.count);
        if (response.data.scrap_sales && response.data.scrap_sales.length > 0) {
            console.log('📋 Sample scrap sales:');
            response.data.scrap_sales.slice(0, 3).forEach(sale => {
                console.log(`   - ${sale.text} (${sale.ssh_id}): $${sale.total_sale_value} - ${sale.total_assets} assets`);
            });
        }
        return response.data.scrap_sales;
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        return [];
    }
}

// Test function to validate scrap assets
async function testValidateScrapAssets() {
    try {
        console.log('\n🔍 Testing: Validate Scrap Assets');
        const testAsdIds = ['ASD0001', 'ASD0002', 'ASD0003']; // Replace with actual IDs from your database
        
        const response = await axios.post(`${BASE_URL}/scrap-sales/validate-assets`, {
            asdIds: testAsdIds
        });
        
        console.log('✅ Success:', response.data.message);
        console.log('📊 Validation Results:');
        console.log(`   - Total requested: ${response.data.validation.total_requested}`);
        console.log(`   - Valid assets: ${response.data.validation.valid_assets}`);
        console.log(`   - Already sold: ${response.data.validation.already_sold}`);
        console.log(`   - Invalid assets: ${response.data.validation.invalid_assets}`);
        
        return response.data.validation;
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        return null;
    }
}

// Test function to get scrap sale by ID
async function testGetScrapSaleById(sshId) {
    try {
        console.log(`\n🔍 Testing: Get Scrap Sale by ID (${sshId})`);
        const response = await axios.get(`${BASE_URL}/scrap-sales/${sshId}`);
        console.log('✅ Success:', response.data.message);
        console.log('📊 Sale Details:');
        console.log(`   - SSH ID: ${response.data.scrap_sale.header.ssh_id}`);
        console.log(`   - Text: ${response.data.scrap_sale.header.text}`);
        console.log(`   - Total Value: $${response.data.scrap_sale.header.total_sale_value}`);
        console.log(`   - Buyer: ${response.data.scrap_sale.header.buyer_name}`);
        console.log(`   - Assets: ${response.data.scrap_sale.details.length}`);
        
        return response.data.scrap_sale;
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('✅ Correctly handled non-existent scrap sale ID');
        } else {
            console.log('❌ Error:', error.response?.data?.error || error.message);
        }
        return null;
    }
}

// Test function to create scrap sale (requires authentication)
async function testCreateScrapSale() {
    try {
        console.log('\n🔍 Testing: Create Scrap Sale (requires authentication)');
        
        // This is a mock test - in real scenario, you'd need authentication
        const mockSaleData = {
            text: "Test Bulk Laptop Sale",
            total_sale_value: 1500.00,
            buyer_name: "Test Buyer",
            buyer_company: "Test Company Inc.",
            buyer_phone: "+1-555-9999",
            sale_date: new Date().toISOString().split('T')[0],
            collection_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            invoice_no: "INV-TEST-001",
            po_no: "PO-TEST-001",
            scrapAssets: [
                {
                    asd_id: "ASD0001", // Replace with actual ID
                    sale_value: 500.00
                },
                {
                    asd_id: "ASD0002", // Replace with actual ID
                    sale_value: 1000.00
                }
            ]
        };

        console.log('📋 Mock sale data prepared (authentication required for actual test)');
        console.log('   - Text:', mockSaleData.text);
        console.log('   - Total Value:', mockSaleData.total_sale_value);
        console.log('   - Buyer:', mockSaleData.buyer_name);
        console.log('   - Assets:', mockSaleData.scrapAssets.length);
        
        // Note: This will fail without authentication, which is expected
        const response = await axios.post(`${BASE_URL}/scrap-sales`, mockSaleData);
        console.log('✅ Success:', response.data.message);
        return response.data.scrap_sale;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Correctly handled authentication requirement');
        } else {
            console.log('❌ Error:', error.response?.data?.error || error.message);
        }
        return null;
    }
}

// Test function to test invalid data
async function testInvalidData() {
    try {
        console.log('\n🔍 Testing: Invalid Data Validation');
        
        // Test with missing required fields
        const invalidData = {
            text: "Test Sale",
            // Missing total_sale_value, buyer_name, scrapAssets
        };

        const response = await axios.post(`${BASE_URL}/scrap-sales`, invalidData);
        console.log('❌ This should have failed but succeeded:', response.data);
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Correctly handled invalid data');
            console.log('   - Error:', error.response.data.error);
            console.log('   - Message:', error.response.data.message);
        } else {
            console.log('❌ Unexpected error:', error.response?.data?.error || error.message);
        }
    }
}

// Test function to test value mismatch
async function testValueMismatch() {
    try {
        console.log('\n🔍 Testing: Value Mismatch Validation');
        
        const mismatchData = {
            text: "Test Sale",
            total_sale_value: 2000.00, // Total doesn't match sum
            buyer_name: "Test Buyer",
            scrapAssets: [
                {
                    asd_id: "ASD0001",
                    sale_value: 500.00
                },
                {
                    asd_id: "ASD0002",
                    sale_value: 1000.00
                }
                // Sum is 1500, but total is 2000
            ]
        };

        const response = await axios.post(`${BASE_URL}/scrap-sales`, mismatchData);
        console.log('❌ This should have failed but succeeded:', response.data);
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Correctly handled value mismatch');
            console.log('   - Error:', error.response.data.error);
            console.log('   - Message:', error.response.data.message);
        } else {
            console.log('❌ Unexpected error:', error.response?.data?.error || error.message);
        }
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting Scrap Sales API Tests\n');
    
    // Test server connection
    const serverRunning = await testServerConnection();
    if (!serverRunning) {
        console.log('❌ Cannot proceed with tests - server is not running');
        console.log('💡 Please start the server with: npm start');
        return;
    }
    
    // Test getting all scrap sales
    const scrapSales = await testGetAllScrapSales();
    
    // Test validating scrap assets
    await testValidateScrapAssets();
    
    // Test getting specific scrap sale (if we have any)
    if (scrapSales.length > 0) {
        await testGetScrapSaleById(scrapSales[0].ssh_id);
    } else {
        console.log('\n⚠️  No scrap sales found - skipping get by ID test');
    }
    
    // Test creating scrap sale (will fail without auth, which is expected)
    await testCreateScrapSale();
    
    // Test invalid data validation
    await testInvalidData();
    
    // Test value mismatch validation
    await testValueMismatch();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Notes:');
    console.log('   - Create endpoint requires authentication');
    console.log('   - Replace ASD IDs with actual scrap asset IDs from your database');
    console.log('   - Some tests may fail if no data exists in the database');
}

// Run the tests
runTests().catch(console.error);
