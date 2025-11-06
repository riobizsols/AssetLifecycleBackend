# Storing Backups on Another Server - Setup Guide

## 🎯 Overview

The backup system supports storing backups on a remote server via **SCP (SSH)**. This provides off-site backup storage for disaster recovery.

---

## 📋 Prerequisites

1. **Remote Server** (Ubuntu/Linux recommended)
   - SSH server installed and running
   - Sufficient disk space for backups
   - User account with write permissions

2. **Network Access**
   - Your backup server can reach the remote server
   - SSH port (22) is open/accessible

3. **SSH Key Pair** (for passwordless authentication)

---

## 🚀 Step-by-Step Setup

### Step 1: Set Up Remote Backup Server

**On the remote backup server:**

```bash
# Create backup directory
sudo mkdir -p /backups/postgresql
sudo chown $USER:$USER /backups/postgresql
sudo chmod 755 /backups/postgresql

# Optional: Create a dedicated backup user
sudo useradd -m -s /bin/bash backupuser
sudo mkdir -p /home/backupuser/backups/postgresql
sudo chown backupuser:backupuser /home/backupuser/backups/postgresql
```

### Step 2: Generate SSH Key Pair (On Your Backup Server)

**On your local/backup server (where backups run):**

#### For Windows:

```powershell
# Generate SSH key (if not already exists)
ssh-keygen -t rsa -b 4096 -f "$env:USERPROFILE\.ssh\backup_key" -N '""'

# This creates:
# - C:\Users\YourUser\.ssh\backup_key (private key)
# - C:\Users\YourUser\.ssh\backup_key.pub (public key)
```

#### For Linux/Ubuntu:

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/backup_key -N ""

# This creates:
# - ~/.ssh/backup_key (private key)
# - ~/.ssh/backup_key.pub (public key)
```

### Step 3: Copy Public Key to Remote Server

**On your local/backup server:**

#### For Windows:

```powershell
# Copy public key to remote server
# Replace with your remote server details
$remoteUser = "backupuser"
$remoteHost = "backup-server.example.com"
$pubKey = Get-Content "$env:USERPROFILE\.ssh\backup_key.pub"

# Manual method: Copy the public key content and add to remote server
Write-Host "Public key content:"
Write-Host $pubKey
Write-Host "`nCopy this key and add it to remote server:"
Write-Host "ssh $remoteUser@$remoteHost 'mkdir -p ~/.ssh && echo $pubKey >> ~/.ssh/authorized_keys'"
```

#### For Linux/Ubuntu:

```bash
# Copy public key to remote server
ssh-copy-id -i ~/.ssh/backup_key.pub backupuser@backup-server.example.com

# OR manually:
cat ~/.ssh/backup_key.pub | ssh backupuser@backup-server.example.com \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

**On the remote server, verify the key was added:**

```bash
# Check authorized_keys file
cat ~/.ssh/authorized_keys
```

### Step 4: Test SSH Connection

**Test passwordless SSH access:**

#### For Windows:

```powershell
# Test SSH connection
ssh -i "$env:USERPROFILE\.ssh\backup_key" backupuser@backup-server.example.com

# If successful, you should be logged into the remote server
exit
```

#### For Linux/Ubuntu:

```bash
# Test SSH connection
ssh -i ~/.ssh/backup_key backupuser@backup-server.example.com

# If successful, you should be logged into the remote server
exit
```

### Step 5: Configure .env File

**Add to your `AssetLifecycleBackend/.env` file:**

```bash
# Remote Backup Configuration
BACKUP_REMOTE=true
BACKUP_REMOTE_HOST=backup-server.example.com
BACKUP_REMOTE_USER=backupuser
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=C:\Users\YourUser\.ssh\backup_key

# For Linux/Ubuntu use:
# BACKUP_REMOTE_SSH_KEY=/home/username/.ssh/backup_key

# Keep local backup too (optional)
BACKUP_LOCAL=true

# Or disable local backup (backups only on remote)
# BACKUP_LOCAL=false
```

**Important:** Replace:
- `backup-server.example.com` → Your remote server IP/domain
- `backupuser` → Your remote server username
- `/backups/postgresql` → Backup directory on remote server
- `C:\Users\YourUser\.ssh\backup_key` → Path to your private SSH key

### Step 6: Test Remote Backup

**Run a test backup:**

```powershell
# Windows
cd AssetLifecycleBackend
node scripts/backup-database.js

# Linux/Ubuntu
cd AssetLifecycleBackend
node scripts/backup-database.js
```

**Check logs for upload confirmation:**

```powershell
# Check log file
Get-Content logs\postgresql-backups\backup-$(Get-Date -Format "yyyy-MM-dd").log
```

You should see:
```
[INFO] Uploading to remote server: backup-server.example.com
[INFO] Successfully uploaded to remote server
```

### Step 7: Verify Backup on Remote Server

**SSH into remote server and verify:**

```bash
# Connect to remote server
ssh backupuser@backup-server.example.com

# List backups
ls -lh /backups/postgresql/

# Check backup files
ls -lh /backups/postgresql/*.sql*

# Verify checksum files exist
ls -lh /backups/postgresql/*.md5
```

---

## 🔧 Configuration Options

### Option 1: Local + Remote (Recommended)

**Keep backups in both places:**

```bash
BACKUP_LOCAL=true
BACKUP_REMOTE=true
```

**Pros:**
- Quick access to local backups
- Off-site backup for disaster recovery
- Redundancy

### Option 2: Remote Only

**Store backups only on remote server:**

```bash
BACKUP_LOCAL=false
BACKUP_REMOTE=true
```

**Pros:**
- Saves local disk space
- All backups off-site

**Cons:**
- Slower access (requires network)
- Network dependency

### Option 3: Multiple Remote Servers

**Store on multiple remote servers:**

You can run the backup script multiple times with different remote configurations, or modify the script to support multiple remote destinations.

---

## 🔐 Security Best Practices

### 1. SSH Key Security

```bash
# Set proper permissions on SSH key
chmod 600 ~/.ssh/backup_key
chmod 644 ~/.ssh/backup_key.pub
```

### 2. Remote Server Security

```bash
# On remote server, restrict SSH access
sudo nano /etc/ssh/sshd_config

# Add these settings:
PermitRootLogin no
PasswordAuthentication no  # Use keys only
PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### 3. Firewall Configuration

```bash
# On remote server, allow only specific IPs
sudo ufw allow from YOUR_BACKUP_SERVER_IP to any port 22
```

### 4. Backup Directory Permissions

```bash
# On remote server, restrict backup directory
chmod 700 /backups/postgresql
```

---

## 📊 Monitoring Remote Backups

### Check Backup Status

**Via API:**
```powershell
# Check backup status
curl http://localhost:5000/api/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Logs

```powershell
# View recent backup logs
Get-Content logs\postgresql-backups\backup-$(Get-Date -Format "yyyy-MM-dd").log | Select-String "remote"
```

### Verify Remote Backups

```bash
# SSH to remote server and check
ssh backupuser@backup-server.example.com "ls -lh /backups/postgresql/ | tail -5"
```

---

## 🐛 Troubleshooting

### Issue: SSH Connection Failed

**Error:**
```
Permission denied (publickey)
```

**Solution:**
1. Verify SSH key path is correct in `.env`
2. Check key permissions: `chmod 600 ~/.ssh/backup_key`
3. Verify public key is in remote server's `~/.ssh/authorized_keys`
4. Test SSH manually: `ssh -i ~/.ssh/backup_key user@host`

### Issue: Upload Failed

**Error:**
```
scp: /backups/postgresql: Permission denied
```

**Solution:**
1. Check remote directory exists: `ssh user@host "ls -ld /backups/postgresql"`
2. Verify user has write permissions
3. Check disk space on remote server: `df -h`

### Issue: Connection Timeout

**Error:**
```
Connection timed out
```

**Solution:**
1. Verify network connectivity: `ping backup-server.example.com`
2. Check firewall rules
3. Verify SSH port (22) is open
4. Check if remote server is accessible

---

## 🔄 Alternative: Using S3/MinIO on Remote Server

If you prefer object storage, you can use MinIO (S3-compatible) on your remote server:

### Setup MinIO on Remote Server

```bash
# Install MinIO on remote server
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Create MinIO data directory
sudo mkdir -p /data/minio
sudo chown $USER:$USER /data/minio

# Start MinIO
minio server /data/minio --console-address ":9001"
```

### Configure Backup to Use MinIO

**In `.env`:**
```bash
BACKUP_MINIO=true
MINIO_END_POINT=backup-server.example.com
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
BACKUP_S3_BUCKET=database-backups
```

---

## 📈 Backup Retention on Remote Server

### Automated Cleanup

You can set up a cron job on the remote server to clean old backups:

**On remote server:**
```bash
# Edit crontab
crontab -e

# Delete backups older than 30 days
0 3 * * * find /backups/postgresql -name "*.sql*" -mtime +30 -delete
```

---

## ✅ Summary

**To store backups on another server:**

1. ✅ Set up remote backup directory
2. ✅ Generate SSH key pair
3. ✅ Copy public key to remote server
4. ✅ Test SSH connection
5. ✅ Configure `.env` with remote settings
6. ✅ Test backup upload
7. ✅ Verify backups on remote server

**Your backups will now be:**
- Created locally (if `BACKUP_LOCAL=true`)
- Uploaded to remote server via SCP
- Stored securely with SSH key authentication
- Available for disaster recovery

---

## 🎯 Quick Reference

**Environment Variables:**
```bash
BACKUP_REMOTE=true
BACKUP_REMOTE_HOST=your-server.com
BACKUP_REMOTE_USER=backupuser
BACKUP_REMOTE_PATH=/backups/postgresql
BACKUP_REMOTE_SSH_KEY=/path/to/private/key
```

**Test Command:**
```bash
node scripts/backup-database.js
```

**Verify:**
```bash
ssh -i ~/.ssh/backup_key backupuser@your-server.com "ls -lh /backups/postgresql/"
```

