# EXACT Deployment Steps - Multi-Tenant ALM

**Follow these steps EXACTLY in order. Copy and paste each command.**

---

## ⚠️ BEFORE YOU START

**What you need:**
- [ ] SSH access to your server
- [ ] Your server IP address: `___________________`
- [ ] Your domain name: `___________________`
- [ ] Your server already has: Node.js, PostgreSQL, Nginx installed
- [ ] Your existing ALM is running at: `https://___________________`

**What we'll create:**
- New multi-tenant ALM at: `https://tenant.yourdomain.com`
- Tenant URLs like: `https://company1.tenant.yourdomain.com`

---

## 📝 STEP 1: Connect to Your Server

**On your computer, open terminal/command prompt:**

```bash
ssh root@YOUR_SERVER_IP
# Replace YOUR_SERVER_IP with your actual IP
# Example: ssh root@123.45.67.89
```

**Enter your password when prompted.**

✅ **YOU'RE NOW CONNECTED TO YOUR SERVER**

---

## 📁 STEP 2: Create New Directory

**Run these commands ONE BY ONE:**

```bash
# Create directory for multi-tenant version
sudo mkdir -p /var/www/alm-multitenant
```

```bash
# Set ownership (so you can edit files)
sudo chown -R $USER:$USER /var/www/alm-multitenant
```

```bash
# Go to the directory
cd /var/www/alm-multitenant
```

```bash
# Verify you're in the right place
pwd
```

**You should see:** `/var/www/alm-multitenant`

✅ **DIRECTORY CREATED**

---

## 💾 STEP 3: Create New Database

**Run this command:**

```bash
sudo -u postgres psql
```

**You're now in PostgreSQL prompt. It looks like:** `postgres=#`

**Copy and paste these SQL commands ONE BY ONE:**

```sql
CREATE DATABASE alm_multitenant;
```

**Wait for:** `CREATE DATABASE`

```sql
CREATE USER alm_mt_user WITH PASSWORD 'Alm2024Multi!';
```

**Wait for:** `CREATE ROLE`

```sql
GRANT ALL PRIVILEGES ON DATABASE alm_multitenant TO alm_mt_user;
```

**Wait for:** `GRANT`

```sql
ALTER USER alm_mt_user CREATEDB;
```

**Wait for:** `ALTER ROLE`

```sql
\q
```

**This exits PostgreSQL back to normal terminal.**

✅ **DATABASE CREATED**

**Test the database:**

```bash
psql -U alm_mt_user -d alm_multitenant -h localhost
```

**Enter password when asked:** `Alm2024Multi!`

**If you see:** `alm_multitenant=>` **it worked!**

**Type to exit:**

```bash
\q
```

---

## 📥 STEP 4: Download Code from GitHub

**Make sure you're in the right directory:**

```bash
cd /var/www/alm-multitenant
pwd
```

**Should show:** `/var/www/alm-multitenant`

**Download backend (production branch):**

```bash
git clone -b production https://github.com/riobizsols/AssetLifecycleBackend.git backend
```

**Wait for download... You'll see progress.**

**Download frontend:**

```bash
git clone https://github.com/riobizsols/AssetLifecycleWebFrontend.git frontend
```

**Wait for download... You'll see progress.**

**Verify both downloaded:**

```bash
ls -la
```

**You should see folders:** `backend` and `frontend`

✅ **CODE DOWNLOADED**

---

## ⚙️ STEP 5: Setup Backend

### **5.1: Go to backend folder**

```bash
cd /var/www/alm-multitenant/backend
pwd
```

**Should show:** `/var/www/alm-multitenant/backend`

### **5.2: Install packages**

```bash
npm install
```

**This takes 2-5 minutes. Wait until you see the command prompt again.**

### **5.3: Create environment file**

```bash
nano .env
```

**An editor will open. Copy and paste this ENTIRE block:**

**⚠️ IMPORTANT: Change these values:**
- Replace `yourdomain.com` with YOUR actual domain
- Keep the password as shown OR change it (remember it!)

```env
NODE_ENV=production
PORT=5001
MAIN_DOMAIN=tenant.yourdomain.com
DATABASE_URL=postgresql://alm_mt_user:Alm2024Multi!@localhost:5432/alm_multitenant
JWT_SECRET=multi-tenant-jwt-secret-key-change-this-to-random-32-chars
FRONTEND_URL=https://tenant.yourdomain.com
FRONTEND_PORT=443
FORCE_HTTP=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SESSION_SECRET=multi-tenant-session-secret-change-this
MAX_FILE_SIZE=10485760
```

**After pasting:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

**File saved!**

### **5.4: Test backend**

```bash
node server.js
```

**You should see:**
- `Server running on port 5001`
- `Connected to database`

**If you see errors, STOP and check the .env file.**

**If it works:**
- Press `Ctrl + C` to stop it

✅ **BACKEND CONFIGURED**

---

## 🎨 STEP 6: Setup Frontend

### **6.1: Go to frontend folder**

```bash
cd /var/www/alm-multitenant/frontend
pwd
```

**Should show:** `/var/www/alm-multitenant/frontend`

### **6.2: Install packages**

```bash
npm install
```

**This takes 3-5 minutes. Wait until done.**

### **6.3: Create environment file**

```bash
nano .env.production
```

**Copy and paste this (change yourdomain.com to YOUR domain):**

```env
VITE_API_BASE_URL=https://tenant.yourdomain.com/api
VITE_APP_NAME=Asset Lifecycle Management - Multi Tenant
```

**Save it:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### **6.4: Build frontend**

```bash
npm run build
```

**This takes 2-5 minutes. Wait for "build complete"**

**Verify build worked:**

```bash
ls -la dist/
```

**You should see:** `index.html` and `assets` folder

✅ **FRONTEND BUILT**

---

## 🌐 STEP 7: Configure Nginx

### **7.1: Create Nginx config file**

```bash
sudo nano /etc/nginx/sites-available/alm-multitenant
```

**Copy and paste this ENTIRE configuration:**

**⚠️ CHANGE `tenant.yourdomain.com` to `tenant.YOUR_ACTUAL_DOMAIN.com` throughout**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name tenant.yourdomain.com *.tenant.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name tenant.yourdomain.com *.tenant.yourdomain.com;
    
    # ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        root /var/www/alm-multitenant/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        proxy_read_timeout 86400;
        proxy_connect_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    client_max_body_size 100M;
}
```

**Save it:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### **7.2: Enable the configuration**

```bash
sudo ln -s /etc/nginx/sites-available/alm-multitenant /etc/nginx/sites-enabled/
```

### **7.3: Test Nginx**

```bash
sudo nginx -t
```

**You should see:** `test is successful`

**If you see errors, check the config file again.**

### **7.4: Reload Nginx**

```bash
sudo systemctl reload nginx
```

✅ **NGINX CONFIGURED**

---

## 🌍 STEP 8: Setup DNS in GoDaddy

**Open GoDaddy in your browser and do this:**

### **8.1: Log into GoDaddy**
1. Go to https://godaddy.com
2. Log in
3. Go to **My Products**
4. Find your domain
5. Click **DNS** or **Manage DNS**

### **8.2: Add DNS Records**

**Click "Add" button and add these TWO records:**

**Record 1:**
- Type: `A`
- Name: `tenant`
- Value: `YOUR_SERVER_IP` (example: 123.45.67.89)
- TTL: `600`
- Click **Save**

**Record 2:**
- Type: `A`
- Name: `*` (yes, just an asterisk)
- Host: `tenant`
- Value: `YOUR_SERVER_IP` (same as above)
- TTL: `600`
- Click **Save**

**Wait 10-30 minutes for DNS to propagate.**

### **8.3: Test DNS**

**Back on your server, run:**

```bash
ping tenant.yourdomain.com
```

**Press `Ctrl + C` to stop.**

**You should see your server IP in the response.**

**If not, wait more and try again.**

✅ **DNS CONFIGURED**

---

## 🔐 STEP 9: Get SSL Certificate

### **9.1: Stop Nginx temporarily**

```bash
sudo systemctl stop nginx
```

### **9.2: Get certificate**

**Run this command (replace with YOUR email and domain):**

```bash
sudo certbot certonly --standalone \
  -d tenant.yourdomain.com \
  -d *.tenant.yourdomain.com \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email
```

**Wait for it to complete...**

**You should see:** `Successfully received certificate`

**If you see errors about DNS, wait more and try again.**

### **9.3: Update Nginx config**

```bash
sudo nano /etc/nginx/sites-available/alm-multitenant
```

**Find these two lines (around line 16-17):**
```nginx
# ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;
```

**Remove the `#` at the beginning so they look like:**
```nginx
ssl_certificate /etc/letsencrypt/live/tenant.yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/tenant.yourdomain.com/privkey.pem;
```

**Save:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

### **9.4: Start Nginx**

```bash
sudo nginx -t
```

**Should say:** `test is successful`

```bash
sudo systemctl start nginx
```

✅ **SSL CONFIGURED**

---

## 🚀 STEP 10: Start Backend with PM2

### **10.1: Go to backend folder**

```bash
cd /var/www/alm-multitenant/backend
```

### **10.2: Start with PM2**

```bash
pm2 start server.js --name alm-multitenant-api
```

**You'll see a table showing the process running.**

### **10.3: Save PM2 config**

```bash
pm2 save
```

### **10.4: View status**

```bash
pm2 status
```

**You should see TWO processes:**
1. Your existing: `alm-api` (or whatever name)
2. New one: `alm-multitenant-api`

**Both should show:** `online` and green

✅ **BACKEND RUNNING**

---

## ✅ STEP 11: Test Everything

### **11.1: Test existing ALM (should still work)**

**In your browser, open:**
```
https://alm.yourdomain.com
```

**Should work exactly as before!**

### **11.2: Test new multi-tenant ALM**

**In your browser, open:**
```
https://tenant.yourdomain.com
```

**You should see a login page or setup page!**

### **11.3: Run setup wizard**

**Go to:**
```
https://tenant.yourdomain.com/setup
```

**Fill in the form:**
- Organization Name: `Main Organization`
- Admin Name: `Your Name`
- Admin Email: `your-email@domain.com`
- Any other required fields

**Click Complete Setup**

**You should see success message!**

### **11.4: Try logging in**

**Go to:**
```
https://tenant.yourdomain.com
```

**Login with:**
- Username: `rioadmin`
- Password: `Initial1`

**You should be able to log in!**

✅ **EVERYTHING WORKING**

---

## 🏢 STEP 12: Create Your First Tenant

### **12.1: Create tenant via API**

**In your browser, open Developer Console:**
- Press `F12`
- Click **Console** tab

**Copy and paste this:**

```javascript
fetch('https://tenant.yourdomain.com/api/tenant-setup/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    "orgId": "TEST001",
    "orgName": "Test Company",
    "orgCode": "TEST",
    "orgCity": "New York",
    "adminUser": {
      "fullName": "Test Admin",
      "email": "admin@test.com",
      "password": "Test123!",
      "phone": "+1234567890"
    }
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

**Press Enter**

**You should see response with:**
```javascript
{
  subdomain: "test-company",
  subdomainUrl: "https://test-company.tenant.yourdomain.com",
  adminCredentials: {
    email: "admin@test.com",
    password: "Test123!"
  }
}
```

### **12.2: Test tenant URL**

**Copy the `subdomainUrl` from response.**

**Open it in browser:**
```
https://test-company.tenant.yourdomain.com
```

**You should see login page!**

**Login with:**
- Email: `admin@test.com`
- Password: `Test123!`

**You should see the dashboard with TEST COMPANY data!**

✅ **TENANT CREATED AND WORKING**

---

## 📊 VERIFICATION CHECKLIST

Run these commands to verify everything:

```bash
# Check PM2 processes
pm2 status
```
**Should show both processes online**

```bash
# Check Nginx is running
sudo systemctl status nginx
```
**Should show active (running)**

```bash
# Check backend logs
pm2 logs alm-multitenant-api --lines 20
```
**Should show no errors**

```bash
# Check databases
psql -U postgres -d postgres -c "\l" | grep alm
```
**Should show both databases:**
- Your old: `alm_database` (or whatever name)
- New: `alm_multitenant`

---

## 🎉 SUCCESS!

**You now have:**

✅ **Old ALM:** `https://alm.yourdomain.com` (unchanged)

✅ **New Multi-Tenant ALM:** `https://tenant.yourdomain.com`

✅ **Tenant Example:** `https://test-company.tenant.yourdomain.com`

✅ **Both running on same server independently!**

---

## 🔄 HOW TO UPDATE CODE LATER

**When you make changes and want to update:**

```bash
# SSH to server
ssh root@your-server-ip

# Update backend
cd /var/www/alm-multitenant/backend
git pull origin production
npm install
pm2 restart alm-multitenant-api

# Update frontend
cd /var/www/alm-multitenant/frontend
git pull origin main
npm install
npm run build

# Done!
```

---

## 🐛 IF SOMETHING GOES WRONG

### **Backend not starting:**
```bash
cd /var/www/alm-multitenant/backend
cat .env
# Check DATABASE_URL is correct
```

### **Can't access website:**
```bash
sudo systemctl status nginx
pm2 status
# Check both are running
```

### **Database connection error:**
```bash
psql -U alm_mt_user -d alm_multitenant -h localhost
# Test if you can connect
# Password: Alm2024Multi!
```

### **Check logs:**
```bash
pm2 logs alm-multitenant-api
# See what errors show
```

---

## 📝 IMPORTANT NOTES

1. **Never edit existing ALM files** - They're in `/var/www/alm/`
2. **Multi-tenant files are in** - `/var/www/alm-multitenant/`
3. **Use port 5001** - Not 5000 (that's for old ALM)
4. **Different PM2 name** - `alm-multitenant-api` vs `alm-api`
5. **Different domain** - `tenant.yourdomain.com` vs `alm.yourdomain.com`

---

## ✅ FINAL CHECKLIST

- [ ] SSH connected
- [ ] Directory created: `/var/www/alm-multitenant/`
- [ ] Database created: `alm_multitenant`
- [ ] Code downloaded: `backend/` and `frontend/`
- [ ] Backend configured: `.env` file created
- [ ] Frontend built: `dist/` folder exists
- [ ] Nginx configured: `alm-multitenant` config
- [ ] DNS added: `tenant` and `*.tenant` records
- [ ] SSL certificate obtained
- [ ] Backend running: `pm2 status` shows it
- [ ] Old ALM still works
- [ ] New ALM accessible: `https://tenant.yourdomain.com`
- [ ] Setup completed
- [ ] Test tenant created
- [ ] Tenant URL works

---

**DEPLOYMENT COMPLETE!** 🎉🚀

**You now have a fully working multi-tenant system running alongside your existing ALM!**

---

**Created:** December 8, 2025  
**Time to Complete:** 1-2 hours  
**Tested On:** Ubuntu 20.04, 22.04

