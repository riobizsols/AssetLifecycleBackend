const backupService = require('../scripts/backup-database');
const fs = require('fs').promises;
const path = require('path');

/**
 * POST /api/backup/trigger
 * Manually trigger a database backup
 */
const triggerBackup = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Check if user has permission (you can add role-based checks here)
    // if (!req.user || req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }
    
    console.log('Manual backup triggered by user:', req.user?.user_id);
    
    // Run backup asynchronously (don't wait for completion)
    const backupPromise = backupService.runBackup();
    
    // Return immediate response
    res.status(202).json({
      success: true,
      message: 'Backup process started',
      timestamp: new Date().toISOString(),
    });
    
    // Wait for backup to complete (for logging)
    backupPromise
      .then((result) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`Backup completed successfully in ${duration}s:`, result.filename);
      })
      .catch((error) => {
        console.error('Backup failed:', error);
      });
    
  } catch (error) {
    console.error('Error triggering backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger backup',
      message: error.message,
    });
  }
};

/**
 * GET /api/backup/status
 * Get backup status and recent backups
 */
const getBackupStatus = async (req, res) => {
  try {
    const backupDir = backupService.config.backupDir;
    
    // Get list of backup files
    let backups = [];
    try {
      const files = await fs.readdir(backupDir);
      
      for (const file of files) {
        // Skip checksum and log files
        if (file.endsWith('.md5') || file.endsWith('.log')) {
          continue;
        }
        
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        
        backups.push({
          filename: file,
          size: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          created: stats.birthtime || stats.mtime,
          modified: stats.mtime,
        });
      }
      
      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);
      
    } catch (error) {
      // Directory doesn't exist or can't be accessed
      console.warn('Backup directory not accessible:', error.message);
    }
    
    // Get latest backup log
    const logDir = backupService.config.logDir;
    let latestLog = null;
    try {
      const logFiles = await fs.readdir(logDir);
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(logDir, `backup-${today}.log`);
      
      if (await fs.access(logFile).then(() => true).catch(() => false)) {
        const logContent = await fs.readFile(logFile, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        latestLog = lines.slice(-10).join('\n'); // Last 10 lines
      }
    } catch (error) {
      // Log directory not accessible
    }
    
    // Calculate disk space
    let diskUsage = null;
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(`df -h ${backupDir} | tail -1`);
      const parts = stdout.trim().split(/\s+/);
      
      diskUsage = {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mounted: parts[5],
      };
    } catch (error) {
      // Could not get disk usage
    }
    
    res.json({
      success: true,
      config: {
        backupDir: backupDir,
        retentionDays: backupService.config.retentionDays,
        compression: backupService.config.compression,
        encryption: backupService.config.encrypt,
        storageOptions: {
          local: backupService.config.enableLocalStorage,
          remote: backupService.config.enableRemoteStorage,
          s3: backupService.config.enableS3Storage,
          minio: backupService.config.enableMinIOStorage,
        },
      },
      backups: {
        total: backups.length,
        list: backups.slice(0, 20), // Last 20 backups
        totalSizeMB: backups.reduce((sum, b) => sum + parseFloat(b.sizeMB), 0).toFixed(2),
        latest: backups[0] || null,
      },
      latestLog: latestLog,
      diskUsage: diskUsage,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup status',
      message: error.message,
    });
  }
};

/**
 * GET /api/backup/list
 * Get list of all backups
 */
const listBackups = async (req, res) => {
  try {
    const backupDir = backupService.config.backupDir;
    const files = await fs.readdir(backupDir);
    
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.md5') || file.endsWith('.log')) {
        continue;
      }
      
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);
      
      backups.push({
        filename: file,
        size: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        created: stats.birthtime || stats.mtime,
        modified: stats.mtime,
        age: Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24)), // days
      });
    }
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => b.created - a.created);
    
    res.json({
      success: true,
      backups: backups,
      count: backups.length,
    });
    
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      message: error.message,
    });
  }
};

/**
 * GET /api/backup/download/:filename
 * Download a backup file (with authentication check)
 */
const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const backupDir = backupService.config.backupDir;
    const filePath = path.join(backupDir, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream file to response
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup',
      message: error.message,
    });
  }
};

/**
 * DELETE /api/backup/:filename
 * Delete a backup file
 */
const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const backupDir = backupService.config.backupDir;
    const filePath = path.join(backupDir, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Delete file and checksum if exists
    await fs.unlink(filePath);
    
    const checksumFile = `${filePath}.md5`;
    try {
      await fs.unlink(checksumFile);
    } catch (error) {
      // Checksum file doesn't exist, that's OK
    }
    
    res.json({
      success: true,
      message: 'Backup file deleted successfully',
    });
    
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      message: error.message,
    });
  }
};

module.exports = {
  triggerBackup,
  getBackupStatus,
  listBackups,
  downloadBackup,
  deleteBackup,
};
