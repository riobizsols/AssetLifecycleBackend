require('dotenv').config();
const axios = require('axios');

async function testHistoryAPI() {
  try {
    const wfscrapHId = 'WFSCH013';
    const url = `http://localhost:5000/api/scrap-maintenance/workflow-history/${wfscrapHId}`;
    
    console.log(`Testing API: ${url}`);
    
    const response = await axios.get(url);
    console.log('\nAPI Response Status:', response.status);
    console.log('\nAPI Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      console.log(`\n✓ Found ${response.data.data.length} history records`);
    } else {
      console.log('\n✗ No history records found or API returned error');
    }
  } catch (error) {
    console.error('\n❌ Error testing API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running?');
      console.error('Error:', error.message);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testHistoryAPI();
