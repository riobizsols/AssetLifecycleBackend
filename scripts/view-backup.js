#!/usr/bin/env node

/**
 * Helper script to view PostgreSQL backup files
 * 
 * Usage:
 *   node scripts/view-backup.js <backup-file> [options]
 * 
 * Options:
 *   --list          List all tables/objects in backup
 *   --schema        Show schema only (CREATE TABLE statements)
 *   --table <name>  Show data for specific table
 *   --convert       Convert custom format to plain SQL
 */

require('dotenv').config();
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * Find pg_restore executable
 */
async function findPgRestore() {
  const isWindows = process.platform === 'win32';
  const pgRestoreName = isWindows ? 'pg_restore.exe' : 'pg_restore';
  
  try {
    const result = await execAsync(isWindows ? `where ${pgRestoreName}` : `which ${pgRestoreName}`);
    const pgRestorePath = result.stdout.trim().split('\n')[0];
    if (pgRestorePath) {
      return pgRestorePath;
    }
  } catch (error) {
    // Not in PATH
  }
  
  // Search common Windows locations
  if (isWindows) {
    const commonPaths = [
      'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe',
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_restore.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\18\\bin\\pg_restore.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\17\\bin\\pg_restore.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\16\\bin\\pg_restore.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\15\\bin\\pg_restore.exe',
      'C:\\Program Files (x86)\\PostgreSQL\\14\\bin\\pg_restore.exe',
    ];
    
    for (const pgRestorePath of commonPaths) {
      try {
        await fs.access(pgRestorePath);
        return pgRestorePath;
      } catch (error) {
        // Continue searching
      }
    }
  }
  
  throw new Error('pg_restore not found. Please install PostgreSQL client tools.');
}

/**
 * Check if file is plain SQL or custom format
 */
async function isPlainSQL(filePath) {
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf8', flag: 'r' });
    // Plain SQL files start with -- PostgreSQL database dump
    return content.trim().startsWith('--') || content.trim().startsWith('CREATE');
  } catch (error) {
    // If we can't read as text, it's likely binary (custom format)
    return false;
  }
}

/**
 * List contents of custom format backup
 */
async function listBackupContents(backupFile, pgRestorePath) {
  console.log('\n📋 Contents of backup file:');
  console.log('=' .repeat(60));
  
  try {
    const { stdout } = await execAsync(`"${pgRestorePath}" -l "${backupFile}"`);
    console.log(stdout);
  } catch (error) {
    console.error('Error listing backup contents:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
  }
}

/**
 * Show schema only
 */
async function showSchema(backupFile, pgRestorePath, tableName = null) {
  console.log('\n📐 Database Schema:');
  console.log('=' .repeat(60));
  
  try {
    // Use -f - to output to stdout
    let command = `"${pgRestorePath}" --schema-only -f - "${backupFile}"`;
    if (tableName) {
      command = `"${pgRestorePath}" --schema-only -t ${tableName} -f - "${backupFile}"`;
    }
    
    const { stdout } = await execAsync(command);
    console.log(stdout);
  } catch (error) {
    console.error('Error showing schema:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
  }
}

/**
 * Show table data
 */
async function showTableData(backupFile, pgRestorePath, tableName) {
  console.log(`\n📊 Data for table: ${tableName}`);
  console.log('=' .repeat(60));
  
  try {
    // Use -f - to output to stdout
    const { stdout } = await execAsync(`"${pgRestorePath}" -t ${tableName} -f - "${backupFile}"`);
    console.log(stdout);
  } catch (error) {
    console.error(`Error showing data for table ${tableName}:`, error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
  }
}

/**
 * Convert custom format to plain SQL
 */
async function convertToPlainSQL(backupFile, pgRestorePath, outputFile) {
  console.log('\n🔄 Converting to plain SQL...');
  console.log('=' .repeat(60));
  
  try {
    // Use pg_restore with -f flag to specify output file
    const { stdout, stderr } = await execAsync(`"${pgRestorePath}" -f "${outputFile}" "${backupFile}"`);
    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('WARNING')) {
      console.warn('Warnings:', stderr);
    }
    console.log(`✅ Converted to: ${outputFile}`);
    console.log(`You can now open this file in any text editor.`);
  } catch (error) {
    console.error('Error converting backup:', error.message);
    if (error.stderr) {
      console.error(error.stderr);
    }
  }
}

/**
 * View plain SQL file
 */
async function viewPlainSQL(filePath, lines = 50) {
  console.log(`\n📄 First ${lines} lines of plain SQL file:`);
  console.log('=' .repeat(60));
  
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf8' });
    const linesArray = content.split('\n');
    const preview = linesArray.slice(0, lines).join('\n');
    console.log(preview);
    if (linesArray.length > lines) {
      console.log(`\n... (${linesArray.length - lines} more lines)`);
      console.log(`\n💡 Tip: Open the file in a text editor to view the full content.`);
    }
  } catch (error) {
    console.error('Error reading file:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node scripts/view-backup.js <backup-file> [options]

Options:
  --list                    List all tables/objects in backup
  --schema [table]          Show schema only (optional: specific table)
  --table <name>            Show data for specific table
  --convert [output-file]   Convert custom format to plain SQL
  --preview [lines]         Preview plain SQL file (default: 50 lines)

Examples:
  node scripts/view-backup.js backups/postgresql/backup.sql --list
  node scripts/view-backup.js backups/postgresql/backup.sql --schema
  node scripts/view-backup.js backups/postgresql/backup.sql --table tblAssets
  node scripts/view-backup.js backups/postgresql/backup.sql --convert readable.sql
  node scripts/view-backup.js backups/postgresql/backup_plain.sql --preview 100
    `);
    process.exit(1);
  }
  
  const backupFile = args[0];
  
  // Check if file exists
  try {
    await fs.access(backupFile);
  } catch (error) {
    console.error(`❌ Error: Backup file not found: ${backupFile}`);
    process.exit(1);
  }
  
  // Check if it's plain SQL or custom format
  const isPlain = await isPlainSQL(backupFile);
  
  if (isPlain) {
    console.log('✅ Detected: Plain SQL format (readable text file)');
    
    if (args.includes('--preview')) {
      const linesIndex = args.indexOf('--preview');
      const lines = args[linesIndex + 1] ? parseInt(args[linesIndex + 1]) : 50;
      await viewPlainSQL(backupFile, lines);
    } else if (args.includes('--convert')) {
      console.log('ℹ️  File is already in plain SQL format. No conversion needed.');
      console.log(`💡 You can open it directly: ${backupFile}`);
    } else {
      // Default: show preview
      await viewPlainSQL(backupFile, 50);
    }
  } else {
    console.log('✅ Detected: Custom format (binary, requires pg_restore)');
    
    // Find pg_restore
    let pgRestorePath;
    try {
      pgRestorePath = await findPgRestore();
      console.log(`📍 Using: ${pgRestorePath}\n`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
    
    // Handle different options
    if (args.includes('--list')) {
      await listBackupContents(backupFile, pgRestorePath);
    } else if (args.includes('--schema')) {
      const tableIndex = args.indexOf('--schema');
      const tableName = args[tableIndex + 1] && !args[tableIndex + 1].startsWith('--') 
        ? args[tableIndex + 1] 
        : null;
      await showSchema(backupFile, pgRestorePath, tableName);
    } else if (args.includes('--table')) {
      const tableIndex = args.indexOf('--table');
      const tableName = args[tableIndex + 1];
      if (!tableName) {
        console.error('❌ Error: --table requires a table name');
        process.exit(1);
      }
      await showTableData(backupFile, pgRestorePath, tableName);
    } else if (args.includes('--convert')) {
      const convertIndex = args.indexOf('--convert');
      const outputFile = args[convertIndex + 1] && !args[convertIndex + 1].startsWith('--')
        ? args[convertIndex + 1]
        : backupFile.replace(/\.sql$/, '_readable.sql');
      await convertToPlainSQL(backupFile, pgRestorePath, outputFile);
    } else {
      // Default: list contents
      console.log('ℹ️  No option specified. Showing backup contents...\n');
      await listBackupContents(backupFile, pgRestorePath);
    }
  }
}

// Run main function
main().catch(console.error);

