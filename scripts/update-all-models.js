/**
 * Comprehensive script to update ALL models to use getDb() from context
 * This ensures all models use tenant database when available
 */

const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');
const models = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js'));

console.log(`\n🔧 Updating ${models.length} model files...\n`);

let updatedCount = 0;
let skippedCount = 0;

models.forEach(modelFile => {
  const modelPath = path.join(modelsDir, modelFile);
  let content = fs.readFileSync(modelPath, 'utf8');
  let updated = false;
  
  // Skip if already has getDbFromContext
  if (content.includes('getDbFromContext') || content.includes('getDb()')) {
    console.log(`⏭️  ${modelFile} - already updated`);
    skippedCount++;
    return;
  }
  
  // Skip if doesn't use db
  if (!content.includes("const db = require") && !content.includes('db.query') && !content.includes('db.connect')) {
    console.log(`⏭️  ${modelFile} - no db usage`);
    skippedCount++;
    return;
  }
  
  // Add getDbFromContext import and helper
  if (content.includes("const db = require")) {
    const dbImportMatch = content.match(/const db = require\(['"]\.\.\/config\/db['"]\);/);
    if (dbImportMatch) {
      const insertAfter = dbImportMatch[0];
      const getDbHelper = `
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();
`;
      content = content.replace(insertAfter, insertAfter + getDbHelper);
      updated = true;
    }
  }
  
  // Replace db.query patterns
  // Pattern 1: const result = await db.query(...)
  content = content.replace(/(\s+)(const\s+\w+\s*=\s*await\s+)db\.query\(/g, (match, indent, prefix) => {
    return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.query(';
  });
  
  // Pattern 2: await db.query(...)
  content = content.replace(/(\s+)(await\s+)db\.query\(/g, (match, indent, prefix) => {
    if (!content.substring(0, content.indexOf(match)).includes('const dbPool = getDb()')) {
      return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.query(';
    }
    return match.replace('db.query', 'dbPool.query');
  });
  
  // Pattern 3: return await db.query(...)
  content = content.replace(/(\s+)(return\s+await\s+)db\.query\(/g, (match, indent, prefix) => {
    const beforeMatch = content.substring(0, content.indexOf(match));
    const lastDbPool = beforeMatch.lastIndexOf('const dbPool = getDb()');
    const lastFunctionStart = Math.max(
      beforeMatch.lastIndexOf('async '),
      beforeMatch.lastIndexOf('function ')
    );
    
    if (lastDbPool < lastFunctionStart || lastDbPool === -1) {
      return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.query(';
    }
    return indent + prefix + 'dbPool.query(';
  });
  
  // Pattern 4: return db.query(...) without await
  content = content.replace(/(\s+)(return\s+)db\.query\(/g, (match, indent, prefix) => {
    const beforeMatch = content.substring(0, content.indexOf(match));
    const lastDbPool = beforeMatch.lastIndexOf('const dbPool = getDb()');
    const lastFunctionStart = Math.max(
      beforeMatch.lastIndexOf('async '),
      beforeMatch.lastIndexOf('function ')
    );
    
    if (lastDbPool < lastFunctionStart || lastDbPool === -1) {
      return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.query(';
    }
    return indent + prefix + 'dbPool.query(';
  });
  
  // Pattern 5: db.connect()
  content = content.replace(/(\s+)(const\s+\w+\s*=\s*await\s+)db\.connect\(\)/g, (match, indent, prefix) => {
    return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.connect()';
  });
  
  // Pattern 6: await db.connect()
  content = content.replace(/(\s+)(await\s+)db\.connect\(\)/g, (match, indent, prefix) => {
    const beforeMatch = content.substring(0, content.indexOf(match));
    if (!beforeMatch.includes('const dbPool = getDb()')) {
      return indent + 'const dbPool = getDb();\n' + indent + prefix + 'dbPool.connect()';
    }
    return indent + prefix + 'dbPool.connect()';
  });
  
  // Fix duplicate dbPool declarations in same function scope
  // This is a simple fix - remove duplicates within 50 lines
  const lines = content.split('\n');
  let inFunction = false;
  let dbPoolDeclared = false;
  let functionStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect function start
    if (line.includes('async ') || line.includes('function ')) {
      inFunction = true;
      dbPoolDeclared = false;
      functionStart = i;
    }
    
    // Detect function end (simple heuristic)
    if (line.trim() === '}' && inFunction && i > functionStart + 5) {
      inFunction = false;
      dbPoolDeclared = false;
    }
    
    // Check for dbPool declaration
    if (line.includes('const dbPool = getDb()')) {
      if (dbPoolDeclared && inFunction) {
        // Remove duplicate
        lines[i] = '';
        updated = true;
      } else {
        dbPoolDeclared = true;
      }
    }
    
    // Reset if we see another dbPool usage
    if (line.includes('dbPool.query') || line.includes('dbPool.connect')) {
      dbPoolDeclared = false;
    }
  }
  
  if (updated) {
    content = lines.join('\n');
    // Clean up empty lines (max 2 consecutive)
    content = content.replace(/\n{3,}/g, '\n\n');
  }
  
  if (updated) {
    fs.writeFileSync(modelPath, content, 'utf8');
    console.log(`✅ ${modelFile}`);
    updatedCount++;
  } else {
    console.log(`⏭️  ${modelFile} - no changes`);
    skippedCount++;
  }
});

console.log(`\n✅ Updated: ${updatedCount} files`);
console.log(`⏭️  Skipped: ${skippedCount} files`);
console.log(`\n🎉 Done! All models updated.\n`);

