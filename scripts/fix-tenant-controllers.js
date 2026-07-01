const fs = require('fs');
const path = require('path');

/**
 * Fix controllers that still use require('../config/db') directly
 * They should use req.db (set by authMiddleware) instead
 */

const controllersDir = path.join(__dirname, '..', 'controllers');
const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));

console.log(`\n🔧 Fixing tenant database conversion in controllers...\n`);

let totalFixed = 0;

files.forEach(file => {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern 1: Remove top-level const db = require('../config/db');
  // These should use req.db instead
  content = content.replace(
    /^const\s+(db|pool)\s*=\s*require\(['"]\.\.\/config\/db['"]\);?\s*\n/gm,
    ''
  );
  
  // Pattern 2: Replace db.query( with (req.db || require("../config/db")).query(
  // But only if it's not already using req.db
  content = content.replace(
    /(\s+)(db|pool)\.query\(/g,
    (match, indent, varName) => {
      // Check if req.db is already being used nearby
      const linesBefore = content.substring(0, content.indexOf(match)).split('\n');
      const lastFewLines = linesBefore.slice(-5).join('\n');
      if (lastFewLines.includes('req.db') || lastFewLines.includes('dbPool = req.db')) {
        return match; // Already using req.db, don't change
      }
      return `${indent}(req.db || require("../config/db")).query(`;
    }
  );
  
  // Pattern 3: Replace const db = require("../config/db"); inside functions
  // With: const dbPool = req.db || require("../config/db");
  content = content.replace(
    /(\s+)(const\s+)(db|pool)\s*=\s*require\(['"]\.\.\/config\/db['"]\);?/g,
    (match, indent, constKeyword, varName) => {
      // Check if we're inside a function (has req parameter)
      const linesBefore = content.substring(0, content.indexOf(match));
      const functionMatch = linesBefore.match(/(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*req)/);
      if (functionMatch) {
        return `${indent}const dbPool = req.db || require("../config/db");`;
      }
      return match;
    }
  );
  
  // Pattern 4: Replace db.connect() with (req.db || require("../config/db")).connect()
  content = content.replace(
    /(\s+)(db|pool)\.connect\(\)/g,
    (match, indent, varName) => {
      const linesBefore = content.substring(0, content.indexOf(match)).split('\n');
      const lastFewLines = linesBefore.slice(-5).join('\n');
      if (lastFewLines.includes('req.db') || lastFewLines.includes('dbPool = req.db')) {
        return match;
      }
      return `${indent}(req.db || require("../config/db")).connect()`;
    }
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed ${file}`);
    totalFixed++;
  }
});

console.log(`\n✨ Fixed ${totalFixed} controller file(s)!\n`);

