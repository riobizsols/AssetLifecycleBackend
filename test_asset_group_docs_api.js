const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

// Test data
const TEST_ASSET_GROUP_ID = 'AGH001'; // Replace with actual asset group ID
const TEST_ORG_ID = 'ORG001'; // Replace with actual org ID

// Create axios instance with auth header
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test functions
async function testUploadDocument() {
  console.log('🧪 Testing document upload...');
  
  try {
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-document.txt');
    fs.writeFileSync(testFilePath, 'This is a test document for asset group.');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('asset_group_id', TEST_ASSET_GROUP_ID);
    formData.append('doc_type', 'invoice');
    formData.append('doc_type_name', 'Purchase Invoice');
    formData.append('org_id', TEST_ORG_ID);

    const response = await axios.post(`${BASE_URL}/asset-group-docs/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${TEST_TOKEN}`
      }
    });

    console.log('✅ Upload successful:', response.data);
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    return response.data.document.agd_id;
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
    return null;
  }
}

async function testListDocuments() {
  console.log('🧪 Testing document listing...');
  
  try {
    const response = await api.get(`/asset-group-docs/${TEST_ASSET_GROUP_ID}`);
    console.log('✅ List documents successful:', response.data);
    return response.data.documents;
  } catch (error) {
    console.error('❌ List documents failed:', error.response?.data || error.message);
    return [];
  }
}

async function testListDocumentsByType() {
  console.log('🧪 Testing document listing by type...');
  
  try {
    const response = await api.get(`/asset-group-docs/${TEST_ASSET_GROUP_ID}?doc_type=invoice`);
    console.log('✅ List documents by type successful:', response.data);
    return response.data.documents;
  } catch (error) {
    console.error('❌ List documents by type failed:', error.response?.data || error.message);
    return [];
  }
}

async function testGetDocumentById(agd_id) {
  console.log('🧪 Testing get document by ID...');
  
  try {
    const response = await api.get(`/asset-group-docs/document/${agd_id}`);
    console.log('✅ Get document by ID successful:', response.data);
    return response.data.document;
  } catch (error) {
    console.error('❌ Get document by ID failed:', error.response?.data || error.message);
    return null;
  }
}

async function testGetDownloadUrl(agd_id, mode = 'view') {
  console.log(`🧪 Testing get ${mode} URL...`);
  
  try {
    const response = await api.get(`/asset-group-docs/${agd_id}/download?mode=${mode}`);
    console.log(`✅ Get ${mode} URL successful:`, response.data);
    return response.data.url;
  } catch (error) {
    console.error(`❌ Get ${mode} URL failed:`, error.response?.data || error.message);
    return null;
  }
}

async function testArchiveDocument(agd_id) {
  console.log('🧪 Testing document archiving...');
  
  try {
    const response = await api.put(`/asset-group-docs/${agd_id}/archive`, {
      archived_path: 'archived/path/test-document.txt'
    });
    console.log('✅ Archive document successful:', response.data);
    return response.data.document;
  } catch (error) {
    console.error('❌ Archive document failed:', error.response?.data || error.message);
    return null;
  }
}

async function testDeleteDocument(agd_id) {
  console.log('🧪 Testing document deletion...');
  
  try {
    const response = await api.delete(`/asset-group-docs/${agd_id}`);
    console.log('✅ Delete document successful:', response.data);
    return response.data.document;
  } catch (error) {
    console.error('❌ Delete document failed:', error.response?.data || error.message);
    return null;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Asset Group Documents API Tests...\n');
  
  // Test 1: Upload document
  const uploadedDocId = await testUploadDocument();
  if (!uploadedDocId) {
    console.log('❌ Cannot continue tests without successful upload');
    return;
  }
  
  console.log('\n');
  
  // Test 2: List documents
  await testListDocuments();
  console.log('\n');
  
  // Test 3: List documents by type
  await testListDocumentsByType();
  console.log('\n');
  
  // Test 4: Get document by ID
  await testGetDocumentById(uploadedDocId);
  console.log('\n');
  
  // Test 5: Get view URL
  await testGetDownloadUrl(uploadedDocId, 'view');
  console.log('\n');
  
  // Test 6: Get download URL
  await testGetDownloadUrl(uploadedDocId, 'download');
  console.log('\n');
  
  // Test 7: Archive document
  await testArchiveDocument(uploadedDocId);
  console.log('\n');
  
  // Test 8: Delete document
  await testDeleteDocument(uploadedDocId);
  
  console.log('\n🏁 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testUploadDocument,
  testListDocuments,
  testListDocumentsByType,
  testGetDocumentById,
  testGetDownloadUrl,
  testArchiveDocument,
  testDeleteDocument,
  runTests
};
