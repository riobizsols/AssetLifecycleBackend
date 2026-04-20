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
const logFile = path.join(__dirname, '../logs', `add-is-recurring-migration-${Date.now()}.log`);
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
    log('Starting Migration: Add is_recurring column to tblATMaintFreq');
    log('========================================');
    log('Database: ' + connectionString.replace(/:[^:@]+@/, ':****@'));
    log('');

    client = await pool.connect();
    
    // Start transaction
    await client.query('BEGIN');
    log('✓ Transaction started');

    // Check if column already exists
    log('\n1. Checking if is_recurring column exists...');
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tblATMaintFreq' 
      AND column_name = 'is_recurring'
    `);

    if (checkColumn.rows.length > 0) {
      log('⚠️  Column is_recurring already exists in tblATMaintFreq');
      await client.query('ROLLBACK');
      log('✓ Transaction rolled back (no changes needed)');
      return;
    }

    log('✓ Column does not exist, proceeding with addition');

    // Add is_recurring column with default value true for existing records
    log('\n2. Adding is_recurring column...');
    const addColumnQuery = `
      ALTER TABLE "tblATMaintFreq" 
      ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT true
    `;
    
    await client.query(addColumnQuery);
    log('✓ Column is_recurring added successfully');

    // Add comment to the column for documentation
    log('\n3. Adding column comment...');
    await client.query(`
      COMMENT ON COLUMN "tblATMaintFreq".is_recurring IS 
      'Indicates if maintenance is recurring (true) or on-demand (false). For on-demand maintenance, frequency/uom/text fields may be null.'
    `);
    log('✓ Column comment added');

    // Verify the column was added
    log('\n4. Verifying column addition...');
    const verifyColumn = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tblATMaintFreq' 
      AND column_name = 'is_recurring'
    `);

    if (verifyColumn.rows.length === 0) {
      throw new Error('Column verification failed - column not found after addition');
    }

    log('✓ Column verified:');
    log(`  - Name: ${verifyColumn.rows[0].column_name}`);
    log(`  - Type: ${verifyColumn.rows[0].data_type}`);
    log(`  - Nullable: ${verifyColumn.rows[0].is_nullable}`);
    log(`  - Default: ${verifyColumn.rows[0].column_default}`);

    // Get count of existing records
    log('\n5. Checking existing records...');
    const countResult = await client.query('SELECT COUNT(*) as count FROM "tblATMaintFreq"');
    const recordCount = parseInt(countResult.rows[0].count);
    log(`✓ Found ${recordCount} existing records (all will have is_recurring = true by default)`);

    // Commit transaction
    await client.query('COMMIT');
    log('\n✓ Transaction committed successfully');
    
    log('\n========================================');
    log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    log('========================================');
    log('\nSummary:');
    log('  - Added column: is_recurring (BOOLEAN, NOT NULL, DEFAULT true)');
    log(`  - Affected records: ${recordCount} (all set to recurring by default)`);
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
