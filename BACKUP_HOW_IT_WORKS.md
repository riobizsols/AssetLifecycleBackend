# How the Backup System Works - Technical Explanation

## 🎯 Overview

The backup system is a **Node.js script** that uses PostgreSQL's native `pg_dump` tool to create automated database backups. It runs every 24 hours via a cron job and can also be triggered manually via API.

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKUP SYSTEM FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. TRIGGER
   ├── Cron Job (Automatic - every 24h at 2 AM)
   ├── API Endpoint (Manual - POST /api/backup/trigger)
   └── Command Line (Manual - node scripts/backup-database.js)

2. BACKUP CREATION
   ├── Parse DATABASE_URL from .env
   ├── Execute pg_dump command
   │   └── Creates: database_2025-01-15_02-00-00.sql
   └── Compress with gzip (optional)

3. POST-PROCESSING
   ├── Calculate MD5 checksum
   ├── Encrypt with GPG (optional)
   └── Generate checksum file (.md5)

4. STORAGE DESTINATIONS
   ├── Local: /var/backups/postgresql/
   ├── Remote Server: via SCP (SSH)
   ├── MinIO: S3-compatible storage
   └── AWS S3: Cloud storage

5. CLEANUP
   └── Delete backups older than retention period (default: 30 days)

6. NOTIFICATION
   └── Email on success/failure (optional)
```

---

## 🔧 Core Components

### 1. **Main Backup Script** (`scripts/backup-database.js`)

This is the heart of the backup system. It's a Node.js script that:

#### **Configuration Loading**
```javascript
// Reads from .env file
const config = {
  dbConfig: parseDatabaseUrl(process.env.DATABASE_URL),
  backupDir: '/var/backups/postgresql',
  retentionDays: 30,
  compression: true,
  encrypt: false,
  // ... more settings
};
```

#### **Database Connection Parsing**
```javascript
// Parses: postgresql://user:password@host:port/database
// Extracts: user, password, host, port, database
function parseDatabaseUrl(databaseUrl) {
  // Returns object with connection details
}
```

#### **Backup Creation Process**

**Step 1: Create Backup File**
```bash
# The script executes this command:
pg_dump -h localhost -p 5432 -U postgres_user -d database_name \
  -F c -f "/var/backups/postgresql/database_2025-01-15_02-00-00.sql"
```

**Parameters:**
- `-h`: Database host
- `-p`: Database port
- `-U`: Database user
- `-d`: Database name
- `-F c`: Custom format (compressed, faster restore)
- `-f`: Output file path

**Step 2: Compress (if enabled)**
```bash
gzip -f "database_2025-01-15_02-00-00.sql"
# Result: database_2025-01-15_02-00-00.sql.gz
```

**Step 3: Calculate Checksum**
```javascript
// MD5 hash of backup file
const checksum = calculateMD5(backupFile);
// Creates: database_2025-01-15_02-00-00.sql.gz.md5
```

**Step 4: Encrypt (if enabled)**
```bash
gpg --encrypt --recipient "admin@example.com" \
  --output "database_2025-01-15_02-00-00.sql.gz.gpg" \
  "database_2025-01-15_02-00-00.sql.gz"
```

#### **Storage Upload Process**

**Local Storage:**
- File is already saved locally during backup creation
- No additional action needed

**Remote Server (SCP):**
```bash
scp -i /path/to/ssh/key \
  "/var/backups/postgresql/backup.sql.gz" \
  user@backup-server.com:/backups/postgresql/
```

**MinIO/S3:**
```bash
# Using AWS CLI
aws s3 cp "backup.sql.gz" \
  "s3://database-backups/backup.sql.gz" \
  --endpoint-url http://minio-server:9000

# OR using MinIO client (mc)
mc cp "backup.sql.gz" \
  "minio-alias/database-backups/backup.sql.gz"
```

#### **Cleanup Process**
```javascript
// Deletes backups older than retentionDays
const maxAge = retentionDays * 24 * 60 * 60 * 1000; // milliseconds

for (const file of backupFiles) {
  if (fileAge > maxAge) {
    delete file;
  }
}
```

---

### 2. **Cron Job Setup** (`scripts/setup-backup-cron.sh`)

This script automatically sets up a cron job:

```bash
# Cron entry added to crontab:
0 2 * * * /usr/bin/node /path/to/backup-database.js >> logs/backup-cron.log 2>&1
```

**Schedule Format:** `0 2 * * *`
- `0`: Minute (0)
- `2`: Hour (2 AM)
- `*`: Every day
- `*`: Every month
- `*`: Every day of week

**Runs:** Every day at 2:00 AM

---

### 3. **API Integration** (`controllers/backupController.js`)

Provides REST API endpoints for backup management:

#### **POST /api/backup/trigger**
```javascript
// Triggers backup asynchronously
triggerBackup() {
  // Starts backup in background
  // Returns immediately with status 202 (Accepted)
  // Backup continues in background
}
```

#### **GET /api/backup/status**
```javascript
// Returns:
{
  success: true,
  config: { ... },
  backups: {
    total: 15,
    list: [...],  // Last 20 backups
    totalSizeMB: 245.67,
    latest: { filename, size, created, ... }
  },
  latestLog: "...",
  diskUsage: { ... }
}
```

#### **GET /api/backup/list**
```javascript
// Returns array of all backups with metadata
[
  {
    filename: "database_2025-01-15_02-00-00.sql.gz",
    size: 15728640,
    sizeMB: "15.00",
    created: "2025-01-15T02:00:00Z",
    age: 0  // days
  },
  ...
]
```

#### **GET /api/backup/download/:filename**
```javascript
// Streams backup file for download
// Headers set:
// - Content-Type: application/octet-stream
// - Content-Disposition: attachment; filename="..."
```

---

## 🔄 Complete Backup Flow Example

### **Scenario: Automatic Daily Backup (2 AM)**

```
1. CRON TRIGGERS (2:00 AM)
   └── Executes: node scripts/backup-database.js

2. SCRIPT STARTS
   ├── Loads .env configuration
   ├── Parses DATABASE_URL
   └── Creates timestamp: 2025-01-15_02-00-00

3. CONNECT TO DATABASE
   ├── Extracts: user=postgres, host=localhost, port=5432, db=assetlifecycle
   └── Sets PGPASSWORD environment variable

4. EXECUTE pg_dump
   ├── Command: pg_dump -h localhost -p 5432 -U postgres -d assetlifecycle -F c -f "backup.sql"
   ├── Duration: ~30 seconds (for 1GB database)
   └── Output: assetlifecycle_2025-01-15_02-00-00.sql (15 MB)

5. COMPRESS
   ├── Command: gzip -f "assetlifecycle_2025-01-15_02-00-00.sql"
   └── Output: assetlifecycle_2025-01-15_02-00-00.sql.gz (5 MB)

6. CALCULATE CHECKSUM
   ├── Reads entire file
   ├── Calculates MD5 hash
   └── Saves: assetlifecycle_2025-01-15_02-00-00.sql.gz.md5
   └── Content: "a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6  assetlifecycle_2025-01-15_02-00-00.sql.gz"

7. ENCRYPT (if enabled)
   ├── Command: gpg --encrypt ...
   └── Output: assetlifecycle_2025-01-15_02-00-00.sql.gz.gpg

8. UPLOAD TO STORAGE
   ├── Local: Already saved ✓
   ├── Remote: scp backup.sql.gz user@server:/backups/ ✓
   └── MinIO: mc cp backup.sql.gz minio/bucket/ ✓

9. CLEANUP OLD BACKUPS
   ├── Scans backup directory
   ├── Finds backups older than 30 days
   └── Deletes: assetlifecycle_2025-01-14_02-00-00.sql.gz (31 days old)

10. LOG RESULTS
    ├── Logs to: /var/log/postgresql-backups/backup-2025-01-15.log
    └── Content: "[2025-01-15T02:00:30] [INFO] Backup completed successfully"

11. SEND EMAIL (if enabled)
    └── Subject: "Database Backup SUCCESS"
    └── Body: "Backup completed: assetlifecycle_2025-01-15_02-00-00.sql.gz (5 MB)"
```

---

## 📁 File Structure After Backup

```
/var/backups/postgresql/
├── assetlifecycle_2025-01-15_02-00-00.sql.gz          # Latest backup
├── assetlifecycle_2025-01-15_02-00-00.sql.gz.md5      # Checksum
├── assetlifecycle_2025-01-14_02-00-00.sql.gz          # Yesterday
├── assetlifecycle_2025-01-14_02-00-00.sql.gz.md5
├── assetlifecycle_2025-01-13_02-00-00.sql.gz          # 2 days ago
└── ...

/var/log/postgresql-backups/
├── backup-2025-01-15.log                               # Today's log
├── backup-2025-01-14.log                               # Yesterday's log
└── ...
```

---

## 🔐 Security Features

### **1. Password Protection**
```javascript
// Password never exposed in command line
// Set via environment variable
process.env.PGPASSWORD = dbConfig.password;
```

### **2. File Permissions**
```bash
# Backup files should have restricted permissions
chmod 600 /var/backups/postgresql/*.sql.gz
```

### **3. Encryption (Optional)**
```bash
# GPG encryption for sensitive data
gpg --encrypt --recipient "admin@example.com" backup.sql.gz
```

### **4. Secure Transfer**
```bash
# SSH key-based authentication for remote uploads
scp -i /path/to/private/key backup.sql.gz user@server:/backups/
```

---

## ⚙️ Configuration Options

### **Environment Variables (.env)**

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Backup Settings
BACKUP_DIR=/var/backups/postgresql          # Where to store backups
BACKUP_RETENTION_DAYS=30                    # Keep backups for 30 days
BACKUP_COMPRESSION=true                     # Enable gzip compression
BACKUP_ENCRYPT=false                        # Enable GPG encryption

# Storage Options
BACKUP_LOCAL=true                           # Store locally
BACKUP_REMOTE=false                         # Upload to remote server
BACKUP_MINIO=false                          # Upload to MinIO
BACKUP_S3=false                             # Upload to AWS S3

# Remote Server (if BACKUP_REMOTE=true)
BACKUP_REMOTE_HOST=backup.example.com
BACKUP_REMOTE_USER=backup-user
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/home/user/.ssh/backup_key

# MinIO/S3 (if BACKUP_MINIO=true or BACKUP_S3=true)
BACKUP_S3_BUCKET=database-backups
MINIO_END_POINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Encryption (if BACKUP_ENCRYPT=true)
BACKUP_GPG_RECIPIENT=admin@example.com

# Notifications
BACKUP_EMAIL_NOTIFY=true
BACKUP_EMAIL_TO=admin@example.com
```

---

## 🚀 Usage Examples

### **1. Manual Backup via Command Line**
```bash
cd /path/to/AssetLifecycleBackend
node scripts/backup-database.js
```

### **2. Manual Backup via API**
```bash
curl -X POST http://localhost:5000/api/backup/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **3. Check Backup Status**
```bash
curl http://localhost:5000/api/backup/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **4. List All Backups**
```bash
curl http://localhost:5000/api/backup/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **5. Download Backup**
```bash
curl http://localhost:5000/api/backup/download/database_2025-01-15_02-00-00.sql.gz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o backup.sql.gz
```

---

## 🔍 Monitoring & Troubleshooting

### **Check Cron Job**
```bash
# View cron jobs
crontab -l

# Check cron logs
sudo grep CRON /var/log/syslog

# Check backup script logs
tail -f /var/log/postgresql-backups/backup-$(date +%Y-%m-%d).log
```

### **Verify Backup Integrity**
```bash
# Check MD5 checksum
md5sum -c assetlifecycle_2025-01-15_02-00-00.sql.gz.md5

# Test restore (to a test database)
createdb test_restore
pg_restore -d test_restore assetlifecycle_2025-01-15_02-00-00.sql.gz
```

### **Check Disk Space**
```bash
df -h /var/backups/postgresql
du -sh /var/backups/postgresql/*
```

---

## 📈 Performance Considerations

### **Backup Duration**
- **Small DB (<1GB)**: ~30 seconds
- **Medium DB (1-10GB)**: ~2-5 minutes
- **Large DB (>10GB)**: Depends on hardware

### **Storage Requirements**
- **Compression Ratio**: ~70% (10GB → 3GB)
- **30 Days Retention**: ~90GB for 10GB database
- **Formula**: `daily_size * retention_days`

### **Network Transfer**
- **Local**: Instant (no network)
- **Remote (SSH)**: Depends on network speed
- **MinIO/S3**: Depends on upload speed

---

## 🎯 Best Practices

1. **Test Restores Monthly**: Verify backups are working
2. **Monitor Disk Space**: Ensure enough space for retention period
3. **Encrypt Sensitive Data**: Use GPG encryption for production
4. **Off-Site Backups**: Store backups on remote server or cloud
5. **Monitor Logs**: Check backup logs regularly
6. **Set Alerts**: Configure email notifications for failures
7. **Backup During Low Traffic**: Schedule during off-peak hours (2 AM)

---

## 🔄 Restore Process

### **From Compressed Backup**
```bash
# 1. Extract
gunzip assetlifecycle_2025-01-15_02-00-00.sql.gz

# 2. Restore
pg_restore -d target_database assetlifecycle_2025-01-15_02-00-00.sql

# OR for plain SQL format
psql -d target_database < assetlifecycle_2025-01-15_02-00-00.sql
```

### **From Encrypted Backup**
```bash
# 1. Decrypt
gpg --decrypt assetlifecycle_2025-01-15_02-00-00.sql.gz.gpg > backup.sql.gz

# 2. Extract
gunzip backup.sql.gz

# 3. Restore
pg_restore -d target_database backup.sql
```

---

## 📞 Summary

The backup system is a **robust, automated solution** that:
- ✅ Runs automatically every 24 hours
- ✅ Uses PostgreSQL's native `pg_dump` tool
- ✅ Compresses and optionally encrypts backups
- ✅ Stores backups in multiple locations
- ✅ Automatically cleans up old backups
- ✅ Provides API access for manual operations
- ✅ Logs all operations for monitoring
- ✅ Sends notifications on success/failure

**It's production-ready and requires minimal maintenance!** 🚀

