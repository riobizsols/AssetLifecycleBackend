/**
 * Script: Verify Certificate APIs Connection
 * This script tests all certificate-related API endpoints to ensure everything is connected properly
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000/api';

// Test user token - you need to add your actual token here
const TOKEN = process.env.TEST_TOKEN || 'your-auth-token-here';

const endpoints = [
  // Tech Certificate Master Data
  {
    name: 'Get All Tech Certificates',
    method: 'GET',
    path: '/tech-certificates',
    requiresAuth: true
  },
  {
    name: 'Create Tech Certificate',
    method: 'POST',
    path: '/tech-certificates',
    requiresAuth: true,
    body: { cert_name: 'Test Cert', cert_number: 'TEST001' }
  },
  // Employee Tech Certificates
  {
    name: 'Get Employee Certificates',
    method: 'GET',
    path: '/employee-tech-certificates',
    requiresAuth: true
  },
  {
    name: 'Get Certificate Approvals',
    method: 'GET',
    path: '/employee-tech-certificates/approvals',
    requiresAuth: true
  },
  // Related Endpoints
  {
    name: 'Get All Employees',
    method: 'GET',
    path: '/employees',
    requiresAuth: true
  },
  {
    name: 'Get Employees with Roles',
    method: 'GET',
    path: '/employees/with-roles',
    requiresAuth: true
  },
  {
    name: 'Get Maintenance History',
    method: 'GET',
    path: '/maintenance-history',
    requiresAuth: true,
    queryParams: { limit: 10 }
  },
  {
    name: 'Get All Work Orders',
    method: 'GET',
    path: '/work-orders/all',
    requiresAuth: true
  },
  {
    name: 'Get Asset Types',
    method: 'GET',
    path: '/asset-types',
    requiresAuth: true
  },
  {
    name: 'Get Maintenance Types',
    method: 'GET',
    path: '/maint-types',
    requiresAuth: true
  },
];

async function testEndpoint(endpoint) {
  try {
    const url = new URL(BASE_URL + endpoint.path);
    
    if (endpoint.queryParams) {
      Object.entries(endpoint.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (endpoint.requiresAuth && TOKEN !== 'your-auth-token-here') {
      options.headers['Authorization'] = `Bearer ${TOKEN}`;
    }

    if (endpoint.body && endpoint.method === 'POST') {
      options.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(url.toString(), options);
    const statusText = response.status === 200 || response.status === 201 ? '✅' : '⚠️';
    
    return {
      endpoint: endpoint.name,
      status: response.status,
      success: response.ok,
      statusText
    };
  } catch (error) {
    return {
      endpoint: endpoint.name,
      status: 'ERROR',
      success: false,
      statusText: '❌',
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Certificate Endpoints...\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  if (TOKEN === 'your-auth-token-here') {
    console.log('⚠️  NOTE: Using placeholder token. Set environment variable TEST_TOKEN with your actual auth token for full testing.\n');
  }

  console.log('Testing endpoints:\n');

  const results = [];
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    console.log(`${result.statusText} ${result.endpoint}`);
    if (result.status && result.status !== 'ERROR') {
      console.log(`   Status: ${result.status}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n📊 Summary:\n');
  const successful = results.filter(r => r.success || (r.status >= 200 && r.status < 300)).length;
  const failed = results.filter(r => !r.success && (r.status < 200 || r.status >= 400)).length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`⚠️  Failed/Unauthorized: ${failed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📝 Total: ${results.length}`);

  if (errors > 0) {
    console.log('\n⚠️  Note: Errors may indicate connection issues or missing authentication token.');
  }

  return results;
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
