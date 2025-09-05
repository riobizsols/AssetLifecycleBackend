const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testScrapDocsUpload() {
  try {
    console.log('Testing scrap sales document upload...');
    
    // Create a test file
    const testContent = 'This is a test document for scrap sales upload';
    fs.writeFileSync('test_document.txt', testContent);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test_document.txt'));
    formData.append('ssh_id', 'SSH001');
    formData.append('dto_id', 'DTO001');
    formData.append('doc_type_name', 'Test Document');
    
    // Make the request
    const response = await axios.post('http://localhost:5000/api/scrap-sales-docs/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiJPUkcwMDEiLCJ1c2VyX2lkIjoiVVNSMDAxIiwiZW1haWwiOiJyZWFsYWthc2hqYWlzd2FsQGdtYWlsLmNvbSIsImpvYl9yb2xlX2lkIjoiSlIwMDEiLCJlbXBfaW50X2lkIjoiRU1QX0lOVF8wMDAxIiwiaWF0IjoxNzU2OTgxODg5LCJleHAiOjE3NTc1ODY2ODl9.fTe29jOwqoUoa9gMbm19PSALHUqdTchzzlH4OqKI94'
      }
    });
    
    console.log('✅ Upload successful!');
    console.log('Response:', response.data);
    
    // Clean up test file
    fs.unlinkSync('test_document.txt');
    
  } catch (error) {
    console.error('❌ Upload failed:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Response Data:', error.response?.data);
    console.error('Full Error:', error.message);
  }
}

testScrapDocsUpload();
