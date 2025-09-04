const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_ASSET_ID = 'ASSET001'; // Replace with actual asset ID from your system
const TEST_WORK_ORDER_ID = 'ams001'; // Replace with actual work order ID from your system
const TEST_ORG_ID = 'ORG001'; // Replace with actual org ID

// Test credentials - replace with actual test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword';

let authToken;
let testDocumentId;

// Create axios instance with auth
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Helper function to create a test file
const createTestFile = () => {
  const testContent = 'This is a test document for Asset Maintenance Documents API';
  const testFilePath = path.join(__dirname, 'test_maintenance_document.txt');
  fs.writeFileSync(testFilePath, testContent);
  return testFilePath;
};

// Helper function to cleanup test file
const cleanupTestFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Test functions
const testLogin = async () => {
  try {
    console.log('🔐 Testing login...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    authToken = response.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
};

const testUploadDocument = async () => {
  try {
    console.log('📤 Testing document upload...');
    
    const testFilePath = createTestFile();
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('asset_id', TEST_ASSET_ID);
    formData.append('doc_type', 'qa_report');
    formData.append('doc_type_name', 'Test QA Report');
    
    const response = await api.post('/asset-maint-docs/upload', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });
    
    testDocumentId = response.data.document.amd_id;
    console.log('✅ Document upload successful:', testDocumentId);
    
    cleanupTestFile(testFilePath);
    return true;
  } catch (error) {
    console.error('❌ Document upload failed:', error.response?.data || error.message);
    return false;
  }
};

const testListDocumentsByAsset = async () => {
  try {
    console.log('📋 Testing document listing by asset...');
    
    // Test listing all documents for asset
    const response = await api.get(`/asset-maint-docs/asset/${TEST_ASSET_ID}`);
    console.log('✅ All documents for asset retrieved:', response.data.documents.length);
    
    // Test filtering by document type
    const filteredResponse = await api.get(`/asset-maint-docs/asset/${TEST_ASSET_ID}?doc_type=qa_report`);
    console.log('✅ Filtered documents for asset retrieved:', filteredResponse.data.documents.length);
    
    return true;
  } catch (error) {
    console.error('❌ Document listing by asset failed:', error.response?.data || error.message);
    return false;
  }
};

const testListDocumentsByWorkOrder = async () => {
  try {
    console.log('📋 Testing document listing by work order...');
    
    // Test listing all documents for work order
    const response = await api.get(`/asset-maint-docs/work-order/${TEST_WORK_ORDER_ID}`);
    console.log('✅ All documents for work order retrieved:', response.data.documents.length);
    
    // Test filtering by document type
    const filteredResponse = await api.get(`/asset-maint-docs/work-order/${TEST_WORK_ORDER_ID}?doc_type=qa_report`);
    console.log('✅ Filtered documents for work order retrieved:', filteredResponse.data.documents.length);
    
    return true;
  } catch (error) {
    console.error('❌ Document listing by work order failed:', error.response?.data || error.message);
    return false;
  }
};

const testGetDocumentDetails = async () => {
  try {
    console.log('📄 Testing get document details...');
    
    const response = await api.get(`/asset-maint-docs/document/${testDocumentId}`);
    console.log('✅ Document details retrieved:', response.data.document.amd_id);
    
    return true;
  } catch (error) {
    console.error('❌ Get document details failed:', error.response?.data || error.message);
    return false;
  }
};

const testDownloadDocument = async () => {
  try {
    console.log('⬇️ Testing document download...');
    
    // Test download mode
    const downloadResponse = await api.get(`/asset-maint-docs/${testDocumentId}/download?mode=download`);
    console.log('✅ Download URL generated:', downloadResponse.data.url ? 'Yes' : 'No');
    
    // Test view mode
    const viewResponse = await api.get(`/asset-maint-docs/${testDocumentId}/download?mode=view`);
    console.log('✅ View URL generated:', viewResponse.data.url ? 'Yes' : 'No');
    
    return true;
  } catch (error) {
    console.error('❌ Document download failed:', error.response?.data || error.message);
    return false;
  }
};

const testArchiveDocument = async () => {
  try {
    console.log('📦 Testing document archive...');
    
    const response = await api.put(`/asset-maint-docs/${testDocumentId}/archive`, {
      archived_path: `archived/asset-docs/${TEST_ORG_ID}/asset-maintenance/${TEST_ASSET_ID}/test_maintenance_document.txt`
    });
    
    console.log('✅ Document archived successfully');
    return true;
  } catch (error) {
    console.error('❌ Document archive failed:', error.response?.data || error.message);
    return false;
  }
};

const testDeleteDocument = async () => {
  try {
    console.log('🗑️ Testing document deletion...');
    
    const response = await api.delete(`/asset-maint-docs/${testDocumentId}`);
    console.log('✅ Document deleted successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Document deletion failed:', error.response?.data || error.message);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Asset Maintenance Documents API Tests...\n');
  
  let passedTests = 0;
  let totalTests = 7;
  
  // Run tests in sequence
  if (await testLogin()) passedTests++;
  if (await testUploadDocument()) passedTests++;
  if (await testListDocumentsByAsset()) passedTests++;
  if (await testListDocumentsByWorkOrder()) passedTests++;
  if (await testGetDocumentDetails()) passedTests++;
  if (await testDownloadDocument()) passedTests++;
  if (await testArchiveDocument()) passedTests++;
  if (await testDeleteDocument()) passedTests++;
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Asset Maintenance Documents API is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testLogin,
  testUploadDocument,
  testListDocumentsByAsset,
  testListDocumentsByWorkOrder,
  testGetDocumentDetails,
  testDownloadDocument,
  testArchiveDocument,
  testDeleteDocument,
  runTests
};
