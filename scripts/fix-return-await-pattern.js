const fs = require('fs');
const path = require('path');

/**
 * Fix all "return await dbPool.query(" followed by "await dbPool.query(...)" syntax errors
 * Pattern: 
 *   return await dbPool.query(
 *   await dbPool.query(query, params);
 * 
 * Should be:
 *   return await dbPool.query(query, params);
 */

const modelsDir = path.join(__dirname, '..', 'models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

console.log(`\n🔧 Fixing return await dbPool.query syntax errors in ${files.length} model files...\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern: return await dbPool.query(\n await dbPool.query(query, params);
  // Replace with: return await dbPool.query(query, params);
  const pattern = /return await dbPool\.query\(\s*\n\s*await dbPool\.query\(([^;]+)\);/g;
  
  content = content.replace(pattern, (match, queryParams) => {
    return `return await dbPool.query(${queryParams.trim()});`;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    const fixes = (originalContent.match(/return await dbPool\.query\(\s*\n\s*await dbPool\.query\(/g) || []).length;
    console.log(`✅ Fixed ${fixes} issue(s) in ${file}`);
    totalFixed += fixes;
  }
});

console.log(`\n✨ Total fixes: ${totalFixed}\n`);

