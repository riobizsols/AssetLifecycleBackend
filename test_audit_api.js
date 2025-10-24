const API = require('axios');

async function testAuditAPI() {
  try {
    console.log('🧪 Testing audit logging API...');
    
    // First, let's login to get a token
    console.log('🔐 Logging in...');
    const loginResponse = await API.post('http://localhost:5000/api/auth/login', {
      email: 'admin@example.com', // Replace with actual admin email
      password: 'admin123' // Replace with actual admin password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    // Test the audit logging API
    console.log('📝 Testing audit log recording...');
    const auditResponse = await API.post('http://localhost:5000/api/audit-logs/record', {
      app_id: 'ASSETS',
      event_id: 'Eve005', // Create event
      text: 'Test audit log entry from API test'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 Audit API response:', auditResponse.data);
    
    if (auditResponse.data.success) {
      console.log('✅ Audit log recorded successfully!');
    } else {
      console.log('❌ Audit log recording failed:', auditResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing audit API:', error.response?.data || error.message);
  }
}

testAuditAPI();
