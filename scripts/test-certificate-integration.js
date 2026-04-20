#!/usr/bin/env node

/**
 * 🎓 Certificate Management System - Complete Integration Test
 * 
 * This interactive test guide helps verify all certificate features are working
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const tests = [
  {
    category: '🔐 Authentication & Navigation',
    checks: [
      {
        name: 'User can login successfully',
        instruction: '1. Open http://localhost:5173\n   2. Enter credentials\n   3. Click login',
        verify: 'You see the dashboard',
        command: 'Manual'
      },
      {
        name: 'Certificate menu items appear',
        instruction: '1. Look at left sidebar\n   2. Check under appropriate sections',
        verify: 'You see:\n   - Certifications\n   - Technician Certificates\n   - HR/Manager Approval',
        command: 'Manual'
      },
      {
        name: 'User has proper permissions',
        instruction: '1. Check your job role\n   2. Verify role has certificate permissions',
        verify: 'You can access certificate pages',
        command: 'Manual'
      }
    ]
  },
  {
    category: '🛠️ Admin - Certifications Management',
    checks: [
      {
        name: 'Can navigate to Certifications page',
        instruction: '1. Login as admin\n   2. Go to Admin Settings\n   3. Click Certifications',
        verify: 'Page loads with two tabs: Create and Mapping',
        command: 'Manual'
      },
      {
        name: 'Can create a new certificate',
        instruction: '1. On Certifications page\n   2. Click "Create Certificate" button\n   3. Enter name: "Test Cert"\n   4. Enter number: "TEST-001"\n   5. Click Create',
        verify: 'Certificate appears in list\n   Toast shows success message',
        command: 'Manual'
      },
      {
        name: 'Can edit a certificate',
        instruction: '1. Find certificate in list\n   2. Click edit button (pencil icon)\n   3. Modify name\n   4. Click save',
        verify: 'Certificate updated in list\n   Toast shows success message',
        command: 'Manual'
      },
      {
        name: 'Can view mapped certificates',
        instruction: '1. Click "Mapping" tab\n   2. Select an asset type\n   3. Select maintenance type',
        verify: 'Certificates mapped to that combo are shown',
        command: 'Manual'
      },
      {
        name: 'Can map certificates',
        instruction: '1. Select asset type and maint type\n   2. Check desired certificates\n   3. Click Save',
        verify: 'Certificates are saved to mapping\n   Success message shown',
        command: 'Manual'
      }
    ]
  },
  {
    category: '📜 Employee - Certificate Upload',
    checks: [
      {
        name: 'Can navigate to Technician Certificates',
        instruction: '1. Login as employee\n   2. Click Technician Certificates',
        verify: 'Page loads with upload section',
        command: 'Manual'
      },
      {
        name: 'Can upload a certificate',
        instruction: '1. Select employee name\n   2. Select certificate type\n   3. Enter certificate date\n   4. Enter expiry date\n   5. Upload a PDF file\n   6. Click Upload',
        verify: 'Certificate appears in list\n   Status shows "Approval Pending"\n   File is downloadable',
        command: 'Manual'
      },
      {
        name: 'Can download uploaded certificate',
        instruction: '1. In certificate list\n   2. Click View button for uploaded cert',
        verify: 'File downloads successfully',
        command: 'Manual'
      },
      {
        name: 'Can see certificate status',
        instruction: '1. Look at status column in list',
        verify: 'Status shows:\n   🟡 Approval Pending OR\n   🟢 Approved OR\n   🔴 Rejected',
        command: 'Manual'
      }
    ]
  },
  {
    category: '✅ HR/Manager - Approvals',
    checks: [
      {
        name: 'Can navigate to HR/Manager Approval',
        instruction: '1. Login as HR/Manager\n   2. Click HR/Manager Approval',
        verify: 'Page loads with multiple tabs',
        command: 'Manual'
      },
      {
        name: 'Can see pending approvals',
        instruction: '1. Click Certificate Approvals tab\n   2. Look for pending certificates',
        verify: 'List shows certificates with "Approval Pending" status',
        command: 'Manual'
      },
      {
        name: 'Can approve a certificate',
        instruction: '1. Find pending certificate\n   2. Click approve checkmark\n   3. Add comment (optional)\n   4. Confirm',
        verify: 'Status changes to Approved\n   Success message shown',
        command: 'Manual'
      },
      {
        name: 'Can reject a certificate',
        instruction: '1. Find pending certificate\n   2. Click reject X button\n   3. Enter rejection reason\n   4. Confirm',
        verify: 'Status changes to Rejected\n   Reason saved\n   Success message shown',
        command: 'Manual'
      }
    ]
  },
  {
    category: '🔌 Backend API Endpoints',
    checks: [
      {
        name: 'Tech certificates endpoint works',
        instruction: 'curl http://localhost:5000/api/tech-certificates \\\n  -H "Authorization: Bearer YOUR_TOKEN"',
        verify: 'Returns JSON array of certificates',
        command: 'curl'
      },
      {
        name: 'Employee certificates endpoint works',
        instruction: 'curl http://localhost:5000/api/employee-tech-certificates \\\n  -H "Authorization: Bearer YOUR_TOKEN"',
        verify: 'Returns JSON array of employee certificates',
        command: 'curl'
      },
      {
        name: 'Can create certificate via API',
        instruction: 'curl -X POST http://localhost:5000/api/tech-certificates \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -d \'{"cert_name":"API Test","cert_number":"API-001"}\'',
        verify: 'Returns created certificate object with ID',
        command: 'curl'
      },
      {
        name: 'Approvals endpoint works',
        instruction: 'curl http://localhost:5000/api/employee-tech-certificates/approvals \\\n  -H "Authorization: Bearer YOUR_TOKEN"',
        verify: 'Returns list of all certificates for approval',
        command: 'curl'
      }
    ]
  },
  {
    category: '💾 Database Verification',
    checks: [
      {
        name: 'Navigation entries exist',
        instruction: 'Run in backend:\nnode scripts/verify-certificate-tables.js',
        verify: 'Shows all certificate tables exist\n   Shows 39 navigation entries added',
        command: 'bash'
      }
    ]
  }
];

let currentTest = 0;
let passedTests = 0;
let failedTests = 0;

function displayTest() {
  if (currentTest >= tests.length) {
    showSummary();
    return;
  }

  const category = tests[currentTest];
  console.clear();
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║ ${category.category} ${' '.repeat(30 - category.category.length)} ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const check = category.checks[0];
  console.log(`📝 Test: ${check.name}\n`);
  console.log('ℹ️  Instructions:');
  console.log(check.instruction);
  console.log('\n✅ Expected Result:');
  console.log(check.verify);
  console.log('\n');

  rl.question('Did this test pass? (y/n/skip): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      passedTests++;
      category.checks.shift();
    } else if (answer.toLowerCase() === 'skip') {
      // Skip this test
    } else {
      failedTests++;
      console.log('\n❌ Please fix and try again.\n');
      rl.question('Press Enter to retry...', () => {
        displayTest();
        return;
      });
      return;
    }

    if (category.checks.length > 0) {
      displayTest();
    } else {
      currentTest++;
      displayTest();
    }
  });
}

function showSummary() {
  console.clear();
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║ 🎉 Certificate Integration Test Summary 🎉            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const total = passedTests + failedTests;
  const percentage = total > 0 ? Math.round((passedTests / total) * 100) : 0;

  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Total: ${total}`);
  console.log(`📈 Success Rate: ${percentage}%\n`);

  if (failedTests === 0) {
    console.log('🎓 All tests passed! Certificate system is fully integrated.\n');
    console.log('📝 Next Steps:');
    console.log('1. Create real certificates for your use case');
    console.log('2. Train employees on how to upload certificates');
    console.log('3. Configure approval workflow');
    console.log('4. Monitor certificate compliance');
  } else {
    console.log('⚠️  Some tests failed. Please review and fix issues.\n');
    console.log('💡 Common Issues:');
    console.log('- Check if backend server is running (npm start)');
    console.log('- Verify user has proper permissions');
    console.log('- Clear browser cache and reload');
    console.log('- Check browser console for errors (F12)');
  }

  console.log('\n');
  rl.close();
  process.exit(failedTests === 0 ? 0 : 1);
}

// Start tests
console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║ 🎓 Certificate Integration Test Suite 🎓              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

console.log('This interactive test will verify that the certificate');
console.log('management system is fully integrated and working.\n');

console.log('Prerequisites:');
console.log('✅ Backend running on http://localhost:5000');
console.log('✅ Frontend running on http://localhost:5173');
console.log('✅ Logged in with valid credentials\n');

rl.question('Ready to start testing? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    displayTest();
  } else {
    console.log('\nTest cancelled.');
    rl.close();
    process.exit(0);
  }
});

module.exports = { tests };
