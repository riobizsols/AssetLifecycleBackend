/**
 * Script to update all model files to use getDb() instead of direct db
 * This ensures all models use the tenant database when available
 * 
 * Run this script to automatically update all models:
 * node scripts/update-models-for-tenant.js
 */

const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');
const models = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js'));

console.log(`Found ${models.length} model files to check...`);

models.forEach(modelFile => {
  const modelPath = path.join(modelsDir, modelFile);
  let content = fs.readFileSync(modelPath, 'utf8');
  
  // Skip if already has getDbFromContext
  if (content.includes('getDbFromContext')) {
    console.log(`⏭️  Skipping ${modelFile} - already updated`);
    return;
  }
  
  // Skip if doesn't use db
  if (!content.includes("const db = require") && !content.includes('db.query')) {
    console.log(`⏭️  Skipping ${modelFile} - no db usage`);
    return;
  }
  
  let updated = false;
  
  // Add getDbFromContext import after db import
  if (content.includes("const db = require('../config/db')") || content.includes('const db = require("../config/db")')) {
    const dbImportLine = content.match(/const db = require\(['"]\.\.\/config\/db['"]\);/);
    if (dbImportLine) {
      const insertAfter = dbImportLine[0];
      const getDbHelper = `
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();
`;
      content = content.replace(insertAfter, insertAfter + getDbHelper);
      updated = true;
    }
  }
  
  // Replace all db.query with getDb().query
  // But be careful with db.connect() - those need special handling
  const dbQueryRegex = /(\s+)(await\s+)?db\.query\(/g;
  if (dbQueryRegex.test(content)) {
    content = content.replace(dbQueryRegex, (match, indent, awaitPart) => {
      const dbPool = indent + 'const dbPool = getDb();\n' + indent;
      const newQuery = (awaitPart || '') + 'dbPool.query(';
      return dbPool + newQuery;
    });
    updated = true;
  }
  
  // Replace return await db.query with dbPool
  const returnDbQueryRegex = /(\s+)return\s+await\s+db\.query\(/g;
  if (returnDbQueryRegex.test(content)) {
    content = content.replace(returnDbQueryRegex, (match, indent) => {
      const dbPool = indent + 'const dbPool = getDb();\n' + indent;
      return dbPool + 'return await dbPool.query(';
    });
    updated = true;
  }
  
  // Replace return db.query (without await)
  const returnDbQueryNoAwaitRegex = /(\s+)return\s+db\.query\(/g;
  if (returnDbQueryNoAwaitRegex.test(content)) {
    content = content.replace(returnDbQueryNoAwaitRegex, (match, indent) => {
      const dbPool = indent + 'const dbPool = getDb();\n' + indent;
      return dbPool + 'return dbPool.query(';
    });
    updated = true;
  }
  
  if (updated) {
    fs.writeFileSync(modelPath, content, 'utf8');
    console.log(`✅ Updated ${modelFile}`);
  } else {
    console.log(`⏭️  No changes needed for ${modelFile}`);
  }
});

console.log('\n✅ Done! All models updated.');

