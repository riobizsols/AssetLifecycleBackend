# Step-by-Step Server Deployment Guide

**Complete guide to deploy Frontend + Backend on the same Ubuntu server**

---

## 📋 Prerequisites

- Ubuntu 20.04 or 22.04 server (VPS/Cloud)
- Root or sudo access
- Your domain pointed to server IP (e.g., `yourdomain.com`)
- SSH access to your server

---

## 🎯 What We'll Deploy

```
Server Structure:
/var/www/assetlifecycle/
├── backend/                  (Node.js API - Port 5000)
└── frontend/                 (React App - Built files)

Nginx: Routes requests
- Frontend: https://yourdomain.com → /var/www/assetlifecycle/frontend/dist
- Backend: https://yourdomain.com/api → http://localhost:5000

PM2: Keeps backend running 24/7
PostgreSQL: Database server
```

---

## 📦 PART 1: Connect to Your Server

### **Step 1.1: Get Server IP**
- From your hosting provider (DigitalOcean, AWS, Linode, etc.)
- Example: `123.45.67.89`

### **Step 1.2: Connect via SSH**

**On Windows (use Git Bash or PowerShell):**
```bash
ssh root@123.45.67.89
# Replace 123.45.67.89 with YOUR server IP
# Enter password when prompted
```

**On Mac/Linux:**
```bash
ssh root@123.45.67.89
# Replace with YOUR server IP
```

✅ **You're now connected to your server!**

---

## 🔧 PART 2: Install Required Software

Run these commands **on your server** (after SSH connection):

### **Step 2.1: Update System**
```bash
# Update package list
sudo apt update

# Upgrade packages
sudo apt upgrade -y
```

### **Step 2.2: Install Node.js (v18)**
```bash
# Download Node.js setup script
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version
# Should show: v18.x.x

npm --version
# Should show: 9.x.x or higher
```

### **Step 2.3: Install PostgreSQL**
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
# Press 'q' to exit

# Verify installation
sudo -u postgres psql --version
# Should show: psql (PostgreSQL) 12.x or higher
```

### **Step 2.4: Install Nginx**
```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
# Press 'q' to exit
```

### **Step 2.5: Install PM2 (Process Manager)**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### **Step 2.6: Install Certbot (SSL Certificates)**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### **Step 2.7: Install Git**
```bash
# Install Git
sudo apt install -y git

# Verify
git --version
```

✅ **All software installed!**

---

## 💾 PART 3: Setup PostgreSQL Database

### **Step 3.1: Create PostgreSQL User**
```bash
# Switch to postgres user
sudo -u postgres psql

# You're now in PostgreSQL prompt (postgres=#)
# Run these SQL commands one by one:
```

**In PostgreSQL prompt:**
```sql
-- Create user (change password!)
CREATE USER assetlifecycle WITH PASSWORD 'YourStrongPassword123!';

-- Create main database
CREATE DATABASE assetlifecycle_main;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE assetlifecycle_main TO assetlifecycle;

-- Allow user to create databases (for tenants)
ALTER USER assetlifecycle CREATEDB;

-- Exit PostgreSQL
\q
```

### **Step 3.2: Configure PostgreSQL for Remote Connections**
```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/12/main/postgresql.conf
# Note: Version number (12) might be different, use TAB to auto-complete

# Find this line (press Ctrl+W to search):
#listen_addresses = 'localhost'

# Change it to:
listen_addresses = '*'

# Save and exit (Ctrl+X, then Y, then Enter)
```

```bash
# Edit client authentication
sudo nano /etc/postgresql/12/main/pg_hba.conf

# Add this line at the bottom:
host    all             all             0.0.0.0/0               md5

# Save and exit (Ctrl+X, then Y, then Enter)
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

### **Step 3.3: Test Database Connection**
```bash
# Test connection
psql -U assetlifecycle -d assetlifecycle_main -h localhost

# If connected successfully, you'll see:
# assetlifecycle_main=>

# Exit
\q
```

✅ **Database ready!**

---

## 📁 PART 4: Create Project Directory

### **Step 4.1: Create Directory Structure**
```bash
# Create main directory
sudo mkdir -p /var/www/assetlifecycle

# Set ownership to current user
sudo chown -R $USER:$USER /var/www/assetlifecycle

# Navigate to directory
cd /var/www/assetlifecycle

# Verify you're in correct location
pwd
# Should show: /var/www/assetlifecycle
```

✅ **Directory created!**

---

## 📤 PART 5: Upload Your Code

You have two options: **Git** (recommended) or **Manual Upload**

### **Option A: Using Git (Recommended)**

**On your server:**
```bash
# Navigate to project directory
cd /var/www/assetlifecycle

# Clone backend (replace with your GitHub URL)
git clone https://github.com/riobizsols/AssetLifecycleBackend.git backend

# Clone frontend (replace with your GitHub URL)
git clone https://github.com/riobizsols/AssetLifecycleWebFrontend.git frontend

# Verify
ls -la
# Should see: backend/ and frontend/ directories
```

### **Option B: Manual Upload (If no Git)**

**On your LOCAL computer (NOT server):**
```bash
# Navigate to your project
cd C:\Users\RIO\Desktop\work

# Create zip files
tar -czf backend.tar.gz AssetLifecycleBackend
tar -czf frontend.tar.gz AssetLifecycleWebFrontend

# Upload to server (replace with YOUR server IP)
scp backend.tar.gz root@123.45.67.89:/var/www/assetlifecycle/
scp frontend.tar.gz root@123.45.67.89:/var/www/assetlifecycle/
```

**Back on your server:**
```bash
cd /var/www/assetlifecycle

# Extract files
tar -xzf backend.tar.gz
tar -xzf frontend.tar.gz

# Rename directories
mv AssetLifecycleBackend backend
mv AssetLifecycleWebFrontend frontend

# Clean up
rm backend.tar.gz frontend.tar.gz
```

✅ **Code uploaded!**

---

## ⚙️ PART 6: Configure Backend

### **Step 6.1: Navigate to Backend**
```bash
cd /var/www/assetlifecycle/backend

# Verify you're in correct location
pwd
# Should show: /var/www/assetlifecycle/backend
```

### **Step 6.2: Install Dependencies**
```bash
# Install Node packages
npm install

# This will take a few minutes...
# Wait for it to complete
```

### **Step 6.3: Create Environment File**
```bash
# Create .env file
nano .env
```

**Copy and paste this (modify the values):**
```env
# Node Environment
NODE_ENV=production

# Server Configuration
PORT=5000

# Main Domain (replace with YOUR domain)
MAIN_DOMAIN=yourdomain.com

# Database Connection (change password to match Step 3.1)
DATABASE_URL=postgresql://assetlifecycle:YourStrongPassword123!@localhost:5432/assetlifecycle_main

# JWT Secret (generate a random string)
JWT_SECRET=change-this-to-a-long-random-secret-string-min-32-chars

# Frontend Configuration
FRONTEND_URL=https://yourdomain.com
FRONTEND_PORT=443

# Force HTTPS in production
FORCE_HTTP=false

# Email Configuration (optional - for email features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Session Secret
SESSION_SECRET=another-long-random-secret-string

# File Upload
MAX_FILE_SIZE=10485760
```

**Save the file:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

### **Step 6.4: Test Backend**
```bash
# Try starting backend
node server.js

# You should see:
# Server running on port 5000
# Connected to database

# If it works, press Ctrl+C to stop it
# We'll use PM2 to run it properly
```

✅ **Backend configured!**

---

## 🎨 PART 7: Configure Frontend

### **Step 7.1: Navigate to Frontend**
```bash
cd /var/www/assetlifecycle/frontend

# Verify location
pwd
# Should show: /var/www/assetlifecycle/frontend
```

### **Step 7.2: Update API URL**
```bash
# Edit the environment file
nano .env.production
```

**Add this content (replace with YOUR domain):**
```env
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_APP_NAME=Asset Lifecycle Management
```

**Save and exit** (Ctrl+X, Y, Enter)

### **Step 7.3: Install Dependencies**
```bash
# Install packages
npm install

# This will take several minutes...
# Wait for completion
```

### **Step 7.4: Build Frontend**
```bash
# Build production files
npm run build

# This creates a 'dist' folder with optimized files
# Wait for build to complete (2-5 minutes)

# Verify dist folder was created
ls -la dist/
# Should see: index.html and assets/ folder
```

✅ **Frontend built!**

---

## 🌐 PART 8: Configure Nginx

### **Step 8.1: Create Nginx Configuration**
```bash
# Create new config file
sudo nano /etc/nginx/sites-available/assetlifecycle
```

**Copy and paste this entire configuration (replace yourdomain.com with YOUR domain):**

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com *.yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Main Application
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    # Domain names (wildcard for subdomains)
    server_name yourdomain.com *.yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (will be updated by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend (React App)
    location / {
        root /var/www/assetlifecycle/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # Headers for subdomain detection
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_read_timeout 86400;
        proxy_connect_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    # File upload limit (100MB)
    client_max_body_size 100M;
}
```

**Save and exit** (Ctrl+X, Y, Enter)

### **Step 8.2: Enable Configuration**
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/assetlifecycle /etc/nginx/sites-enabled/

# Remove default config
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# You should see:
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# If you see errors, recheck the configuration file
```

### **Step 8.3: Comment Out SSL Lines (Temporarily)**

Since we don't have SSL certificates yet, we need to temporarily disable SSL:

```bash
# Edit the config again
sudo nano /etc/nginx/sites-available/assetlifecycle

# Find these lines (around line 22-24):
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Add # at the beginning to comment them out:
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Save and exit (Ctrl+X, Y, Enter)
```

```bash
# Test again
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

✅ **Nginx configured!**

---

## 🔐 PART 9: Setup SSL Certificate (HTTPS)

### **Step 9.1: Stop Nginx Temporarily**
```bash
sudo systemctl stop nginx
```

### **Step 9.2: Get SSL Certificate**
```bash
# Request certificate (replace YOUR EMAIL and YOUR DOMAIN)
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d *.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Wait for certificate to be issued...
# You should see: "Successfully received certificate"
```

### **Step 9.3: Uncomment SSL Lines**
```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/assetlifecycle

# Find these lines and REMOVE the # at the beginning:
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Should look like:
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Save and exit (Ctrl+X, Y, Enter)
```

### **Step 9.4: Start Nginx**
```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx

# Check status
sudo systemctl status nginx
# Press 'q' to exit
```

### **Step 9.5: Setup Auto-Renewal**
```bash
# Test renewal
sudo certbot renew --dry-run

# If successful, add cron job
sudo crontab -e
# Choose editor (usually 1 for nano)

# Add this line at the bottom:
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"

# Save and exit (Ctrl+X, Y, Enter)
```

✅ **SSL configured!**

---

## 🚀 PART 10: Start Backend with PM2

### **Step 10.1: Navigate to Backend**
```bash
cd /var/www/assetlifecycle/backend

# Verify location
pwd
```

### **Step 10.2: Start with PM2**
```bash
# Start backend
pm2 start server.js --name assetlifecycle-api

# You should see a table showing the app is running
```

### **Step 10.3: Save PM2 Configuration**
```bash
# Save current PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup

# Copy and run the command it shows
# It will look something like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u YOUR_USER --hp /home/YOUR_USER
# Copy and paste that command, then press Enter
```

### **Step 10.4: Check Backend Status**
```bash
# View status
pm2 status

# View logs
pm2 logs assetlifecycle-api

# Press Ctrl+C to exit logs
```

✅ **Backend running!**

---

## 🌍 PART 11: Configure Domain DNS

### **Step 11.1: Get Server IP**
```bash
# On your server, get the IP address
curl ifconfig.me

# Copy this IP address (e.g., 123.45.67.89)
```

### **Step 11.2: Configure GoDaddy DNS**

1. Log into **GoDaddy**
2. Go to **My Products**
3. Click **DNS** next to your domain
4. **Add/Edit these records:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 600 |
| A | * | YOUR_SERVER_IP | 600 |
| CNAME | www | @ | 600 |

**Example:**
- Type: `A`, Name: `@`, Value: `123.45.67.89`
- Type: `A`, Name: `*`, Value: `123.45.67.89`
- Type: `CNAME`, Name: `www`, Points to: `@`

5. **Save** all changes
6. **Wait 10-30 minutes** for DNS propagation

✅ **DNS configured!**

---

## ✅ PART 12: Test Your Deployment

### **Step 12.1: Test Website**
```bash
# On your server, test locally
curl http://localhost:5000/api/health

# Should return: {"status":"ok"} or similar
```

**In your browser:**
1. Go to `https://yourdomain.com`
2. Should see your login page
3. Check if it loads properly

### **Step 12.2: Test API**
```bash
# Test API from browser console
fetch('https://yourdomain.com/api/health')
  .then(r => r.json())
  .then(console.log)
```

### **Step 12.3: Run Setup Wizard**
1. Go to `https://yourdomain.com/setup`
2. Fill in organization details
3. Complete setup
4. Try logging in

### **Step 12.4: Create Test Tenant**

**Using curl:**
```bash
curl -X POST https://yourdomain.com/api/tenant-setup/create \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "TEST001",
    "orgName": "Test Organization",
    "orgCode": "TEST",
    "orgCity": "New York",
    "adminUser": {
      "fullName": "Test Admin",
      "email": "admin@test.com",
      "password": "Test123!@#",
      "phone": "+1234567890"
    }
  }'
```

**Response will include subdomain URL like:**
```json
{
  "subdomainUrl": "https://test-organization.yourdomain.com"
}
```

**Test the subdomain:**
1. Open `https://test-organization.yourdomain.com`
2. Should see login page
3. Login with tenant credentials

✅ **Everything working!**

---

## 📊 PART 13: Useful Commands

### **PM2 Commands (Managing Backend)**
```bash
# View status
pm2 status

# View logs
pm2 logs assetlifecycle-api

# Restart backend
pm2 restart assetlifecycle-api

# Stop backend
pm2 stop assetlifecycle-api

# Start backend
pm2 start assetlifecycle-api

# Monitor in real-time
pm2 monit
```

### **Nginx Commands**
```bash
# Test configuration
sudo nginx -t

# Reload (apply changes without downtime)
sudo systemctl reload nginx

# Restart
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### **PostgreSQL Commands**
```bash
# Connect to main database
psql -U assetlifecycle -d assetlifecycle_main -h localhost

# List databases
\l

# Connect to specific database
\c database_name

# List tables
\dt

# Exit
\q
```

### **Check Logs**
```bash
# Backend logs
pm2 logs assetlifecycle-api

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -xe
```

---

## 🔄 PART 14: How to Update Code

### **When You Make Changes:**

```bash
# SSH to server
ssh root@your-server-ip

# Update backend
cd /var/www/assetlifecycle/backend
git pull origin production  # or main
npm install
pm2 restart assetlifecycle-api

# Update frontend
cd /var/www/assetlifecycle/frontend
git pull origin main
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx

# Check everything is running
pm2 status
```

---

## 🐛 Troubleshooting

### **Problem: "Cannot connect to database"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U assetlifecycle -d assetlifecycle_main -h localhost

# Check credentials in .env match database user
cat /var/www/assetlifecycle/backend/.env | grep DATABASE_URL
```

### **Problem: "502 Bad Gateway"**
```bash
# Check if backend is running
pm2 status

# Check backend logs for errors
pm2 logs assetlifecycle-api

# Restart backend
pm2 restart assetlifecycle-api
```

### **Problem: "Frontend shows blank page"**
```bash
# Rebuild frontend
cd /var/www/assetlifecycle/frontend
npm run build

# Check Nginx is serving correct directory
sudo nginx -t

# Check browser console for errors (F12)
```

### **Problem: "Subdomain not working"**
```bash
# Check DNS has propagated
ping test-org.yourdomain.com

# Check wildcard A record in GoDaddy
# Should have: * → YOUR_SERVER_IP

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

---

## 📝 Quick Reference

### **File Locations**
```
Backend Code: /var/www/assetlifecycle/backend
Frontend Code: /var/www/assetlifecycle/frontend
Frontend Build: /var/www/assetlifecycle/frontend/dist
Nginx Config: /etc/nginx/sites-available/assetlifecycle
SSL Certificates: /etc/letsencrypt/live/yourdomain.com/
Backend Logs: pm2 logs
Nginx Logs: /var/log/nginx/
```

### **Important Ports**
```
Backend: 5000 (internal only)
Nginx: 80 (HTTP), 443 (HTTPS)
PostgreSQL: 5432
```

### **URLs**
```
Main App: https://yourdomain.com
Setup: https://yourdomain.com/setup
API Health: https://yourdomain.com/api/health
Tenant Example: https://tenant-name.yourdomain.com
```

---

## ✅ Deployment Complete!

You now have:
- ✅ Backend running on PM2 (auto-restarts on failure)
- ✅ Frontend built and served by Nginx
- ✅ SSL certificate (HTTPS)
- ✅ Wildcard subdomain support
- ✅ PostgreSQL database configured
- ✅ Multi-tenant system ready

**Your application is live and production-ready!** 🎉

---

**Last Updated:** December 8, 2025  
**Tested On:** Ubuntu 20.04, 22.04  
**Support:** For issues, check troubleshooting section above

