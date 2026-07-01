/**
 * Comprehensive script to update ALL controllers to use req.db instead of direct db
 * This ensures all controllers use tenant database when available
 */

const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, '../controllers');
const controllers = fs.readdirSync(controllersDir).filter(file => file.endsWith('.js'));

console.log(`\n🔧 Updating ${controllers.length} controller files...\n`);

let updatedCount = 0;
let skippedCount = 0;

controllers.forEach(controllerFile => {
  const controllerPath = path.join(controllersDir, controllerFile);
  let content = fs.readFileSync(controllerPath, 'utf8');
  let updated = false;
  
  // Skip if doesn't use db
  if (!content.includes("const db = require") && !content.includes('db.query') && !content.includes('db.connect')) {
    console.log(`⏭️  ${controllerFile} - no db usage`);
    skippedCount++;
    return;
  }
  
  // Replace all db.query patterns with req.db || db
  // Pattern 1: const result = await db.query(...)
  const pattern1 = /(\s+)(const\s+\w+\s*=\s*await\s+)db\.query\(/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, (match, indent, prefix) => {
      // Check if we're inside a function that has req parameter
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      // If we're in a route handler and haven't declared dbPool yet
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.query(';
      }
      return match;
    });
    updated = true;
  }
  
  // Pattern 2: await db.query(...)
  const pattern2 = /(\s+)(await\s+)db\.query\(/g;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, (match, indent, prefix) => {
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.query(';
      }
      return match.replace('db.query', 'dbPool.query');
    });
    updated = true;
  }
  
  // Pattern 3: return await db.query(...)
  const pattern3 = /(\s+)(return\s+await\s+)db\.query\(/g;
  if (pattern3.test(content)) {
    content = content.replace(pattern3, (match, indent, prefix) => {
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.query(';
      }
      return indent + prefix + 'dbPool.query(';
    });
    updated = true;
  }
  
  // Pattern 4: return db.query(...) without await
  const pattern4 = /(\s+)(return\s+)db\.query\(/g;
  if (pattern4.test(content)) {
    content = content.replace(pattern4, (match, indent, prefix) => {
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.query(';
      }
      return indent + prefix + 'dbPool.query(';
    });
    updated = true;
  }
  
  // Pattern 5: db.connect()
  const pattern5 = /(\s+)(const\s+\w+\s*=\s*await\s+)db\.connect\(\)/g;
  if (pattern5.test(content)) {
    content = content.replace(pattern5, (match, indent, prefix) => {
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.connect()';
      }
      return indent + prefix + 'dbPool.connect()';
    });
    updated = true;
  }
  
  // Pattern 6: await db.connect()
  const pattern6 = /(\s+)(await\s+)db\.connect\(\)/g;
  if (pattern6.test(content)) {
    content = content.replace(pattern6, (match, indent, prefix) => {
      const beforeMatch = content.substring(0, content.indexOf(match));
      const lastFunction = Math.max(
        beforeMatch.lastIndexOf('async (req'),
        beforeMatch.lastIndexOf('async(req'),
        beforeMatch.lastIndexOf('(req, res)'),
        beforeMatch.lastIndexOf('(req, res, next)')
      );
      const lastDbPool = beforeMatch.lastIndexOf('const dbPool = req.db');
      
      if (lastFunction > lastDbPool && lastFunction !== -1) {
        return indent + 'const dbPool = req.db || require("../config/db");\n' + indent + prefix + 'dbPool.connect()';
      }
      return indent + prefix + 'dbPool.connect()';
    });
    updated = true;
  }
  
  // Clean up duplicate dbPool declarations in same function
  const lines = content.split('\n');
  let inFunction = false;
  let dbPoolDeclared = false;
  let functionStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect function start
    if (line.includes('async (req') || line.includes('async(req') || line.includes('(req, res)')) {
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
    if (line.includes('const dbPool = req.db')) {
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
    fs.writeFileSync(controllerPath, content, 'utf8');
    console.log(`✅ ${controllerFile}`);
    updatedCount++;
  } else {
    console.log(`⏭️  ${controllerFile} - no changes`);
    skippedCount++;
  }
});

console.log(`\n✅ Updated: ${updatedCount} files`);
console.log(`⏭️  Skipped: ${skippedCount} files`);
console.log(`\n🎉 Done! All controllers updated.\n`);

