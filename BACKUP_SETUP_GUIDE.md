# PostgreSQL Automated Backup - Setup Guide

This guide will walk you through setting up automated PostgreSQL database backups that run every 24 hours.

## 📋 Prerequisites

- Ubuntu server with PostgreSQL installed
- Node.js installed (already done)
- PostgreSQL user with backup permissions
- Root or sudo access for cron setup

## 🚀 Quick Start

### Step 1: Install Required System Tools

```bash
# Install PostgreSQL client tools (if not already installed)
sudo apt update
sudo apt install postgresql-client

# Install compression tools
sudo apt install gzip bzip2

# Optional: Install GPG for encryption
sudo apt install gnupg2

# Optional: Install AWS CLI for S3 uploads
sudo apt install awscli

# Optional: Install MinIO client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Backup Configuration
BACKUP_DIR=/var/backups/postgresql
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_ENCRYPT=false

# Storage Options
BACKUP_LOCAL=true
BACKUP_REMOTE=false
BACKUP_S3=false
BACKUP_MINIO=false

# Remote Server (if BACKUP_REMOTE=true)
BACKUP_REMOTE_HOST=backup.example.com
BACKUP_REMOTE_USER=backup-user
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/home/user/.ssh/backup_key

# S3/MinIO (if BACKUP_S3=true or BACKUP_MINIO=true)
BACKUP_S3_BUCKET=database-backups
S3_REGION=us-east-1
# Use existing MINIO_* variables from your .env

# Encryption (if BACKUP_ENCRYPT=true)
BACKUP_GPG_RECIPIENT=your-email@example.com
# OR
BACKUP_GPG_KEY_FILE=/path/to/public-key.gpg

# Email Notifications (optional)
BACKUP_EMAIL_NOTIFY=true
BACKUP_EMAIL_TO=admin@example.com
BACKUP_EMAIL_FROM=noreply@example.com

# Logging
BACKUP_LOG_DIR=/var/log/postgresql-backups
BACKUP_VERBOSE=true
```

### Step 3: Create Backup Directories

```bash
# Create backup directory
sudo mkdir -p /var/backups/postgresql
sudo chown $USER:$USER /var/backups/postgresql
sudo chmod 755 /var/backups/postgresql

# Create log directory
sudo mkdir -p /var/log/postgresql-backups
sudo chown $USER:$USER /var/log/postgresql-backups
sudo chmod 755 /var/log/postgresql-backups

# Create logs directory in project (if it doesn't exist)
mkdir -p logs
```

### Step 4: Set Up PostgreSQL User Permissions

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# In PostgreSQL prompt:
-- Create backup user (if not exists)
CREATE USER backup_user WITH PASSWORD 'secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE your_database_name TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;

-- For pg_dump, the user needs SELECT permission on all tables
-- You can grant this to specific tables or use:
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backup_user;

-- Exit PostgreSQL
\q
```

### Step 5: Test Backup Script Manually

```bash
# Navigate to project directory
cd /path/to/AssetLifecycleBackend

# Test the backup script
node scripts/backup-database.js

# Check if backup was created
ls -lh /var/backups/postgresql/

# Verify backup integrity
pg_restore --list /var/backups/postgresql/your_backup_file.sql.gz
```

### Step 6: Set Up Automated Cron Job

**Option A: Using the Setup Script (Recommended)**

```bash
# Make setup script executable
chmod +x scripts/setup-backup-cron.sh

# Run setup script
./scripts/setup-backup-cron.sh
```

**Option B: Manual Cron Setup**

```bash
# Edit crontab
crontab -e

# Add this line (runs every day at 2:00 AM):
0 2 * * * /usr/bin/node /path/to/AssetLifecycleBackend/scripts/backup-database.js >> /path/to/AssetLifecycleBackend/logs/backup-cron.log 2>&1

# Save and exit
```

### Step 7: Integrate with Express.js (Optional)

Add backup routes to your `server.js`:

```javascript
// In server.js, add this line with other routes:
const backupRoutes = require('./routes/backupRoutes');
app.use('/api/backup', backupRoutes);
```

Now you can:
- Trigger backups via API: `POST /api/backup/trigger`
- Check status: `GET /api/backup/status`
- List backups: `GET /api/backup/list`
- Download backup: `GET /api/backup/download/:filename`

## 🔧 Advanced Configuration

### Enable Encryption

1. **Generate GPG Key Pair** (if you don't have one):

```bash
gpg --gen-key
# Follow prompts to create a key pair

# Export public key (for backup encryption)
gpg --export --armor your-email@example.com > backup-public-key.gpg

# Import recipient key (if encrypting for someone else)
gpg --import backup-public-key.gpg
```

2. **Update .env**:
```bash
BACKUP_ENCRYPT=true
BACKUP_GPG_RECIPIENT=your-email@example.com
```

### Set Up Remote Backup Server

1. **Generate SSH Key**:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/backup_key -N ""
```

2. **Copy Public Key to Remote Server**:
```bash
ssh-copy-id -i ~/.ssh/backup_key.pub backup-user@backup.example.com
```

3. **Test Connection**:
```bash
ssh -i ~/.ssh/backup_key backup-user@backup.example.com
```

4. **Update .env**:
```bash
BACKUP_REMOTE=true
BACKUP_REMOTE_HOST=backup.example.com
BACKUP_REMOTE_USER=backup-user
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/home/user/.ssh/backup_key
```

### Set Up MinIO/S3 Storage

1. **Configure MinIO Client** (if using MinIO):
```bash
mc alias set myminio http://your-minio-endpoint:9000 ACCESS_KEY SECRET_KEY
mc mb myminio/database-backups
```

2. **Configure AWS CLI** (if using S3):
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region
# Enter default output format (json)
```

3. **Update .env**:
```bash
BACKUP_MINIO=true  # or BACKUP_S3=true for AWS S3
BACKUP_S3_BUCKET=database-backups
```

## 📊 Monitoring & Maintenance

### Check Backup Status

```bash
# View recent backup logs
tail -f /var/log/postgresql-backups/backup-$(date +%Y-%m-%d).log

# List backups
ls -lh /var/backups/postgresql/

# Check cron logs
tail -f logs/backup-cron.log

# Via API
curl -X GET http://localhost:5000/api/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify Backup Integrity

```bash
# List backup contents (for custom format)
pg_restore --list /var/backups/postgresql/backup_file.dump

# Test restore (to a test database)
createdb test_restore_db
pg_restore -d test_restore_db /var/backups/postgresql/backup_file.dump
dropdb test_restore_db
```

### Manual Backup Rotation

```bash
# The script automatically handles rotation based on BACKUP_RETENTION_DAYS
# To manually clean up:
node -e "require('./scripts/backup-database.js').cleanupOldBackups()"
```

## 🔐 Security Best Practices

1. **File Permissions**:
```bash
# Restrict backup directory access
chmod 700 /var/backups/postgresql
chmod 600 /var/backups/postgresql/*.sql.gz
```

2. **Encryption**:
   - Always encrypt backups containing sensitive data
   - Store encryption keys securely
   - Use separate keys for different environments

3. **Network Security**:
   - Use SSH keys instead of passwords
   - Restrict SSH access to backup server
   - Use VPN or private networks when possible

4. **Access Control**:
   - Limit who can access backup files
   - Use separate backup user with minimal permissions
   - Rotate credentials regularly

5. **Backup Storage**:
   - Store backups off-site (remote server or cloud)
   - Implement 3-2-1 backup strategy:
     - 3 copies of data
     - 2 different media types
     - 1 off-site copy

## 🐛 Troubleshooting

### Backup Script Fails

1. **Check PostgreSQL Connection**:
```bash
psql $DATABASE_URL -c "SELECT version();"
```

2. **Check Disk Space**:
```bash
df -h /var/backups/postgresql
```

3. **Check Permissions**:
```bash
ls -la /var/backups/postgresql
```

4. **Check Logs**:
```bash
cat /var/log/postgresql-backups/backup-$(date +%Y-%m-%d).log
```

### Cron Job Not Running

1. **Check Cron Service**:
```bash
sudo systemctl status cron
```

2. **Check Crontab**:
```bash
crontab -l
```

3. **Check Cron Logs**:
```bash
sudo grep CRON /var/log/syslog
```

4. **Test Cron Command Manually**:
```bash
/usr/bin/node /path/to/backup-database.js
```

### Remote Upload Fails

1. **Test SSH Connection**:
```bash
ssh -i /path/to/key backup-user@backup.example.com
```

2. **Check Remote Directory**:
```bash
ssh backup-user@backup.example.com "ls -la /backups/postgresql"
```

3. **Check Disk Space on Remote**:
```bash
ssh backup-user@backup.example.com "df -h /backups"
```

## 📈 Performance Optimization

### For Large Databases

1. **Use Custom Format** (already default):
   - Faster than plain SQL
   - Built-in compression
   - Parallel restore support

2. **Adjust Backup Schedule**:
   - Run during low-traffic hours
   - Consider incremental backups for very large DBs

3. **Monitor Backup Duration**:
   - Log backup times
   - Alert if backups take too long
   - Consider pgBackRest for >100GB databases

## 📝 Backup Schedule Recommendations

- **Production**: Daily at 2:00 AM (low traffic)
- **Development**: Weekly or as needed
- **Staging**: Daily at 3:00 AM

## 🔄 Testing Restore Procedures

**Monthly Test**:
1. Create test database
2. Restore from recent backup
3. Verify data integrity
4. Document any issues

## 📞 Support

For issues or questions:
1. Check logs first
2. Review this guide
3. Test manually
4. Check PostgreSQL and system logs

---

**Setup Complete!** Your database backups are now automated and will run every 24 hours.
