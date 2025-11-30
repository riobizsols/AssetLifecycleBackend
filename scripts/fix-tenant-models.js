const fs = require('fs');
const path = require('path');

/**
 * Fix models that still use require('../config/db') instead of getDb() from dbContext
 * This ensures they use the tenant database context
 */

const modelsToFix = [
  'checklistModel.js',
  'approvalDetailModel.js',
  'notificationModel.js',
  'reportbreakdownModel.js',
  'workflowEscalationModel.js'
];

const modelsDir = path.join(__dirname, '..', 'models');

console.log(`\n🔧 Fixing tenant database conversion in ${modelsToFix.length} model files...\n`);

modelsToFix.forEach(fileName => {
  const filePath = path.join(modelsDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileName}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Replace: const pool = require('../config/db');
  // With: const { getDb } = require('../utils/dbContext');
  content = content.replace(
    /const\s+pool\s*=\s*require\(['"]\.\.\/config\/db['"]\);?/g,
    `const { getDb } = require('../utils/dbContext');`
  );
  
  // Replace all instances of pool.query( with getDb().query(
  content = content.replace(/pool\.query\(/g, 'getDb().query(');
  
  // Replace all instances of pool.connect() with getDb().connect()
  content = content.replace(/pool\.connect\(\)/g, 'getDb().connect()');
  
  // Replace: const client = await pool.connect();
  // With: const dbPool = getDb(); const client = await dbPool.connect();
  content = content.replace(
    /const\s+client\s*=\s*await\s+pool\.connect\(\);/g,
    `const dbPool = getDb();\n  const client = await dbPool.connect();`
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${fileName}`);
  } else {
    console.log(`ℹ️  No changes needed in ${fileName}`);
  }
});

console.log(`\n✨ Tenant conversion complete!\n`);

