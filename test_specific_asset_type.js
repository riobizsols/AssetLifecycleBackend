const axios = require('axios');

async function testSpecificAssetType() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiJPUkcwMDEiLCJ1c2VyX2lkIjoiVVNSMDAxIiwiZW1haWwiOiJyZWFsYWthc2hqYWlzd2FsQGdtYWlsLmNvbSIsImpvYl9yb2xlX2lkIjoiSlIwMDEiLCJlbXBfaW50X2lkIjoiRU1QX0lOVF8wMDAxIiwiaWF0IjoxNzU2OTgxODg5LCJleHAiOjE3NTc1ODY2ODl9.fTe29jOwqoUoa9gMbmv19PSALHUqdTchzzlH4OqKI94';
    
    console.log('Testing the most recent asset types...');
    const response = await axios.get('http://localhost:5000/api/asset-types', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Get the most recent asset types (assuming they have higher IDs)
    const sortedTypes = response.data.sort((a, b) => b.asset_type_id.localeCompare(a.asset_type_id));
    const recentTypes = sortedTypes.slice(0, 5); // Get top 5 most recent
    
    console.log('Most recent asset types:');
    recentTypes.forEach((type, index) => {
      console.log(`${index + 1}. ${type.text} (ID: ${type.asset_type_id})`);
    });
    
    // Test documents for each recent asset type
    for (const type of recentTypes) {
      console.log(`\n📋 Testing documents for "${type.text}" (ID: ${type.asset_type_id}):`);
      try {
        const docResponse = await axios.get(`http://localhost:5000/api/asset-type-docs/${type.asset_type_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`  Documents found: ${docResponse.data.documents.length}`);
        if (docResponse.data.documents.length > 0) {
          docResponse.data.documents.forEach((doc, i) => {
            console.log(`    ${i + 1}. ${doc.file_name} (${doc.doc_type_text}) - ${doc.is_archived ? 'Archived' : 'Active'}`);
            if (doc.doc_type_name) {
              console.log(`       Custom name: ${doc.doc_type_name}`);
            }
          });
        } else {
          console.log('  ❌ No documents found');
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.response?.data?.message || err.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testSpecificAssetType();
