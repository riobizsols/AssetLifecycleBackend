const http = require('http');

console.log('\n=== Testing Vendor Renewal API ===\n');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/vendor-renewals',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}\n`);
    
    if (res.statusCode === 200) {
      console.log('✅ API is working!\n');
      console.log('Response:');
      console.log(data);
      console.log('\n✅ Table exists and is accessible via API!');
    } else {
      console.log('Response:');
      console.log(data);
    }
    
    console.log('\n');
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.end();
