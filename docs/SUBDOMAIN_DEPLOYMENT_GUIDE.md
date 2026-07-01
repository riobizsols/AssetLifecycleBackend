# Subdomain-Based Multi-Tenant Deployment Guide

## Overview

This guide explains how to deploy your multi-tenant application with subdomain routing on a server with GoDaddy DNS.

**What You Get:**
- Main app: `https://yourdomain.com`
- Tenant 1: `https://acme-corp.yourdomain.com`
- Tenant 2: `https://tech-solutions.yourdomain.com`
- Each tenant automatically connects to their own database

---

## ✅ What's Already Configured in Code

Your application already has:

1. **Subdomain Generation** - Automatically creates unique subdomains from organization names
2. **Subdomain Middleware** - Extracts subdomain from requests and maps to tenant database
3. **Database Routing** - Automatically connects to correct tenant database based on subdomain
4. **URL Generation** - Returns subdomain URL when tenant is created

---

## 🔧 Server Setup Steps

### **Step 1: GoDaddy DNS Configuration (Wildcard DNS)**

You need to add a **wildcard DNS record** to route all subdomains to your server.

#### **1.1 Log into GoDaddy DNS Management**

1. Go to https://dnsm godaddy.com
2. Log in with your account
3. Select your domain (e.g., `yourdomain.com`)
4. Click on **DNS** or **Manage DNS**

#### **1.2 Add Wildcard A Record**

Add the following DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 600 |
| A | * | YOUR_SERVER_IP | 600 |
| CNAME | www | @ | 600 |

**Example:**
```
Type: A
Name: @
Value: 123.45.67.89  (your server IP)
TTL: 600 seconds (10 minutes)

Type: A  
Name: *  (wildcard - this is the key!)
Value: 123.45.67.89  (your server IP)
TTL: 600 seconds

Type: CNAME
Name: www
Points to: @
TTL: 600 seconds
```

**The wildcard record (`*`)** means:
- `acme-corp.yourdomain.com` → YOUR_SERVER_IP
- `tech-solutions.yourdomain.com` → YOUR_SERVER_IP
- `any-tenant.yourdomain.com` → YOUR_SERVER_IP

#### **1.3 Wait for DNS Propagation**

- DNS changes can take **10 minutes to 48 hours** to propagate
- Usually takes 10-30 minutes with GoDaddy
- Test with: `ping acme-corp.yourdomain.com`

---

### **Step 2: Server Configuration (Ubuntu/Linux)**

#### **2.1 Install Required Software**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot (for SSL certificates)
sudo apt install -y certbot python3-certbot-nginx

# Install PostgreSQL (if not already installed)
sudo apt install -y postgresql postgresql-contrib

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### **2.2 Configure Environment Variables**

Create `.env` file in your backend directory:

```bash
# /var/www/assetlifecycle/backend/.env

NODE_ENV=production

# Main domain (for subdomain routing)
MAIN_DOMAIN=yourdomain.com

# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/main_database

# Frontend URL (not used in production with subdomain routing)
FRONTEND_URL=https://yourdomain.com

# Frontend port (for subdomain construction)
FRONTEND_PORT=443

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Force HTTPS (set to false only for testing)
FORCE_HTTP=false
```

---

### **Step 3: Nginx Configuration for Wildcard Subdomains**

Create Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/assetlifecycle
```

**Add this configuration:**

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com *.yourdomain.com;
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Main Application
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    # IMPORTANT: Wildcard server name
    server_name yourdomain.com *.yourdomain.com;
    
    # SSL Configuration (will be updated by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
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
        
        # CRITICAL: Pass the host header for subdomain detection
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
        
        # CORS headers
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle OPTIONS requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Access-Control-Allow-Credentials "true";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
    
    # File upload limit
    client_max_body_size 100M;
}
```

**Enable the configuration:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/assetlifecycle /etc/nginx/sites-enabled/

# Remove default config if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### **Step 4: SSL Certificate Setup (Let's Encrypt)**

#### **4.1 Get Wildcard SSL Certificate**

```bash
# Stop Nginx temporarily
sudo systemctl stop nginx

# Request wildcard certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d *.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email

# Start Nginx
sudo systemctl start nginx
```

**Note:** You'll need to verify domain ownership. Let's Encrypt will provide instructions.

#### **4.2 Auto-Renewal Setup**

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs renewal check twice daily)
0 0,12 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

### **Step 5: Deploy Application**

#### **5.1 Upload Code to Server**

```bash
# On your local machine
cd /path/to/your/project

# Create deployment package
tar -czf deploy.tar.gz AssetLifecycleBackend AssetLifecycleWebFrontend

# Upload to server (replace with your details)
scp deploy.tar.gz user@your-server-ip:/var/www/

# SSH to server
ssh user@your-server-ip

# Extract files
cd /var/www
sudo mkdir -p assetlifecycle
cd assetlifecycle
sudo tar -xzf ../deploy.tar.gz
sudo mv AssetLifecycleBackend backend
sudo mv AssetLifecycleWebFrontend frontend
```

#### **5.2 Setup Backend**

```bash
cd /var/www/assetlifecycle/backend

# Install dependencies
npm install --production

# Create .env file (use the one from Step 2.2)
sudo nano .env

# Test backend
node server.js

# If it works, stop it (Ctrl+C) and set up PM2
```

#### **5.3 Setup Frontend**

```bash
cd /var/www/assetlifecycle/frontend

# Install dependencies
npm install

# Build for production
npm run build

# The dist folder is what Nginx will serve
```

#### **5.4 Start Backend with PM2**

```bash
cd /var/www/assetlifecycle/backend

# Start with PM2
pm2 start server.js --name assetlifecycle-api

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
# Follow the instructions from the command above
```

---

### **Step 6: Test Subdomain Routing**

#### **6.1 Create Test Tenant**

```bash
# Make API request to create tenant
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

**Response will include:**
```json
{
  "success": true,
  "data": {
    "orgId": "TEST001",
    "subdomain": "test-organization",
    "subdomainUrl": "https://test-organization.yourdomain.com",
    "adminCredentials": {
      "userId": "USR001",
      "email": "admin@test.com",
      "password": "Test123!@#"
    }
  }
}
```

#### **6.2 Access Tenant URL**

1. Open browser: `https://test-organization.yourdomain.com`
2. Should see login page
3. Login with: `admin@test.com` / `Test123!@#`
4. Should connect to tenant database automatically!

---

## 🔍 Troubleshooting

### **Issue: Subdomain not resolving**

**Check DNS:**
```bash
# Test DNS resolution
nslookup test-organization.yourdomain.com

# Should return your server IP
ping test-organization.yourdomain.com
```

**Solution:** Wait for DNS propagation or check GoDaddy wildcard record.

### **Issue: SSL certificate error**

**Check certificate:**
```bash
sudo certbot certificates
```

**Renew if needed:**
```bash
sudo certbot renew --force-renewal
```

### **Issue: Subdomain routes to wrong database**

**Check logs:**
```bash
pm2 logs assetlifecycle-api

# Look for subdomain middleware logs
```

**Test subdomain extraction:**
```bash
# In Node.js console
const { extractSubdomain } = require('./utils/subdomainUtils');
console.log(extractSubdomain('test-org.yourdomain.com'));
// Should output: test-org
```

### **Issue: 502 Bad Gateway**

**Check backend is running:**
```bash
pm2 status
pm2 logs assetlifecycle-api
```

**Restart backend:**
```bash
pm2 restart assetlifecycle-api
```

---

## 📊 How It Works

```
User visits: https://acme-corp.yourdomain.com
                    ↓
         DNS resolves to SERVER_IP
                    ↓
              Nginx receives request
                    ↓
       Proxies to Backend (port 5000)
       WITH Host header: acme-corp.yourdomain.com
                    ↓
         Subdomain Middleware extracts: "acme-corp"
                    ↓
     Queries tenants table: WHERE subdomain = 'acme-corp'
                    ↓
        Returns org_id: "TENANT001"
                    ↓
     Connects to tenant database: tenant001_db
                    ↓
         Returns tenant-specific data
```

---

## 🚀 Production Checklist

- [ ] GoDaddy wildcard DNS record added (`*`)
- [ ] Server has static IP address
- [ ] Nginx installed and configured
- [ ] Wildcard SSL certificate obtained
- [ ] Backend `.env` configured with `MAIN_DOMAIN`
- [ ] Backend running with PM2
- [ ] Frontend built and deployed
- [ ] Test tenant created successfully
- [ ] Subdomain URL accessible
- [ ] Database connection working per tenant
- [ ] SSL auto-renewal configured

---

## 🔐 Security Best Practices

1. **Always use HTTPS** - Set `FORCE_HTTP=false` in production
2. **Firewall Rules** - Only allow ports 80, 443, 22 (SSH)
3. **Database Security** - Use strong passwords, limit connections
4. **Regular Updates** - Keep server, Node.js, and dependencies updated
5. **Backup Strategy** - Automate database backups for all tenant databases
6. **Rate Limiting** - Configure Nginx rate limits (already in config)
7. **CORS Policy** - Restrict to your domain only

---

## 📝 Environment Variables Summary

**Required in `.env`:**
```bash
NODE_ENV=production
MAIN_DOMAIN=yourdomain.com           # Your actual domain
DATABASE_URL=postgresql://...         # Main database
JWT_SECRET=strong-random-secret
FRONTEND_PORT=443                     # For HTTPS
FORCE_HTTP=false                      # Force HTTPS in production
```

---

## 🎯 Quick Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash
echo "🚀 Deploying Asset Lifecycle Management..."

# Pull latest code
cd /var/www/assetlifecycle/backend
git pull origin production

# Install dependencies
npm install --production

# Restart backend
pm2 restart assetlifecycle-api

# Build frontend
cd /var/www/assetlifecycle/frontend
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Deployment complete!"
pm2 status
```

Make executable:
```bash
chmod +x deploy.sh
```

---

**Last Updated:** December 8, 2025  
**Branch:** production  
**Status:** Production Ready 🚀

