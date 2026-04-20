const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Get database connection string from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

// Create log file
const logFile = path.join(__dirname, '../logs', `alter-nullable-fields-${Date.now()}.log`);
const logDir = path.dirname(logFile);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

async function runMigration() {
  let client;
  
  try {
    log('========================================');
    log('Starting Migration: Make frequency, uom, text nullable in tblATMaintFreq');
    log('========================================');
    log('Database: ' + connectionString.replace(/:[^:@]+@/, ':****@'));
    log('');

    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    log('✓ Transaction started');

    // Check current nullable status
    log('\n1. Checking current column constraints...');
    const checkCols = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns 
      WHERE table_name = 'tblATMaintFreq' 
      AND column_name IN ('frequency', 'uom', 'text')
      ORDER BY column_name
    `);

    log('Current column constraints:');
    checkCols.rows.forEach(col => {
      log(`  - ${col.column_name}: ${col.data_type}, nullable=${col.is_nullable}`);
    });

    // Alter frequency to allow NULL
    log('\n2. Altering frequency column to allow NULL...');
    await client.query(`
      ALTER TABLE "tblATMaintFreq" 
      ALTER COLUMN frequency DROP NOT NULL
    `);
    log('✓ frequency column now allows NULL');

    // Alter uom to allow NULL
    log('\n3. Altering uom column to allow NULL...');
    await client.query(`
      ALTER TABLE "tblATMaintFreq" 
      ALTER COLUMN uom DROP NOT NULL
    `);
    log('✓ uom column now allows NULL');

    // Alter text to allow NULL
    log('\n4. Altering text column to allow NULL...');
    await client.query(`
      ALTER TABLE "tblATMaintFreq" 
      ALTER COLUMN text DROP NOT NULL
    `);
    log('✓ text column now allows NULL');

    // Verify the changes
    log('\n5. Verifying column changes...');
    const verifyColumns = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns 
      WHERE table_name = 'tblATMaintFreq' 
      AND column_name IN ('frequency', 'uom', 'text')
      ORDER BY column_name
    `);

    log('Updated column constraints:');
    let allNullable = true;
    verifyColumns.rows.forEach(col => {
      log(`  - ${col.column_name}: ${col.data_type}, nullable=${col.is_nullable}`);
      if (col.is_nullable !== 'YES') {
        allNullable = false;
      }
    });

    if (!allNullable) {
      throw new Error('Column verification failed - some columns are still NOT NULL');
    }

    // Commit transaction
    await client.query('COMMIT');
    log('\n✓ Transaction committed successfully');
    
    log('\n========================================');
    log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    log('========================================');
    log('\nSummary:');
    log('  - frequency: Now allows NULL (for on-demand maintenance)');
    log('  - uom: Now allows NULL (for on-demand maintenance)');
    log('  - text: Now allows NULL (for on-demand maintenance)');
    log('  - Log file: ' + logFile);
    log('\n');

  } catch (error) {
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
        log('\n❌ Transaction rolled back due to error');
      } catch (rollbackError) {
        log('\n❌ Error during rollback: ' + rollbackError.message);
      }
    }
    
    log('\n========================================');
    log('❌ MIGRATION FAILED!');
    log('========================================');
    log('Error: ' + error.message);
    log('Stack: ' + error.stack);
    
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    log('\nMigration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error.message);
    process.exit(1);
  });
