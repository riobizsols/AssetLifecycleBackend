#!/usr/bin/env node

/**
 * Migration Runner: Create tblATInspCert Table
 * 
 * This script creates the inspection certificates mapping table in the database.
 * Run this after deploying the inspection certificates feature.
 * 
 * Usage: node run-inspection-cert-migration.js
 */

const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigration() {
  
  try {
    console.log('🔍 Checking if tblATInspCert table exists...');
    
    // Check if table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblATInspCert'
      );
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Table tblATInspCert already exists.');
      const data = await pool.query('SELECT * FROM "tblATInspCert" LIMIT 5');
      console.log('SAMPLE_DATA_START');
      console.log(JSON.stringify(data.rows, null, 2));
      console.log('SAMPLE_DATA_END');
      process.exit(0);
    }
    
    console.log('📝 Creating tblATInspCert table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', 'create_tblATInspCert.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Successfully created tblATInspCert table!');
    console.log('🎉 Inspection certificates feature is now ready to use.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // Ignore pool closing errors
    }
  }
}

// Run the migration
runMigration();
