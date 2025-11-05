#!/usr/bin/env node

/**
 * PostgreSQL Database Backup Script
 * 
 * This script creates automated backups of the PostgreSQL database.
 * It can be run:
 * 1. Manually: node scripts/backup-database.js
 * 2. Via cron: Add to crontab for automatic daily backups
 * 3. Via API: Integrated with Express.js endpoints
 * 
 * Features:
 * - Compressed backups (gzip)
 * - Optional encryption (GPG)
 * - Automatic rotation (keeps N days of backups)
 * - Multiple storage destinations (local, remote, S3/MinIO)
 * - Email notifications on success/failure
 * - Detailed logging
 */

require('dotenv').config();
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);

// Configuration
const config = {
  // Database connection (parse from DATABASE_URL)
  dbConfig: parseDatabaseUrl(process.env.DATABASE_URL),
  
  // Backup settings
  backupDir: process.env.BACKUP_DIR || '/var/backups/postgresql',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  compression: process.env.BACKUP_COMPRESSION !== 'false', // default: true
  encrypt: process.env.BACKUP_ENCRYPT === 'true', // default: false
  
  // Storage destinations
  enableLocalStorage: process.env.BACKUP_LOCAL !== 'false',
  enableRemoteStorage: process.env.BACKUP_REMOTE === 'true',
  enableS3Storage: process.env.BACKUP_S3 === 'true',
  enableMinIOStorage: process.env.BACKUP_MINIO === 'true',
  
  // Remote server (SSH/SCP)
  remoteHost: process.env.BACKUP_REMOTE_HOST,
  remoteUser: process.env.BACKUP_REMOTE_USER,
  remotePath: process.env.BACKUP_REMOTE_PATH || '/backups/postgresql',
  remoteSSHKey: process.env.BACKUP_REMOTE_SSH_KEY,
  
  // S3/MinIO settings
  s3Endpoint: process.env.MINIO_END_POINT || process.env.S3_ENDPOINT,
  s3Port: process.env.MINIO_PORT || process.env.S3_PORT || '9000',
  s3UseSSL: process.env.MINIO_USE_SSL === 'true' || process.env.S3_USE_SSL === 'true',
  s3AccessKey: process.env.MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY,
  s3SecretKey: process.env.MINIO_SECRET_KEY || process.env.S3_SECRET_KEY,
  s3Bucket: process.env.BACKUP_S3_BUCKET || 'database-backups',
  s3Region: process.env.S3_REGION || 'us-east-1',
  
  // Encryption settings
  gpgRecipient: process.env.BACKUP_GPG_RECIPIENT,
  gpgKeyFile: process.env.BACKUP_GPG_KEY_FILE,
  
  // Notification settings
  enableEmailNotifications: process.env.BACKUP_EMAIL_NOTIFY === 'true',
  emailTo: process.env.BACKUP_EMAIL_TO,
  emailFrom: process.env.BACKUP_EMAIL_FROM || process.env.EMAIL_USER,
  
  // Logging
  logDir: process.env.BACKUP_LOG_DIR || '/var/log/postgresql-backups',
  verbose: process.env.BACKUP_VERBOSE === 'true',
};

/**
 * Parse PostgreSQL connection URL
 */
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Parse postgresql://user:password@host:port/database
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Get current timestamp for backup filename
 */
function getBackupFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${config.dbConfig.database}_${timestamp}_${time}`;
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Log message with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  // Write to log file
  const logFile = path.join(config.logDir, `backup-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFile(logFile, logMessage + '\n').catch(err => {
    console.error('Failed to write to log file:', err);
  });
}

/**
 * Create database backup using pg_dump
 */
async function createBackup() {
  const filename = getBackupFilename();
  const backupPath = path.join(config.backupDir, filename);
  const sqlFile = `${backupPath}.sql`;
  const compressedFile = `${backupPath}.sql.gz`;
  
  log(`Starting backup: ${filename}`);
  log(`Database: ${config.dbConfig.database}`);
  log(`Host: ${config.dbConfig.host}:${config.dbConfig.port}`);
  
  // Set PGPASSWORD environment variable for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: config.dbConfig.password,
  };
  
  try {
    // Create backup directory if it doesn't exist
    await ensureDirectory(config.backupDir);
    await ensureDirectory(config.logDir);
    
    // Build pg_dump command
    let dumpCommand = `pg_dump -h ${config.dbConfig.host} -p ${config.dbConfig.port} -U ${config.dbConfig.user} -d ${config.dbConfig.database} -F c -f "${sqlFile}"`;
    
    // Add compression flag if not using custom format
    if (!config.compression) {
      dumpCommand = `pg_dump -h ${config.dbConfig.host} -p ${config.dbConfig.port} -U ${config.dbConfig.user} -d ${config.dbConfig.database} -F p -f "${sqlFile}"`;
    }
    
    log(`Executing: ${dumpCommand.replace(config.dbConfig.password, '***')}`);
    
    // Execute pg_dump
    const { stdout, stderr } = await execAsync(dumpCommand, { env });
    
    if (stderr && !stderr.includes('WARNING')) {
      log(`pg_dump warnings: ${stderr}`, 'WARN');
    }
    
    log(`Backup file created: ${sqlFile}`);
    
    // Compress backup
    let finalBackupFile = sqlFile;
    if (config.compression && dumpCommand.includes('-F c')) {
      // Custom format is already compressed
      finalBackupFile = sqlFile;
      log('Backup is in compressed custom format');
    } else if (config.compression) {
      log('Compressing backup...');
      await execAsync(`gzip -f "${sqlFile}"`);
      finalBackupFile = compressedFile;
      log(`Backup compressed: ${finalBackupFile}`);
    }
    
    // Get backup file size
    const stats = await fs.stat(finalBackupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    log(`Backup size: ${fileSizeMB} MB`);
    
    // Encrypt backup if enabled
    if (config.encrypt) {
      finalBackupFile = await encryptBackup(finalBackupFile);
    }
    
    // Calculate checksum
    const checksum = await calculateChecksum(finalBackupFile);
    const checksumFile = `${finalBackupFile}.md5`;
    await fs.writeFile(checksumFile, `${checksum}  ${path.basename(finalBackupFile)}\n`);
    log(`Checksum created: ${checksum}`);
    
    return {
      success: true,
      file: finalBackupFile,
      checksum: checksum,
      size: stats.size,
      filename: filename,
    };
    
  } catch (error) {
    log(`Backup failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Encrypt backup file using GPG
 */
async function encryptBackup(backupFile) {
  if (!config.gpgRecipient && !config.gpgKeyFile) {
    log('Encryption enabled but no GPG recipient or key file specified', 'WARN');
    return backupFile;
  }
  
  log('Encrypting backup...');
  
  try {
    let gpgCommand;
    if (config.gpgRecipient) {
      gpgCommand = `gpg --encrypt --recipient "${config.gpgRecipient}" --output "${backupFile}.gpg" "${backupFile}"`;
    } else {
      gpgCommand = `gpg --encrypt --recipient-file "${config.gpgKeyFile}" --output "${backupFile}.gpg" "${backupFile}"`;
    }
    
    await execAsync(gpgCommand);
    
    // Remove unencrypted file
    await fs.unlink(backupFile);
    
    log(`Backup encrypted: ${backupFile}.gpg`);
    return `${backupFile}.gpg`;
    
  } catch (error) {
    log(`Encryption failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Calculate MD5 checksum of file
 */
async function calculateChecksum(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Upload backup to remote server via SCP
 */
async function uploadToRemote(backupFile) {
  if (!config.enableRemoteStorage || !config.remoteHost) {
    return;
  }
  
  log(`Uploading to remote server: ${config.remoteHost}`);
  
  try {
    let scpCommand = `scp`;
    
    if (config.remoteSSHKey) {
      scpCommand += ` -i ${config.remoteSSHKey}`;
    }
    
    scpCommand += ` "${backupFile}" ${config.remoteUser}@${config.remoteHost}:${config.remotePath}/`;
    
    // Also copy checksum file
    const checksumFile = `${backupFile}.md5`;
    if (await fs.access(checksumFile).then(() => true).catch(() => false)) {
      scpCommand += ` && scp`;
      if (config.remoteSSHKey) {
        scpCommand += ` -i ${config.remoteSSHKey}`;
      }
      scpCommand += ` "${checksumFile}" ${config.remoteUser}@${config.remoteHost}:${config.remotePath}/`;
    }
    
    await execAsync(scpCommand);
    log(`Successfully uploaded to remote server`);
    
  } catch (error) {
    log(`Remote upload failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Upload backup to S3/MinIO
 */
async function uploadToS3(backupFile) {
  if (!config.enableS3Storage && !config.enableMinIOStorage) {
    return;
  }
  
  log(`Uploading to S3/MinIO: ${config.s3Bucket}`);
  
  try {
    // Use AWS CLI or MinIO client (mc)
    // First check if AWS CLI is available
    try {
      await execAsync('which aws');
      
      const s3Url = `s3://${config.s3Bucket}/${path.basename(backupFile)}`;
      let awsCommand = `aws s3 cp "${backupFile}" "${s3Url}"`;
      
      if (config.s3Endpoint) {
        awsCommand += ` --endpoint-url http${config.s3UseSSL ? 's' : ''}://${config.s3Endpoint}:${config.s3Port}`;
      }
      
      await execAsync(awsCommand, {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: config.s3AccessKey,
          AWS_SECRET_ACCESS_KEY: config.s3SecretKey,
        },
      });
      
      log(`Successfully uploaded to S3/MinIO`);
      
    } catch (error) {
      // Try MinIO client (mc) instead
      try {
        await execAsync('which mc');
        
        const minioAlias = 'backup-minio';
        const targetPath = `${minioAlias}/${config.s3Bucket}/${path.basename(backupFile)}`;
        
        // Configure MinIO client (if not already configured)
        // mc alias set backup-minio http://endpoint:port access_key secret_key
        const mcConfigCommand = `mc alias set ${minioAlias} http${config.s3UseSSL ? 's' : ''}://${config.s3Endpoint}:${config.s3Port} ${config.s3AccessKey} ${config.s3SecretKey} || true`;
        await execAsync(mcConfigCommand);
        
        // Upload file
        await execAsync(`mc cp "${backupFile}" "${targetPath}"`);
        log(`Successfully uploaded to MinIO`);
        
      } catch (mcError) {
        throw new Error(`Neither AWS CLI nor MinIO client is installed. Install one: sudo apt install awscli OR download mc from https://min.io/download`);
      }
    }
    
  } catch (error) {
    log(`S3/MinIO upload failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Clean up old backups (retention policy)
 */
async function cleanupOldBackups() {
  log(`Cleaning up backups older than ${config.retentionDays} days...`);
  
  try {
    const files = await fs.readdir(config.backupDir);
    const now = Date.now();
    const maxAge = config.retentionDays * 24 * 60 * 60 * 1000; // milliseconds
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(config.backupDir, file);
      
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
          log(`Deleted old backup: ${file}`);
        }
      } catch (error) {
        // Skip if file doesn't exist or can't be accessed
        continue;
      }
    }
    
    log(`Cleanup completed: ${deletedCount} old backups deleted`);
    
  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'WARN');
  }
}

/**
 * Send email notification
 */
async function sendNotification(success, message, backupInfo = null) {
  if (!config.enableEmailNotifications || !config.emailTo) {
    return;
  }
  
  // This is a placeholder - integrate with your email service (nodemailer)
  log(`Email notification would be sent to: ${config.emailTo}`);
  log(`Subject: Database Backup ${success ? 'SUCCESS' : 'FAILED'}`);
  log(`Message: ${message}`);
  
  // TODO: Implement actual email sending using nodemailer
  // const nodemailer = require('nodemailer');
  // ... email sending code ...
}

/**
 * Main backup function
 */
async function runBackup() {
  const startTime = Date.now();
  let backupInfo = null;
  
  try {
    log('=== PostgreSQL Backup Started ===');
    
    // Create backup
    backupInfo = await createBackup();
    log(`Backup created successfully: ${backupInfo.filename}`);
    
    // Upload to storage destinations
    if (config.enableLocalStorage) {
      log('Local storage: Enabled (backup stored locally)');
    }
    
    if (config.enableRemoteStorage) {
      await uploadToRemote(backupInfo.file);
    }
    
    if (config.enableS3Storage || config.enableMinIOStorage) {
      await uploadToS3(backupInfo.file);
    }
    
    // Cleanup old backups
    await cleanupOldBackups();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`=== Backup Completed Successfully in ${duration}s ===`);
    
    // Send success notification
    await sendNotification(true, `Database backup completed successfully. File: ${backupInfo.filename}, Size: ${(backupInfo.size / (1024 * 1024)).toFixed(2)} MB`, backupInfo);
    
    return {
      success: true,
      ...backupInfo,
      duration: duration,
    };
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`=== Backup Failed after ${duration}s ===`, 'ERROR');
    
    // Send failure notification
    await sendNotification(false, `Database backup failed: ${error.message}`);
    
    throw error;
  }
}

// Run backup if script is executed directly
if (require.main === module) {
  runBackup()
    .then((result) => {
      if (config.verbose) {
        console.log('Backup Result:', JSON.stringify(result, null, 2));
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('Backup Error:', error);
      process.exit(1);
    });
}

// Export for use in other modules
module.exports = {
  runBackup,
  createBackup,
  cleanupOldBackups,
  config,
};
