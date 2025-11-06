# Testing Backup System Locally on Windows

## 🚀 Quick Start Guide

### Step 1: Check Prerequisites

First, verify you have the required tools installed:

```powershell
# Check Node.js
node --version

# Check PostgreSQL (pg_dump should be available)
pg_dump --version

# If pg_dump is not found, add PostgreSQL bin to PATH:
# C:\Program Files\PostgreSQL\<version>\bin
```

### Step 2: Create Backup Directories

Create directories for backups and logs on Windows:

```powershell
# Create backup directory (choose a location you prefer)
mkdir C:\backups\postgresql -Force

# Create log directory
mkdir C:\logs\postgresql-backups -Force

# OR use relative paths (inside project)
mkdir backups\postgresql -Force
mkdir logs\postgresql-backups -Force
```

### Step 3: Configure .env File

Add these lines to your `AssetLifecycleBackend/.env` file:

```bash
# Backup Configuration for Local Testing
BACKUP_DIR=C:\backups\postgresql
# OR use relative path: BACKUP_DIR=./backups/postgresql

BACKUP_LOG_DIR=C:\logs\postgresql-backups
# OR use relative path: BACKUP_LOG_DIR=./logs/postgresql-backups

BACKUP_RETENTION_DAYS=7
BACKUP_COMPRESSION=true
BACKUP_ENCRYPT=false

# Storage Options (for local testing, only local storage)
BACKUP_LOCAL=true
BACKUP_REMOTE=false
BACKUP_S3=false
BACKUP_MINIO=false

# Logging
BACKUP_VERBOSE=true
```

### Step 4: Test the Backup Script

```powershell
# Navigate to backend directory
cd AssetLifecycleBackend

# Run the backup script manually
node scripts/backup-database.js
```

### Step 5: Verify Backup Created

```powershell
# Check if backup file was created
dir C:\backups\postgresql

# OR if using relative path
dir backups\postgresql

# Check log file
dir C:\logs\postgresql-backups
# OR
dir logs\postgresql-backups
```

---

## 📝 Detailed Testing Steps

### Test 1: Basic Backup (No Compression)

**1. Update .env:**
```bash
BACKUP_COMPRESSION=false
```

**2. Run backup:**
```powershell
node scripts/backup-database.js
```

**3. Expected Output:**
```
[2025-01-15T10:30:00] [INFO] Starting backup: assetlifecycle_2025-01-15_10-30-00
[2025-01-15T10:30:00] [INFO] Database: assetlifecycle
[2025-01-15T10:30:00] [INFO] Host: localhost:5432
[2025-01-15T10:30:05] [INFO] Backup file created: C:\backups\postgresql\assetlifecycle_2025-01-15_10-30-00.sql
[2025-01-15T10:30:05] [INFO] Backup size: 2.45 MB
[2025-01-15T10:30:05] [INFO] Checksum created: a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6
[2025-01-15T10:30:05] [INFO] === Backup Completed Successfully in 5.23s ===
```

**4. Verify files:**
```powershell
dir C:\backups\postgresql\assetlifecycle_2025-01-15_10-30-00.*
```

You should see:
- `assetlifecycle_2025-01-15_10-30-00.sql` (backup file)
- `assetlifecycle_2025-01-15_10-30-00.sql.md5` (checksum file)

---

### Test 2: Compressed Backup (Default)

**1. Update .env:**
```bash
BACKUP_COMPRESSION=true
```

**2. Run backup:**
```powershell
node scripts/backup-database.js
```

**3. Expected Output:**
```
[2025-01-15T10:35:00] [INFO] Starting backup: assetlifecycle_2025-01-15_10-35-00
[2025-01-15T10:35:00] [INFO] Compressing backup...
[2025-01-15T10:35:01] [INFO] Backup compressed: C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.sql.gz
[2025-01-15T10:35:01] [INFO] Backup size: 0.82 MB
```

**4. Verify files:**
```powershell
dir C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.*
```

You should see:
- `assetlifecycle_2025-01-15_10-35-00.sql.gz` (compressed backup)
- `assetlifecycle_2025-01-15_10-35-00.sql.gz.md5` (checksum file)

---

### Test 3: Verify Backup Integrity

**1. Check checksum:**
```powershell
# Read the checksum file
Get-Content C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.sql.gz.md5

# Calculate MD5 of backup file
Get-FileHash -Path C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.sql.gz -Algorithm MD5
```

**2. Compare:** The hash in the `.md5` file should match the calculated hash.

---

### Test 4: Test Restore (Verify Backup Works)

**1. Create a test database:**
```powershell
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE test_restore_db;
\q
```

**2. Restore from backup:**
```powershell
# For compressed backup (.gz)
# First extract (if using gzip on Windows, you might need 7-Zip or similar)
# OR use pg_restore directly with compressed format

# For custom format (compressed):
pg_restore -h localhost -U postgres -d test_restore_db C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.sql.gz

# OR if extracted:
pg_restore -h localhost -U postgres -d test_restore_db C:\backups\postgresql\assetlifecycle_2025-01-15_10-35-00.sql
```

**3. Verify restore:**
```powershell
psql -U postgres -d test_restore_db -c "SELECT COUNT(*) FROM information_schema.tables;"
```

**4. Clean up test database:**
```powershell
psql -U postgres -c "DROP DATABASE test_restore_db;"
```

---

### Test 5: Test Backup Rotation (Cleanup)

**1. Create old backup files manually:**
```powershell
# Create a file with old date in name
New-Item -Path "C:\backups\postgresql\assetlifecycle_2024-12-01_02-00-00.sql.gz" -ItemType File
```

**2. Update .env to keep only 7 days:**
```bash
BACKUP_RETENTION_DAYS=7
```

**3. Run backup:**
```powershell
node scripts/backup-database.js
```

**4. Check cleanup:**
```powershell
# The old backup should be deleted
dir C:\backups\postgresql
```

---

### Test 6: Test via API (If Server is Running)

**1. Make sure your Express server is running:**
```powershell
cd AssetLifecycleBackend
npm start
# OR
node server.js
```

**2. Trigger backup via API:**
```powershell
# Get your JWT token first (login)
$token = "YOUR_JWT_TOKEN_HERE"

# Trigger backup
Invoke-RestMethod -Uri "http://localhost:5000/api/backup/trigger" `
  -Method Post `
  -Headers @{Authorization = "Bearer $token"}
```

**3. Check backup status:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/backup/status" `
  -Method Get `
  -Headers @{Authorization = "Bearer $token"}
```

**4. List backups:**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/backup/list" `
  -Method Get `
  -Headers @{Authorization = "Bearer $token"}
```

---

## 🔧 Troubleshooting

### Issue: `pg_dump` command not found

**Solution:**
```powershell
# Add PostgreSQL bin to PATH
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

# Or install PostgreSQL client tools
# Download from: https://www.postgresql.org/download/windows/
```

### Issue: Permission denied creating directories

**Solution:**
```powershell
# Run PowerShell as Administrator
# OR use relative paths in project directory
BACKUP_DIR=./backups/postgresql
BACKUP_LOG_DIR=./logs/postgresql-backups
```

### Issue: Database connection fails

**Solution:**
```powershell
# Verify DATABASE_URL in .env
# Format: postgresql://username:password@localhost:5432/database_name

# Test connection manually
psql -U postgres -d assetlifecycle -c "SELECT 1;"
```

### Issue: Backup file not created

**Solution:**
```powershell
# Check logs
Get-Content C:\logs\postgresql-backups\backup-$(Get-Date -Format "yyyy-MM-dd").log

# Enable verbose mode in .env
BACKUP_VERBOSE=true
```

### Issue: gzip not available on Windows

**Solution:**
```powershell
# Option 1: Use 7-Zip (if installed)
# Option 2: Install Git Bash (includes gzip)
# Option 3: Install WSL (Windows Subsystem for Linux)
# Option 4: Disable compression for local testing
BACKUP_COMPRESSION=false
```

---

## 📊 Expected Results

After running the backup, you should see:

### Files Created:
```
C:\backups\postgresql\
├── assetlifecycle_2025-01-15_10-30-00.sql.gz
└── assetlifecycle_2025-01-15_10-30-00.sql.gz.md5

C:\logs\postgresql-backups\
└── backup-2025-01-15.log
```

### Log File Contents:
```
[2025-01-15T10:30:00.000Z] [INFO] === PostgreSQL Backup Started ===
[2025-01-15T10:30:00.123Z] [INFO] Starting backup: assetlifecycle_2025-01-15_10-30-00
[2025-01-15T10:30:00.124Z] [INFO] Database: assetlifecycle
[2025-01-15T10:30:00.125Z] [INFO] Host: localhost:5432
[2025-01-15T10:30:05.456Z] [INFO] Backup file created: C:\backups\postgresql\assetlifecycle_2025-01-15_10-30-00.sql
[2025-01-15T10:30:05.789Z] [INFO] Compressing backup...
[2025-01-15T10:30:06.123Z] [INFO] Backup compressed: C:\backups\postgresql\assetlifecycle_2025-01-15_10-30-00.sql.gz
[2025-01-15T10:30:06.124Z] [INFO] Backup size: 0.82 MB
[2025-01-15T10:30:06.234Z] [INFO] Checksum created: a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6
[2025-01-15T10:30:06.235Z] [INFO] Local storage: Enabled (backup stored locally)
[2025-01-15T10:30:06.456Z] [INFO] Cleanup completed: 0 old backups deleted
[2025-01-15T10:30:06.457Z] [INFO] === Backup Completed Successfully in 6.46s ===
```

---

## ✅ Quick Test Checklist

- [ ] PostgreSQL client tools installed (`pg_dump` works)
- [ ] Backup directories created
- [ ] `.env` file configured
- [ ] `DATABASE_URL` is correct
- [ ] Backup script runs without errors
- [ ] Backup file created in backup directory
- [ ] Checksum file created
- [ ] Log file created
- [ ] Can restore from backup (optional)
- [ ] API endpoints work (if server running)

---

## 🎯 Next Steps After Testing

1. **Schedule Automatic Backups:**
   - On Linux: Use cron (see `BACKUP_SETUP_GUIDE.md`)
   - On Windows: Use Task Scheduler (see below)

2. **Configure Remote Storage:**
   - Set up MinIO/S3
   - Configure remote server

3. **Enable Notifications:**
   - Set up email notifications
   - Monitor backup logs

---

## 🔄 Windows Task Scheduler (Alternative to Cron)

To schedule automatic backups on Windows:

```powershell
# Create scheduled task (runs daily at 2 AM)
$action = New-ScheduledTaskAction -Execute "node" `
  -Argument "C:\path\to\AssetLifecycleBackend\scripts\backup-database.js" `
  -WorkingDirectory "C:\path\to\AssetLifecycleBackend"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask -TaskName "DatabaseBackup" `
  -Action $action `
  -Trigger $trigger `
  -Description "Daily PostgreSQL Database Backup"
```

---

**Ready to test!** Start with Test 1 and work through each test to verify everything works. 🚀

