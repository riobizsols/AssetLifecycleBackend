# Production Backup Setup - Store Backups on Remote Server

## 🎯 Overview

This guide shows how to configure your **production Ubuntu server** to automatically store database backups on a **separate remote server** instead of storing them in the codebase directory.

---

## 📋 Current Setup vs Production Setup

### **Current (Development/Windows):**
- Backups stored in: `./backups/postgresql/` (relative path in codebase)
- Logs stored in: `./logs/postgresql-backups/`

### **Production (Ubuntu Server):**
- Backups stored on: **Remote backup server** (separate server)
- Local staging: `/var/backups/postgresql/` (temporary, before upload)
- Logs: `/var/log/postgresql-backups/`

---

## 🚀 Step-by-Step Production Setup

### Step 1: Set Up Remote Backup Server

**On your remote backup server (separate Ubuntu server):**

```bash
# SSH into remote backup server
ssh user@backup-server-ip

# Create backup directory
sudo mkdir -p /backups/postgresql
sudo chown $USER:$USER /backups/postgresql
sudo chmod 755 /backups/postgresql

# Create a dedicated backup user (optional but recommended)
sudo useradd -m -s /bin/bash backupuser
sudo mkdir -p /home/backupuser/backups/postgresql
sudo chown backupuser:backupuser /home/backupuser/backups/postgresql
```

### Step 2: Generate SSH Key on Production Server

**On your production Ubuntu server (where your app is deployed):**

```bash
# SSH into production server
ssh user@your-production-server

# Navigate to your project
cd /var/www/assetlifecycle/backend

# Generate SSH key for backup user
ssh-keygen -t rsa -b 4096 -f ~/.ssh/backup_key -N ""

# This creates:
# - ~/.ssh/backup_key (private key)
# - ~/.ssh/backup_key.pub (public key)

# Set proper permissions
chmod 600 ~/.ssh/backup_key
chmod 644 ~/.ssh/backup_key.pub
```

### Step 3: Copy Public Key to Remote Backup Server

**On production server:**

```bash
# Display public key
cat ~/.ssh/backup_key.pub

# Copy the output (you'll need to add it to remote server)
```

**On remote backup server:**

```bash
# SSH into remote backup server
ssh user@backup-server-ip

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add public key to authorized_keys
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
```

**OR use ssh-copy-id (easier):**

```bash
# From production server, run:
ssh-copy-id -i ~/.ssh/backup_key.pub backupuser@backup-server-ip
```

### Step 4: Test SSH Connection

**On production server:**

```bash
# Test SSH connection
ssh -i ~/.ssh/backup_key backupuser@backup-server-ip

# If successful, you should be logged in
# Test write access
touch /backups/postgresql/test.txt
rm /backups/postgresql/test.txt
exit
```

### Step 5: Create Local Backup Directories on Production Server

**On production server:**

```bash
# Create local staging directory (temporary, before upload)
sudo mkdir -p /var/backups/postgresql
sudo chown $USER:$USER /var/backups/postgresql
sudo chmod 755 /var/backups/postgresql

# Create log directory
sudo mkdir -p /var/log/postgresql-backups
sudo chown $USER:$USER /var/log/postgresql-backups
sudo chmod 755 /var/log/postgresql-backups
```

### Step 6: Configure Production .env File

**On production server, edit your `.env` file:**

```bash
cd /var/www/assetlifecycle/backend
nano .env
```

**Add these backup configuration settings:**

```bash
# ============================================
# BACKUP CONFIGURATION - PRODUCTION
# ============================================

# Local staging directory (temporary, before upload)
BACKUP_DIR=/var/backups/postgresql
BACKUP_LOG_DIR=/var/log/postgresql-backups

# Backup settings
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_ENCRYPT=false

# Storage options
BACKUP_LOCAL=false                    # Don't keep local backups (only remote)
# OR
# BACKUP_LOCAL=true                   # Keep both local and remote

# Remote backup server configuration
BACKUP_REMOTE=true
BACKUP_REMOTE_HOST=backup-server-ip-or-domain
BACKUP_REMOTE_USER=backupuser
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/home/your-username/.ssh/backup_key

# Logging
BACKUP_VERBOSE=true
BACKUP_EMAIL_NOTIFY=true
BACKUP_EMAIL_TO=admin@yourdomain.com
```

**Important:** Replace:
- `backup-server-ip-or-domain` → Your remote backup server IP or domain
- `backupuser` → Username on remote backup server
- `/home/your-username/.ssh/backup_key` → Full path to your private SSH key

### Step 7: Set Up Cron Job on Production Server

**On production server:**

```bash
# Edit crontab
crontab -e

# Add this line (runs every day at 2:00 AM)
0 2 * * * /usr/bin/node /var/www/assetlifecycle/backend/scripts/backup-database.js >> /var/log/postgresql-backups/backup-cron.log 2>&1

# Save and exit (Ctrl+X, then Y, then Enter)
```

**OR use the setup script:**

```bash
cd /var/www/assetlifecycle/backend
chmod +x scripts/setup-backup-cron.sh
./scripts/setup-backup-cron.sh
```

### Step 8: Test Backup on Production Server

**On production server:**

```bash
# Navigate to project directory
cd /var/www/assetlifecycle/backend

# Test backup manually
node scripts/backup-database.js

# Check logs
tail -f /var/log/postgresql-backups/backup-$(date +%Y-%m-%d).log
```

**You should see:**
```
[INFO] Uploading to remote server: backup-server-ip
[INFO] Successfully uploaded to remote server
```

### Step 9: Verify Backup on Remote Server

**On remote backup server:**

```bash
# SSH into remote backup server
ssh backupuser@backup-server-ip

# List backups
ls -lh /backups/postgresql/

# Verify backup files
ls -lh /backups/postgresql/*.sql*
```

---

## 📁 Production File Structure

### **Production Server (Ubuntu):**
```
/var/www/assetlifecycle/backend/
├── scripts/
│   └── backup-database.js         # Backup script
├── .env                           # Production config
└── ...

/var/backups/postgresql/           # Temporary staging (before upload)
└── (backups are created here, then uploaded to remote)

/var/log/postgresql-backups/       # Backup logs
└── backup-YYYY-MM-DD.log
```

### **Remote Backup Server:**
```
/backups/postgresql/
├── assetLifecycle_2025-11-05_02-00-00.sql
├── assetLifecycle_2025-11-05_02-00-00.sql.md5
├── assetLifecycle_2025-11-04_02-00-00.sql
├── assetLifecycle_2025-11-04_02-00-00.sql.md5
└── ...
```

---

## 🔧 Environment-Specific Configuration

### **Development (.env on Windows):**
```bash
# Local development - store in project directory
BACKUP_DIR=./backups/postgresql
BACKUP_LOG_DIR=./logs/postgresql-backups
BACKUP_LOCAL=true
BACKUP_REMOTE=false
```

### **Production (.env on Ubuntu Server):**
```bash
# Production - store on remote server
BACKUP_DIR=/var/backups/postgresql
BACKUP_LOG_DIR=/var/log/postgresql-backups
BACKUP_LOCAL=false              # Don't keep local copies
BACKUP_REMOTE=true              # Upload to remote server
BACKUP_REMOTE_HOST=backup-server-ip
BACKUP_REMOTE_USER=backupuser
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/home/user/.ssh/backup_key
```

---

## 🔐 Security Best Practices

### 1. SSH Key Security

```bash
# On production server
chmod 600 ~/.ssh/backup_key
chmod 644 ~/.ssh/backup_key.pub
```

### 2. Remote Server Firewall

```bash
# On remote backup server, restrict SSH access
sudo ufw allow from PRODUCTION_SERVER_IP to any port 22
sudo ufw enable
```

### 3. Backup Directory Permissions

```bash
# On remote backup server
chmod 700 /backups/postgresql
chown backupuser:backupuser /backups/postgresql
```

### 4. Disable Password Authentication (Recommended)

```bash
# On remote backup server
sudo nano /etc/ssh/sshd_config

# Add/update:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

---

## 📊 Monitoring Production Backups

### Check Backup Status

**On production server:**

```bash
# View recent backup logs
tail -20 /var/log/postgresql-backups/backup-$(date +%Y-%m-%d).log

# Check cron job logs
tail -20 /var/log/postgresql-backups/backup-cron.log

# List local staging backups (if BACKUP_LOCAL=true)
ls -lh /var/backups/postgresql/
```

### Verify Remote Backups

**On remote backup server:**

```bash
# List all backups
ls -lh /backups/postgresql/

# Check disk space
df -h /backups

# Count backups
ls -1 /backups/postgresql/*.sql | wc -l
```

### Via API (if server is running)

```bash
# Check backup status
curl http://localhost:5000/api/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 Automated Cleanup on Remote Server

**Set up cleanup on remote backup server:**

```bash
# On remote backup server, edit crontab
crontab -e

# Delete backups older than 30 days (runs daily at 3 AM)
0 3 * * * find /backups/postgresql -name "*.sql*" -mtime +30 -delete

# Or keep last 30 backups
0 3 * * * ls -t /backups/postgresql/*.sql | tail -n +31 | xargs rm -f
```

---

## 🐛 Troubleshooting

### Issue: SSH Connection Failed

**Error:**
```
Permission denied (publickey)
```

**Solution:**
```bash
# On production server, verify key exists
ls -la ~/.ssh/backup_key

# Test connection with verbose output
ssh -v -i ~/.ssh/backup_key backupuser@backup-server-ip

# Check key permissions
chmod 600 ~/.ssh/backup_key
```

### Issue: Upload Failed

**Error:**
```
scp: /backups/postgresql: Permission denied
```

**Solution:**
```bash
# On remote server, verify directory permissions
ls -ld /backups/postgresql

# Fix permissions
chmod 755 /backups/postgresql
chown backupuser:backupuser /backups/postgresql
```

### Issue: Cron Job Not Running

**Check cron logs:**
```bash
# View cron logs
sudo tail -f /var/log/syslog | grep CRON

# Check if cron service is running
sudo systemctl status cron

# Test cron job manually
/usr/bin/node /var/www/assetlifecycle/backend/scripts/backup-database.js
```

---

## ✅ Production Checklist

- [ ] Remote backup server set up
- [ ] SSH key generated on production server
- [ ] Public key added to remote server
- [ ] SSH connection tested
- [ ] Local directories created on production server
- [ ] Production `.env` configured with remote settings
- [ ] Cron job set up on production server
- [ ] Test backup completed successfully
- [ ] Backup verified on remote server
- [ ] Automated cleanup configured on remote server
- [ ] Monitoring/logging set up

---

## 📝 Summary

**Production Setup:**
1. ✅ Backups created on production server at `/var/backups/postgresql/`
2. ✅ Backups automatically uploaded to remote server via SCP
3. ✅ Backups stored on remote server at `/backups/postgresql/`
4. ✅ Local backups cleaned up (if `BACKUP_LOCAL=false`)
5. ✅ Logs stored on production server at `/var/log/postgresql-backups/`
6. ✅ Runs automatically every day at 2:00 AM via cron

**Your backups are now:**
- ✅ Stored off-site on a separate server
- ✅ Protected from server failures
- ✅ Automated with no manual intervention
- ✅ Secure via SSH key authentication

