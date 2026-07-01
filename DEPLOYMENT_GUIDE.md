# Complete Deployment Guide: Multi-Tenant Subdomain Setup

## Overview

This guide walks you through:
1. **GoDaddy DNS Configuration** - Setting up wildcard DNS
2. **Ubuntu Server Setup** - Installing and configuring Nginx
3. **SSL Certificate Setup** - Securing all subdomains
4. **Dynamic Subdomain Routing** - Real-time subdomain handling
5. **Application Deployment** - Frontend and Backend setup

---

## Part 1: GoDaddy DNS Configuration

### Step 1: Access GoDaddy DNS Management

1. **Log in to GoDaddy:**
   - Go to https://www.godaddy.com
   - Log in to your account

2. **Navigate to DNS:**
   - Go to "My Products" → "Domains"
   - Click on `riowebworks.net`
   - Click on "DNS" or "Manage DNS"

### Step 2: Configure Wildcard DNS Record

You need to add a wildcard A record that points all subdomains to your server IP.

**Current Setup (if already done):**
- Type: `A`
- Name: `*` (asterisk)
- Value: `103.27.234.248`
- TTL: `600` (or default)

**If not set up yet:**

1. **Click "Add" or "+" to add a new record**

2. **Fill in the details:**
   - **Type:** Select `A`
   - **Name:** Enter `*` (just the asterisk character)
   - **Value:** Enter `103.27.234.248` (your server IP)
   - **TTL:** `600` seconds (10 minutes) or use default

3. **Save the record**

4. **Also ensure base domain points to server:**
   - **Type:** `A`
   - **Name:** `@` (or leave blank for root domain)
   - **Value:** `103.27.234.248`
   - **TTL:** `600`

### Step 3: Verify DNS Propagation

After adding DNS records, wait 5-10 minutes, then verify:

```bash
# Test wildcard DNS (from your local machine or server)
nslookup testorg.riowebworks.net
# Should return: 103.27.234.248

# Test base domain
nslookup riowebworks.net
# Should return: 103.27.234.248

# Test any subdomain
nslookup anything.riowebworks.net
# Should return: 103.27.234.248
```

**Online DNS Checker:**
- Use https://dnschecker.org/
- Enter `testorg.riowebworks.net`
- Should show `103.27.234.248` globally

---

## Part 2: Ubuntu Server Setup

### Step 1: Connect to Your Server

```bash
# SSH into your Ubuntu server
ssh root@103.27.234.248
# or
ssh your-username@103.27.234.248
```

### Step 2: Update System

```bash
# Update package list
sudo apt-get update
sudo apt-get upgrade -y
```

### Step 3: Install Required Software

```bash
# Install Nginx
sudo apt-get install nginx -y

# Install Node.js (if not already installed)
# For Node.js 18.x:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager for Node.js)
sudo npm install -g pm2

# Install Certbot (for SSL certificates)
sudo apt-get install certbot python3-certbot-nginx -y

# Install Git (if not installed)
sudo apt-get install git -y
```

### Step 4: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 3: Nginx Configuration for Dynamic Subdomains

### Step 1: Create Nginx Configuration File

```bash
# Create/edit Nginx configuration
sudo nano /etc/nginx/sites-available/riowebworks.net
```

### Step 2: Add Complete Configuration

Copy and paste this configuration:

```nginx
# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name *.riowebworks.net riowebworks.net;

    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server - Main Configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.riowebworks.net riowebworks.net;

    # SSL Certificate Configuration (will be updated after certificate setup)
    ssl_certificate /etc/letsencrypt/live/riowebworks.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/riowebworks.net/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend - React App (All subdomains)
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Backend API (All subdomains)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # CORS headers
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support (if needed)
    location /ws {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Important Notes:**
- This configuration uses `server_name *.riowebworks.net` which matches **any subdomain dynamically**
- All subdomains route to the same frontend (port 5173) and backend (port 5000)
- The backend middleware extracts the subdomain from the `Host` header
- SSL certificates will be added in the next step

### Step 3: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/riowebworks.net /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Part 4: SSL Certificate Setup (Let's Encrypt)

### Step 1: Obtain Wildcard SSL Certificate

**Important:** Wildcard certificates require DNS-01 challenge (manual DNS verification).

```bash
# Request wildcard certificate
sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net
```

### Step 2: Follow Certbot Prompts

1. **Enter your email** (for renewal notifications)

2. **Agree to terms of service** (type `A` and press Enter)

3. **Certbot will show DNS challenge:**
   ```
   Please deploy a DNS TXT record under the name
   _acme-challenge.riowebworks.net with the following value:
   
   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   Press Enter to Continue
   ```

4. **Go to GoDaddy DNS Management:**
   - Log in to GoDaddy
   - Go to DNS for `riowebworks.net`
   - Click "Add" to create new record
   - **Type:** `TXT`
   - **Name:** `_acme-challenge`
   - **Value:** (copy the value shown by Certbot)
   - **TTL:** `600`
   - **Save**

5. **Wait for DNS propagation** (1-5 minutes):
   ```bash
   # Check DNS propagation
   dig TXT _acme-challenge.riowebworks.net
   # or
   nslookup -type=TXT _acme-challenge.riowebworks.net
   ```
   
   **Wait until you see the TXT record value** before continuing.

6. **Press Enter** in Certbot terminal to continue

7. **Certbot will verify and issue certificate**

### Step 3: Verify Certificate Location

```bash
# Check certificate files
ls -la /etc/letsencrypt/live/riowebworks.net/

# Should show:
# - fullchain.pem
# - privkey.pem
# - cert.pem
# - chain.pem
```

### Step 4: Update Nginx to Use Certificate

The Nginx config already references the certificate paths. Just verify:

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: Set Up Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Set up systemd timer for auto-renewal
sudo nano /etc/systemd/system/certbot-renew.timer
```

Add:
```ini
[Unit]
Description=Certbot Renewal Timer

[Timer]
OnCalendar=0 0,12 * * *
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Create service file
sudo nano /etc/systemd/system/certbot-renew.service
```

Add:
```ini
[Unit]
Description=Certbot Renewal Service

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

```bash
# Enable and start timer
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
sudo systemctl status certbot-renew.timer
```

---

## Part 5: Deploy Your Applications

### Step 1: Clone/Upload Your Code

```bash
# Create application directory
sudo mkdir -p /var/www/assetlifecycle
cd /var/www/assetlifecycle

# If using Git:
# git clone your-repository-url .

# Or upload files via SCP/SFTP
```

### Step 2: Set Up Backend

```bash
# Navigate to backend directory
cd /var/www/assetlifecycle/AssetLifecycleBackend

# Install dependencies
npm install

# Create .env file
sudo nano .env
```

**Add to .env:**
```env
NODE_ENV=production
PORT=5000
MAIN_DOMAIN=riowebworks.net
FORCE_HTTP=false

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password

# JWT Secret
JWT_SECRET=your-secret-key-here

# CORS (already configured in code)
# CORS_ORIGINS will be dynamically handled
```

```bash
# Start backend with PM2
pm2 start server.js --name "assetlifecycle-backend"

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

### Step 3: Set Up Frontend

```bash
# Navigate to frontend directory
cd /var/www/assetlifecycle/AssetLifecycleWebFrontend

# Install dependencies
npm install

# Build for production
npm run build

# Install serve (or use PM2 with vite preview)
npm install -g serve

# Start frontend with PM2
pm2 start serve --name "assetlifecycle-frontend" -- -s -l 5173 dist

# Or use vite preview:
# pm2 start npm --name "assetlifecycle-frontend" -- run preview -- --port 5173 --host
```

**Alternative: Use Vite Preview with PM2:**

```bash
# Update package.json scripts (if needed)
# Add: "preview": "vite preview --port 5173 --host"

# Start with PM2
pm2 start npm --name "assetlifecycle-frontend" -- run preview
```

### Step 4: Verify Applications Are Running

```bash
# Check PM2 status
pm2 status

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(5000|5173)'

# Check application logs
pm2 logs assetlifecycle-backend
pm2 logs assetlifecycle-frontend
```

---

## Part 6: How Dynamic Subdomain Routing Works

### Architecture Overview

```
User Request: https://orgname.riowebworks.net/api/auth/login
    ↓
Nginx (Port 443)
    ↓
Routes to: http://localhost:5000/api/auth/login
    ↓
Backend receives request with Host header: "orgname.riowebworks.net"
    ↓
subdomainMiddleware.js extracts subdomain: "orgname"
    ↓
Looks up org_id from database using subdomain
    ↓
Attaches org_id to request (req.orgId)
    ↓
authController.js uses req.orgId to connect to correct tenant database
    ↓
Returns response
```

### Key Components

1. **Nginx Configuration:**
   - `server_name *.riowebworks.net` matches any subdomain
   - Proxies all requests to backend with `Host` header preserved

2. **Backend Middleware (`subdomainMiddleware.js`):**
   - Extracts subdomain from `req.headers.host`
   - Queries database: `SELECT org_id FROM tblOrgs WHERE subdomain = ?`
   - Attaches `req.orgId` and `req.subdomain` to request

3. **Database Connection:**
   - Uses `req.orgId` to get tenant database connection
   - Each tenant has isolated database

4. **Real-Time Operation:**
   - No Nginx restart needed when new subdomain is created
   - New subdomain works immediately after:
     - DNS propagation (5-10 minutes)
     - Organization record created in database
     - User navigates to subdomain URL

### Testing Dynamic Subdomain

1. **Create a new organization** through tenant-setup screen
2. **Wait for DNS propagation** (if first time)
3. **Access subdomain URL** - should work immediately!

---

## Part 7: Testing and Verification

### Test 1: DNS Resolution

```bash
# From your local machine
nslookup testorg.riowebworks.net
# Should return: 103.27.234.248
```

### Test 2: HTTP Redirect

```bash
# Test HTTP to HTTPS redirect
curl -I http://testorg.riowebworks.net
# Should return: 301 Moved Permanently
# Location: https://testorg.riowebworks.net
```

### Test 3: HTTPS Access

```bash
# Test HTTPS
curl -I https://testorg.riowebworks.net
# Should return: 200 OK
```

### Test 4: SSL Certificate

```bash
# Check certificate
openssl ssl_client -showcerts -connect testorg.riowebworks.net:443 < /dev/null

# Or use browser:
# Visit https://testorg.riowebworks.net
# Check for padlock icon 🔒
```

### Test 5: API Endpoint

```bash
# Test API
curl https://testorg.riowebworks.net/api/health
# Should return API response
```

### Test 6: Create New Tenant

1. **Access tenant setup:**
   - Go to `https://riowebworks.net/tenant-setup` (or your setup URL)

2. **Create new organization:**
   - Fill in organization details
   - Submit form

3. **Get subdomain URL** from response

4. **Access subdomain:**
   - Navigate to the provided subdomain URL
   - Should load your application
   - Login should work

---

## Part 8: Monitoring and Maintenance

### Check Application Status

```bash
# PM2 status
pm2 status

# PM2 logs
pm2 logs

# Nginx status
sudo systemctl status nginx

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Check SSL Certificate Expiry

```bash
# Check certificate expiry
sudo certbot certificates

# Manual renewal (if needed)
sudo certbot renew
```

### Restart Services

```bash
# Restart backend
pm2 restart assetlifecycle-backend

# Restart frontend
pm2 restart assetlifecycle-frontend

# Restart Nginx
sudo systemctl restart nginx
```

---

## Troubleshooting

### Issue: Subdomain not resolving

**Solution:**
1. Check DNS in GoDaddy
2. Wait for DNS propagation (up to 48 hours, usually 5-10 minutes)
3. Verify with: `nslookup subdomain.riowebworks.net`

### Issue: SSL certificate errors

**Solution:**
1. Check certificate exists: `ls /etc/letsencrypt/live/riowebworks.net/`
2. Verify Nginx config: `sudo nginx -t`
3. Check certificate expiry: `sudo certbot certificates`
4. Renew if needed: `sudo certbot renew`

### Issue: 502 Bad Gateway

**Solution:**
1. Check if backend is running: `pm2 status`
2. Check backend logs: `pm2 logs assetlifecycle-backend`
3. Verify port 5000 is listening: `sudo netstat -tlnp | grep 5000`
4. Check Nginx error log: `sudo tail -f /var/log/nginx/error.log`

### Issue: CORS errors

**Solution:**
1. Verify CORS configuration in `environment.js`
2. Check `MAIN_DOMAIN` environment variable
3. Ensure subdomain middleware is working
4. Check browser console for specific CORS error

### Issue: Subdomain not recognized by backend

**Solution:**
1. Check backend logs for subdomain extraction
2. Verify subdomain exists in database: `SELECT * FROM tblOrgs WHERE subdomain = 'testorg';`
3. Check middleware is running: Look for `[SubdomainMiddleware]` in logs

---

## Quick Reference Commands

```bash
# Nginx
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload Nginx
sudo systemctl restart nginx     # Restart Nginx
sudo tail -f /var/log/nginx/error.log  # View errors

# PM2
pm2 status                       # Check status
pm2 logs                         # View logs
pm2 restart all                  # Restart all
pm2 save                         # Save configuration

# SSL
sudo certbot certificates        # List certificates
sudo certbot renew               # Renew certificates
sudo certbot renew --dry-run     # Test renewal

# DNS
nslookup subdomain.riowebworks.net
dig subdomain.riowebworks.net
```

---

## Success Checklist

- [ ] GoDaddy DNS configured with wildcard A record
- [ ] Ubuntu server updated and software installed
- [ ] Nginx configured and running
- [ ] SSL certificate obtained and configured
- [ ] Backend deployed and running on port 5000
- [ ] Frontend deployed and running on port 5173
- [ ] PM2 configured for auto-start
- [ ] SSL auto-renewal configured
- [ ] Test subdomain accessible via HTTPS
- [ ] API endpoints working
- [ ] New tenant creation working
- [ ] Login working on subdomain

---

## Next Steps

After deployment:
1. Monitor application logs regularly
2. Set up backup strategy for databases
3. Configure monitoring/alerting (optional)
4. Set up CI/CD pipeline (optional)
5. Document your specific deployment details

---

## Support

If you encounter issues:
1. Check logs first (Nginx, PM2, application)
2. Verify DNS propagation
3. Test SSL certificate
4. Check firewall rules
5. Verify environment variables

