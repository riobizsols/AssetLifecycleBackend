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

// Test function to get asset types with scrap assets
async function testGetAssetTypesWithScrapAssets() {
    try {
        console.log('\n🔍 Testing: Get Asset Types with Scrap Assets');
        const response = await axios.get(`${BASE_URL}/scrap-assets-by-type/asset-types/list`);
        console.log('✅ Success:', response.data.message);
        console.log('📊 Asset Types found:', response.data.count);
        if (response.data.asset_types && response.data.asset_types.length > 0) {
            console.log('📋 Asset Types:');
            response.data.asset_types.forEach(type => {
                console.log(`   - ${type.asset_type_name} (${type.asset_type_id}): ${type.scrap_count} scrap assets`);
            });
        }
        return response.data.asset_types;
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        return [];
    }
}

// Test function to get scrap assets by asset type
async function testGetScrapAssetsByAssetType(assetTypeId) {
    try {
        console.log(`\n🔍 Testing: Get Scrap Assets by Asset Type (${assetTypeId})`);
        const response = await axios.get(`${BASE_URL}/scrap-assets-by-type/${assetTypeId}`);
        console.log('✅ Success:', response.data.message);
        console.log('📊 Scrap assets found:', response.data.count);
        if (response.data.scrap_assets && response.data.scrap_assets.length > 0) {
            console.log('📋 Sample scrap assets:');
            response.data.scrap_assets.slice(0, 3).forEach(asset => {
                console.log(`   - ${asset.asset_name} (${asset.asset_id}): ${asset.serial_number}`);
            });
        }
        return response.data.scrap_assets;
    } catch (error) {
        console.log('❌ Error:', error.response?.data?.error || error.message);
        return [];
    }
}

// Test function to test with invalid asset type
async function testInvalidAssetType() {
    try {
        console.log('\n🔍 Testing: Invalid Asset Type ID');
        const response = await axios.get(`${BASE_URL}/scrap-assets-by-type/INVALID_ID`);
        console.log('❌ This should have failed but succeeded:', response.data);
    } catch (error) {
        if (error.response?.status === 404) {
            console.log('✅ Correctly handled invalid asset type ID');
        } else {
            console.log('❌ Unexpected error:', error.response?.data?.error || error.message);
        }
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting Scrap Assets By Type API Tests\n');
    
    // Test server connection
    const serverRunning = await testServerConnection();
    if (!serverRunning) {
        console.log('❌ Cannot proceed with tests - server is not running');
        console.log('💡 Please start the server with: npm start');
        return;
    }
    
    // Test getting asset types with scrap assets
    const assetTypes = await testGetAssetTypesWithScrapAssets();
    
    // Test getting scrap assets by asset type (if we have asset types)
    if (assetTypes.length > 0) {
        await testGetScrapAssetsByAssetType(assetTypes[0].asset_type_id);
    } else {
        console.log('\n⚠️  No asset types with scrap assets found - skipping asset type test');
    }
    
    // Test invalid asset type
    await testInvalidAssetType();
    
    console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error);
