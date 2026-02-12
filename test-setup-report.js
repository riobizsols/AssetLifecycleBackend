/**
 * Test setup report generation
 * This demonstrates what the report will look like
 */

const path = require('path');
const fs = require('fs');

// Simulate setup data
const mockSetupData = {
  orgId: 'ORG001',
  orgName: 'Test Organization',
  adminUser: {
    userId: 'USR001',
    username: 'admin',
    email: 'admin@example.com',
    fullName: 'Admin User'
  },
  dbConfig: {
    host: 'localhost',
    port: 5432,
    database: 'test_org_db',
    user: 'postgres'
  },
  summary: {
    branches: 3,
    departments: 5,
    auditRules: 50
  },
  logs: [
    { message: 'Schema creation started', scope: 'schema' },
    { message: 'Database schema imported (without foreign keys)', scope: 'schema' },
    { message: 'Foreign key constraints applied (193 valid, 5 skipped)', scope: 'schema' },
    { message: 'Core tables verified', scope: 'schema' },
    { message: 'Organization ORG001 inserted', scope: 'org' },
    { message: 'Default org settings initialized', scope: 'org-settings' },
    { message: '3 branches created', scope: 'structure' },
    { message: '5 departments created', scope: 'structure' },
    { message: 'Admin employee and user created', scope: 'admin' },
    { message: '50 audit event configurations created', scope: 'audit' },
    { message: 'Setup completion email sent to admin@example.com', scope: 'email' }
  ],
  foreignKeysInfo: {
    validCount: 193,
    skippedCount: 5
  },
  startTime: Date.now() - 15000, // 15 seconds ago
  endTime: Date.now()
};

console.log('📄 Generating test setup report...\n');

// Generate report content
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const reportDir = path.join(__dirname, 'logs', 'db-creation');
const reportFile = path.join(reportDir, `org_setup_${mockSetupData.orgId}_${timestamp}_TEST.txt`);

const duration = mockSetupData.endTime - mockSetupData.startTime;
const durationSeconds = (duration / 1000).toFixed(2);

let report = '';
report += '================================================================================\n';
report += '                   ORGANIZATION SETUP REPORT                                    \n';
report += '================================================================================\n';
report += '\n';
report += `Setup Date/Time: ${new Date(mockSetupData.startTime).toLocaleString()}\n`;
report += `Duration: ${durationSeconds} seconds\n`;
report += `Report Generated: ${new Date().toLocaleString()}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   ORGANIZATION DETAILS                                         \n';
report += '================================================================================\n';
report += '\n';
report += `Organization ID: ${mockSetupData.orgId}\n`;
report += `Organization Name: ${mockSetupData.orgName}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   DATABASE CONFIGURATION                                       \n';
report += '================================================================================\n';
report += '\n';
report += `Host: ${mockSetupData.dbConfig.host}\n`;
report += `Port: ${mockSetupData.dbConfig.port}\n`;
report += `Database: ${mockSetupData.dbConfig.database}\n`;
report += `User: ${mockSetupData.dbConfig.user}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   SCHEMA CREATION SUMMARY                                      \n';
report += '================================================================================\n';
report += '\n';
report += `Tables Created: 79 (from GENERIC_URL template)\n`;
report += `Primary Keys: Applied to all tables\n`;
report += `Foreign Keys (Valid): ${mockSetupData.foreignKeysInfo.validCount}\n`;
report += `Foreign Keys (Skipped): ${mockSetupData.foreignKeysInfo.skippedCount}\n`;
report += `Total Foreign Keys: ${mockSetupData.foreignKeysInfo.validCount + mockSetupData.foreignKeysInfo.skippedCount}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   DATA SEEDING SUMMARY                                         \n';
report += '================================================================================\n';
report += '\n';
report += `Branches Created: ${mockSetupData.summary.branches}\n`;
report += `Departments Created: ${mockSetupData.summary.departments}\n`;
report += `Audit Rules Created: ${mockSetupData.summary.auditRules}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   ADMIN USER DETAILS                                           \n';
report += '================================================================================\n';
report += '\n';
report += `User ID: ${mockSetupData.adminUser.userId}\n`;
report += `Username: ${mockSetupData.adminUser.username}\n`;
report += `Email: ${mockSetupData.adminUser.email}\n`;
report += `Full Name: ${mockSetupData.adminUser.fullName}\n`;
report += '\n';
report += '================================================================================\n';
report += '                   SETUP EXECUTION LOGS                                         \n';
report += '================================================================================\n';
report += '\n';

// Group logs by scope
const logsByScope = {};
mockSetupData.logs.forEach(log => {
  const scope = log.scope || 'general';
  if (!logsByScope[scope]) {
    logsByScope[scope] = [];
  }
  logsByScope[scope].push(log);
});

// Print logs by scope
Object.keys(logsByScope).sort().forEach(scope => {
  report += `[${scope.toUpperCase()}]\n`;
  logsByScope[scope].forEach(log => {
    const level = log.level || (log.warning ? 'warning' : 'info');
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
    report += `  ${prefix} ${log.message}\n`;
  });
  report += '\n';
});

report += '================================================================================\n';
report += '                   SETUP COMPLETED SUCCESSFULLY                                 \n';
report += '================================================================================\n';
report += '\n';
report += `Organization ${mockSetupData.orgId} is ready for use!\n`;
report += `Total setup time: ${durationSeconds} seconds\n`;
report += '\n';

// Write report to file
fs.writeFileSync(reportFile, report, 'utf8');

console.log('✅ Test report generated successfully!\n');
console.log('📍 Report location:');
console.log(`   ${reportFile}\n`);
console.log('📋 Report preview (first 50 lines):\n');
console.log('─'.repeat(80));

const lines = report.split('\n');
lines.slice(0, 50).forEach(line => console.log(line));

if (lines.length > 50) {
  console.log(`\n... and ${lines.length - 50} more lines\n`);
}

console.log('─'.repeat(80));
console.log(`\n📄 Full report saved to: ${reportFile}\n`);
