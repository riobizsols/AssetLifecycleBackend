# Deploy Multi-Tenant Version Alongside Existing ALM

**Deploy the new multi-tenant version on the same server as your existing ALM without affecting it**

---

## 🎯 Goal

You have:
- ✅ Existing ALM running (e.g., at `https://alm.yourdomain.com`)
- ✅ Existing database, Nginx config, PM2 processes

You want:
- ✅ Keep existing ALM running (don't touch it!)
- ✅ Deploy new multi-tenant version separately
- ✅ Both run on same server, different subdomains

---

## 📊 Architecture Overview

```
Same Server - Two Separate Deployments:

┌─────────────────────────────────────────────────────────────┐
│                    Your Server                               │
│                                                              │
│  OLD (Existing ALM):                                        │
│  ├── /var/www/alm/                                         │
│  ├── Port: 5000                                             │
│  ├── PM2: alm-api                                           │
│  ├── Domain: https://alm.yourdomain.com                     │
│  └── Database: alm_database                                 │
│                                                              │
│  NEW (Multi-Tenant ALM):                                    │
│  ├── /var/www/alm-multitenant/                             │
│  ├── Port: 5001 ← DIFFERENT PORT                           │
│  ├── PM2: alm-multitenant-api ← DIFFERENT NAME             │
│  ├── Domain: https://tenant.yourdomain.com                  │
│  │            https://*.tenant.yourdomain.com (subdomains)  │
│  └── Database: alm_multitenant ← DIFFERENT DATABASE        │
│                                                              │
│  Nginx:                                                      │
│  ├── Config 1: alm (existing)                              │
│  └── Config 2: alm-multitenant (new)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ What You DON'T Need to Do

- ❌ Don't touch existing ALM files
- ❌ Don't modify existing Nginx config
- ❌ Don't stop existing PM2 processes
- ❌ Don't modify existing database
- ❌ Don't reinstall Node.js, PostgreSQL, etc. (already installed)

---

## 🚀 PART 1: Create New Directory Structure

### **Step 1.1: SSH to Your Server**
```bash
ssh root@your-server-ip
# Or use the user you normally use
```

### **Step 1.2: Create New Directory**
```bash
# Create separate directory for multi-tenant version
sudo mkdir -p /var/www/alm-multitenant

# Set ownership
sudo chown -R $USER:$USER /var/www/alm-multitenant

# Verify
ls -la /var/www/
# Should show both:
# - alm/ (existing)
# - alm-multitenant/ (new)
```

---

## 💾 PART 2: Create New Database

### **Step 2.1: Create Database for Multi-Tenant**
```bash
# Connect to PostgreSQL (use your existing credentials)
sudo -u postgres psql

# In PostgreSQL prompt, run:
```

```sql
-- Create new database for multi-tenant system
CREATE DATABASE alm_multitenant;

-- Grant privileges to your existing user (or create new user)
-- Option A: Use existing user
GRANT ALL PRIVILEGES ON DATABASE alm_multitenant TO your_existing_db_user;

-- Option B: Create new dedicated user (recommended)
CREATE USER alm_multitenant_user WITH PASSWORD 'StrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE alm_multitenant TO alm_multitenant_user;
ALTER USER alm_multitenant_user CREATEDB;  -- Allow creating tenant databases

-- Exit
\q
```

### **Step 2.2: Test Database Connection**
```bash
# Test connection (use the user you chose above)
psql -U alm_multitenant_user -d alm_multitenant -h localhost

# If successful, exit
\q
```

✅ **New database created!**

---

## 📤 PART 3: Upload Multi-Tenant Code

### **Step 3.1: Clone Production Branch**
```bash
# Navigate to new directory
cd /var/www/alm-multitenant

# Clone backend (production branch with multi-tenant features)
git clone -b production https://github.com/riobizsols/AssetLifecycleBackend.git backend

# Clone frontend
git clone https://github.com/riobizsols/AssetLifecycleWebFrontend.git frontend

# Verify
ls -la
# Should see: backend/ and frontend/
```

### **Alternative: Manual Upload**
If you prefer to upload from your local machine:

**On your local machine:**
```bash
cd C:\Users\RIO\Desktop\work

# Make sure you're on production branch
cd AssetLifecycleBackend
git checkout production

# Zip the code
tar -czf alm-multitenant.tar.gz AssetLifecycleBackend AssetLifecycleWebFrontend

# Upload to server
scp alm-multitenant.tar.gz root@your-server-ip:/var/www/alm-multitenant/
```

**On server:**
```bash
cd /var/www/alm-multitenant
tar -xzf alm-multitenant.tar.gz
mv AssetLifecycleBackend backend
mv AssetLifecycleWebFrontend frontend
rm alm-multitenant.tar.gz
```

---

## ⚙️ PART 4: Configure Backend (Different Port)

### **Step 4.1: Install Backend Dependencies**
```bash
cd /var/www/alm-multitenant/backend

# Install packages
npm install

# Wait for completion...
```

### **Step 4.2: Create .env File**
```bash
# Create environment file
nano .env
```

**Add this configuration (note PORT=5001, different from existing):**
```env
# Node Environment
NODE_ENV=production

# IMPORTANT: Different port from existing ALM
PORT=5001

# Main Domain (use subdomain for multi-tenant)
# Example: tenant.yourdomain.com
MAIN_DOMAIN=tenant.yourdomain.com

# Database Connection (NEW database)
# Use the database created in Part 2
DATABASE_URL=postgresql://alm_multitenant_user:StrongPassword123!@localhost:5432/alm_multitenant

# JWT Secret (can be same or different)
JWT_SECRET=your-jwt-secret-min-32-characters-long

# Frontend Configuration
FRONTEND_URL=https://tenant.yourdomain.com
FRONTEND_PORT=443

# Force HTTPS in production
FORCE_HTTP=false

# Email Configuration (can use same as existing or different)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Session Secret
SESSION_SECRET=another-random-secret-string

# File Upload
MAX_FILE_SIZE=10485760
```

**Important changes:**
- `PORT=5001` (not 5000!)
- `MAIN_DOMAIN=tenant.yourdomain.com` (your subdomain for multi-tenant)
- `DATABASE_URL` points to new database

**Save and exit:** Ctrl+X, Y, Enter

### **Step 4.3: Test Backend**
```bash
# Test if it starts
node server.js

# Should see:
# Server running on port 5001
# Connected to database

# If working, press Ctrl+C
```

✅ **Backend configured!**

---

## 🎨 PART 5: Configure Frontend

### **Step 5.1: Install Frontend Dependencies**
```bash
cd /var/www/alm-multitenant/frontend

# Install packages
npm install
```

### **Step 5.2: Create Frontend Environment**
```bash
# Create production environment file
nano .env.production
```

**Add this:**
```env
VITE_API_BASE_URL=https://tenant.yourdomain.com/api
VITE_APP_NAME=Asset Lifecycle Management - Multi-Tenant
```

**Save and exit:** Ctrl+X, Y, Enter

### **Step 5.3: Build Frontend**
```bash
# Build for production
npm run build

# Wait 2-5 minutes...
# Creates dist/ folder

# Verify
ls -la dist/
# Should see index.html and assets/
```

✅ **Frontend built!**

---

## 🌐 PART 6: Configure Nginx (New Config)

### **Step 6.1: Create New Nginx Configuration**
```bash
# Create NEW config file (don't touch existing one!)
sudo nano /etc/nginx/sites-available/alm-multitenant
```

**Add this complete configuration (replace tenant.yourdomain.com with YOUR subdomain):**

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name tenant.yourdomain.com *.tenant.yourdomain.com;
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Multi-Tenant Application
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    # Wildcard server name for multi-tenant
    server_name tenant.yourdomain.com *.tenant.yourdomain.com;
    
    # SSL Configuration (will be added after getting certificate)
    # ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend (React App) - NEW LOCATION
    location / {
        root /var/www/alm-multitenant/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API - NEW PORT 5001
    location /api {
        proxy_pass http://localhost:5001;  # DIFFERENT PORT!
        proxy_http_version 1.1;
        
        # CRITICAL: Pass host for subdomain detection
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
    
    # File upload limit
    client_max_body_size 100M;
}
```

**Key differences from existing config:**
- Different `server_name`: `tenant.yourdomain.com`
- Different `root` path: `/var/www/alm-multitenant/frontend/dist`
- Different `proxy_pass` port: `5001`

**Save and exit:** Ctrl+X, Y, Enter

### **Step 6.2: Enable New Configuration**
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/alm-multitenant /etc/nginx/sites-enabled/

# List enabled sites
ls -la /etc/nginx/sites-enabled/
# Should see:
# - alm (existing)
# - alm-multitenant (new)

# Test Nginx configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx
```

✅ **Nginx configured!**

---

## 🔐 PART 7: Get SSL Certificate (For New Domain)

### **Step 7.1: Add DNS Record First**

Before getting SSL, add DNS records in GoDaddy:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | tenant | YOUR_SERVER_IP | 600 |
| A | *.tenant | YOUR_SERVER_IP | 600 |

Wait 10-30 minutes for DNS propagation.

### **Step 7.2: Test DNS**
```bash
# Test if DNS resolves
ping tenant.yourdomain.com

# Should show your server IP
```

### **Step 7.3: Get SSL Certificate**
```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Get wildcard certificate for multi-tenant subdomain
sudo certbot certonly --standalone \
  -d tenant.yourdomain.com \
  -d *.tenant.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Wait for certificate...
# Should see: "Successfully received certificate"
```

### **Step 7.4: Uncomment SSL Lines in Nginx**
```bash
# Edit config
sudo nano /etc/nginx/sites-available/alm-multitenant

# Find these lines (around line 22-23):
# ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;

# Remove the # to uncomment:
ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;

# Save and exit: Ctrl+X, Y, Enter
```

### **Step 7.5: Start Nginx**
```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx

# Check both configs are working
curl -I https://alm.yourdomain.com  # Existing ALM
curl -I https://tenant.yourdomain.com  # New multi-tenant
```

✅ **SSL configured!**

---

## 🚀 PART 8: Start New Backend with PM2

### **Step 8.1: Start Multi-Tenant Backend**
```bash
cd /var/www/alm-multitenant/backend

# Start with PM2 (DIFFERENT NAME from existing)
pm2 start server.js --name alm-multitenant-api

# Check status
pm2 status

# You should see BOTH processes:
# - alm-api (existing)
# - alm-multitenant-api (new)
```

### **Step 8.2: Save PM2 Configuration**
```bash
# Save both processes
pm2 save

# View logs
pm2 logs alm-multitenant-api

# Press Ctrl+C to exit logs
```

### **Step 8.3: Verify Both Running**
```bash
# Check all PM2 processes
pm2 status

# Should show:
# ┌─────┬───────────────────────┬─────────┬──────────┐
# │ id  │ name                  │ status  │ cpu      │
# ├─────┼───────────────────────┼─────────┼──────────┤
# │ 0   │ alm-api              │ online  │ 0%       │
# │ 1   │ alm-multitenant-api  │ online  │ 0%       │
# └─────┴───────────────────────┴─────────┴──────────┘

# Test existing API
curl http://localhost:5000/api/health

# Test new API
curl http://localhost:5001/api/health
```

✅ **Both backends running!**

---

## ✅ PART 9: Test Everything

### **Step 9.1: Test Existing ALM (Should Still Work)**
```bash
# Open in browser
https://alm.yourdomain.com

# Should work exactly as before
# Nothing changed!
```

### **Step 9.2: Test New Multi-Tenant ALM**
```bash
# Open in browser
https://tenant.yourdomain.com

# Should see login page
```

### **Step 9.3: Run Setup Wizard (Multi-Tenant)**
```bash
# Go to setup
https://tenant.yourdomain.com/setup

# Complete setup to create main organization
```

### **Step 9.4: Create Test Tenant**
```bash
# Create tenant via API
curl -X POST https://tenant.yourdomain.com/api/tenant-setup/create \
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

# Response includes:
# "subdomainUrl": "https://test-organization.tenant.yourdomain.com"
```

### **Step 9.5: Test Tenant Subdomain**
```bash
# Open tenant URL in browser
https://test-organization.tenant.yourdomain.com

# Login with tenant credentials
# Email: admin@test.com
# Password: Test123!@#
```

✅ **Everything working!**

---

## 📊 PART 10: Summary of Both Deployments

### **Existing ALM (Untouched):**
```
Directory: /var/www/alm/
Port: 5000
PM2 Process: alm-api
Domain: https://alm.yourdomain.com
Database: alm_database
Nginx Config: /etc/nginx/sites-available/alm
Status: ✅ Running as before
```

### **New Multi-Tenant ALM:**
```
Directory: /var/www/alm-multitenant/
Port: 5001
PM2 Process: alm-multitenant-api
Domain: https://tenant.yourdomain.com
          https://*.tenant.yourdomain.com (tenants)
Database: alm_multitenant (+ tenant databases)
Nginx Config: /etc/nginx/sites-available/alm-multitenant
Status: ✅ Running alongside existing
```

---

## 🔄 PART 11: Managing Both Versions

### **PM2 Commands**
```bash
# View all processes
pm2 status

# View existing ALM logs
pm2 logs alm-api

# View multi-tenant ALM logs
pm2 logs alm-multitenant-api

# Restart existing ALM (if needed)
pm2 restart alm-api

# Restart multi-tenant ALM (if needed)
pm2 restart alm-multitenant-api

# Stop only multi-tenant (keeps existing running)
pm2 stop alm-multitenant-api

# Start multi-tenant
pm2 start alm-multitenant-api
```

### **Nginx Commands**
```bash
# Test both configs
sudo nginx -t

# Reload (applies to both)
sudo systemctl reload nginx

# Check which configs are active
ls -la /etc/nginx/sites-enabled/
```

### **Database Management**
```bash
# Connect to existing database
psql -U your_existing_user -d alm_database -h localhost

# Connect to multi-tenant database
psql -U alm_multitenant_user -d alm_multitenant -h localhost

# List all databases
psql -U postgres -d postgres -c "\l"
```

---

## 🔄 PART 12: Updating Multi-Tenant Code

When you make changes to multi-tenant version:

```bash
# SSH to server
ssh root@your-server-ip

# Update multi-tenant backend
cd /var/www/alm-multitenant/backend
git pull origin production
npm install
pm2 restart alm-multitenant-api

# Update multi-tenant frontend
cd /var/www/alm-multitenant/frontend
git pull origin main
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx

# Existing ALM is NOT affected!
```

---

## 🐛 Troubleshooting

### **Problem: Port 5001 already in use**
```bash
# Check what's using port 5001
sudo lsof -i :5001

# If something else is using it, choose different port
# Edit backend .env:
PORT=5002  # or any available port

# Update Nginx config to match:
proxy_pass http://localhost:5002;
```

### **Problem: Both sites not working**
```bash
# Check Nginx config
sudo nginx -t

# View Nginx error log
sudo tail -f /var/log/nginx/error.log

# Check PM2 processes
pm2 status

# Check backend logs
pm2 logs alm-multitenant-api
```

### **Problem: Database connection error**
```bash
# Verify database exists
psql -U postgres -d postgres -c "\l" | grep alm

# Test connection
psql -U alm_multitenant_user -d alm_multitenant -h localhost

# Check .env DATABASE_URL matches
cat /var/www/alm-multitenant/backend/.env | grep DATABASE_URL
```

---

## 📝 Quick Reference

### **File Locations**
```
Existing ALM:
- Code: /var/www/alm/
- Nginx: /etc/nginx/sites-available/alm
- PM2: alm-api
- Port: 5000

Multi-Tenant ALM:
- Code: /var/www/alm-multitenant/
- Nginx: /etc/nginx/sites-available/alm-multitenant
- PM2: alm-multitenant-api
- Port: 5001
```

### **URLs**
```
Existing ALM:
- Main: https://alm.yourdomain.com

Multi-Tenant ALM:
- Main: https://tenant.yourdomain.com
- Setup: https://tenant.yourdomain.com/setup
- Tenants: https://*.tenant.yourdomain.com
```

### **Ports**
```
Existing: 5000 (unchanged)
Multi-Tenant: 5001 (new)
Nginx: 80, 443 (shared)
PostgreSQL: 5432 (shared)
```

---

## ✅ Deployment Checklist

- [ ] Create new directory: `/var/www/alm-multitenant/`
- [ ] Create new database: `alm_multitenant`
- [ ] Clone/upload code to new directory
- [ ] Configure backend `.env` with PORT=5001
- [ ] Install backend dependencies
- [ ] Configure frontend `.env.production`
- [ ] Install frontend dependencies and build
- [ ] Create new Nginx config: `alm-multitenant`
- [ ] Enable Nginx config (symlink)
- [ ] Add DNS records: `tenant` and `*.tenant`
- [ ] Get SSL certificate for `tenant.yourdomain.com`
- [ ] Start backend with PM2: `alm-multitenant-api`
- [ ] Test existing ALM still works
- [ ] Test new multi-tenant ALM works
- [ ] Run setup wizard
- [ ] Create test tenant
- [ ] Test tenant subdomain

---

## 🎉 Success!

You now have:
- ✅ **Existing ALM** running at `https://alm.yourdomain.com`
- ✅ **Multi-Tenant ALM** running at `https://tenant.yourdomain.com`
- ✅ Both on same server, completely independent
- ✅ Both managed separately with PM2
- ✅ Separate databases, configs, and ports
- ✅ Can update one without affecting the other

**Both systems run side-by-side perfectly!** 🚀

---

**Last Updated:** December 8, 2025  
**Tested On:** Ubuntu 20.04, 22.04  
**Branch:** production (multi-tenant features)

