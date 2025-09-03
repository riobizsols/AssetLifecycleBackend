const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/doc-type-objects';

async function testDocTypeObjectsAPI() {
    try {
        console.log('Testing Document Type Objects API...\n');

        // Test 1: Get all document type objects
        console.log('1. Testing GET /api/doc-type-objects');
        try {
            const response = await axios.get(BASE_URL);
            console.log('✅ Success:', response.status);
            console.log('Data count:', response.data.count);
            console.log('Sample data:', response.data.data.slice(0, 2));
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
        }

        // Test 2: Get common document type objects (object_type = '*')
        console.log('\n2. Testing GET /api/doc-type-objects/common');
        try {
            const response = await axios.get(`${BASE_URL}/common`);
            console.log('✅ Success:', response.status);
            console.log('Data count:', response.data.count);
            console.log('Note:', response.data.note);
            if (response.data.data.length > 0) {
                console.log('Sample common doc types:', response.data.data.slice(0, 2));
            }
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
        }

        // Test 3: Get document type objects by object type (includes wildcard *)
        console.log('\n3. Testing GET /api/doc-type-objects/object-type/asset');
        try {
            const response = await axios.get(`${BASE_URL}/object-type/asset`);
            console.log('✅ Success:', response.status);
            console.log('Data count:', response.data.count);
            console.log('Object type:', response.data.object_type);
            console.log('Includes common types:', response.data.includes_common);
            console.log('Note:', response.data.note);
            
            // Show the breakdown of specific vs common types
            const specificTypes = response.data.data.filter(item => item.object_type === 'asset');
            const commonTypes = response.data.data.filter(item => item.object_type === '*');
            console.log(`- Specific to 'asset': ${specificTypes.length}`);
            console.log(`- Common (*): ${commonTypes.length}`);
            
            if (response.data.data.length > 0) {
                console.log('Sample data:', response.data.data.slice(0, 2));
            }
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
        }

        // Test 4: Get document type objects by document type
        console.log('\n4. Testing GET /api/doc-type-objects/doc-type/invoice');
        try {
            const response = await axios.get(`${BASE_URL}/doc-type/invoice`);
            console.log('✅ Success:', response.status);
            console.log('Data count:', response.data.count);
            console.log('Document type:', response.data.doc_type);
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
        }

        // Test 5: Get document type object by ID
        console.log('\n5. Testing GET /api/doc-type-objects/1');
        try {
            const response = await axios.get(`${BASE_URL}/1`);
            console.log('✅ Success:', response.status);
            console.log('Data:', response.data.data);
        } catch (error) {
            console.log('❌ Error:', error.response?.status, error.response?.data?.message || error.message);
        }

        console.log('\n✅ API testing completed!');
        console.log('\n📝 Key Features:');
        console.log('- /object-type/:object_type now returns BOTH specific types AND common (*) types');
        console.log('- Common types are marked with object_type = "*"');
        console.log('- Results are ordered: specific types first, then common types');
        console.log('- New /common endpoint to get only universal document types');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testDocTypeObjectsAPI();
}

module.exports = testDocTypeObjectsAPI;
