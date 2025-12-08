# Deployment Summary: Quick Reference

## 🎯 What You Need to Do

### 1. GoDaddy DNS Configuration (5 minutes)

**Steps:**
1. Log in to GoDaddy → My Products → Domains → `riowebworks.net` → DNS
2. Add/Verify these DNS records:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | `*` (asterisk) | `103.27.234.248` | 600 |
   | A | `@` (or blank) | `103.27.234.248` | 600 |

3. Wait 5-10 minutes for DNS propagation
4. Verify: `nslookup test.riowebworks.net` should return `103.27.234.248`

**Result:** All subdomains (existing and future) will resolve to your server automatically!

---

### 2. Ubuntu Server Setup (15 minutes)

**Option A: Use Quick Deploy Script (Recommended)**

```bash
# On your Ubuntu server
cd /tmp
# Upload QUICK_DEPLOY.sh to server, then:
chmod +x QUICK_DEPLOY.sh
sudo ./QUICK_DEPLOY.sh
```

**Option B: Manual Setup**

Follow the detailed steps in `DEPLOYMENT_GUIDE.md` Part 2.

**What it does:**
- Installs Nginx, Node.js, PM2, Certbot
- Configures firewall
- Sets up Nginx with wildcard subdomain support
- Ready for SSL certificate

---

### 3. SSL Certificate Setup (10 minutes)

**Get Wildcard SSL Certificate:**

```bash
# On your Ubuntu server
sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net
```

**During the process:**
1. Enter your email
2. Agree to terms (type `A`)
3. **Certbot will show a DNS TXT record** - Go to GoDaddy:
   - Add TXT record: Name `_acme-challenge`, Value = (what Certbot shows)
4. Wait 1-5 minutes for DNS propagation
5. Press Enter in Certbot terminal
6. Certificate will be issued!

**Set up auto-renewal:**

```bash
# Create systemd timer (see DEPLOYMENT_GUIDE.md for full commands)
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
```

**Result:** All subdomains will have valid SSL certificates!

---

### 4. Deploy Applications (10 minutes)

**Backend:**

```bash
cd /var/www/assetlifecycle/AssetLifecycleBackend
npm install

# Create .env file
nano .env
# Add: NODE_ENV=production, PORT=5000, MAIN_DOMAIN=riowebworks.net, etc.

# Start with PM2
pm2 start server.js --name "assetlifecycle-backend"
pm2 save
pm2 startup  # Follow the command it outputs
```

**Frontend:**

```bash
cd /var/www/assetlifecycle/AssetLifecycleWebFrontend
npm install
npm run build

# Start with PM2
pm2 start serve --name "assetlifecycle-frontend" -- -s -l 5173 dist
pm2 save
```

**Result:** Applications running and accessible!

---

## ✅ Verification Checklist

After deployment, verify everything works:

- [ ] DNS resolves: `nslookup test.riowebworks.net` → `103.27.234.248`
- [ ] HTTP redirects to HTTPS: `curl -I http://test.riowebworks.net` → `301`
- [ ] HTTPS works: `curl -I https://test.riowebworks.net` → `200`
- [ ] SSL certificate valid: Browser shows 🔒 padlock
- [ ] Backend running: `pm2 status` shows `assetlifecycle-backend`
- [ ] Frontend running: `pm2 status` shows `assetlifecycle-frontend`
- [ ] API accessible: `curl https://test.riowebworks.net/api/health`
- [ ] Create test tenant: Use tenant-setup form
- [ ] Access subdomain: Navigate to generated subdomain URL
- [ ] Login works: Can log in on subdomain

---

## 🚀 How Dynamic Subdomains Work

**Key Point:** Once set up, new subdomains work automatically!

### The Magic:

1. **DNS Wildcard** (`* → IP`) - All subdomains resolve automatically
2. **Nginx Wildcard** (`server_name *.riowebworks.net`) - Matches all subdomains
3. **Database Lookup** - Backend queries database to find org_id from subdomain
4. **No Restart Needed** - Works in real-time!

### When You Create a New Tenant:

```
1. User fills tenant setup form
2. Backend creates org record with subdomain "neworg"
3. Backend returns URL: "https://neworg.riowebworks.net"
4. User navigates to URL
5. DNS resolves (wildcard already configured) ✅
6. Nginx matches (wildcard already configured) ✅
7. Backend extracts subdomain and queries database ✅
8. Application loads! ✅

Total time: ~1 second (no configuration needed!)
```

**See `HOW_DYNAMIC_SUBDOMAINS_WORK.md` for detailed explanation.**

---

## 📁 Documentation Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT_GUIDE.md` | Complete step-by-step deployment instructions |
| `SSL_SETUP_GUIDE.md` | Detailed SSL certificate setup |
| `HOW_DYNAMIC_SUBDOMAINS_WORK.md` | Explanation of dynamic subdomain routing |
| `NGINX_SUBDOMAIN_CONFIG.md` | Nginx configuration reference |
| `QUICK_DEPLOY.sh` | Automated setup script |
| `DEPLOYMENT_SUMMARY.md` | This file - quick reference |

---

## 🔧 Common Commands

```bash
# Nginx
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx      # Reload Nginx
sudo tail -f /var/log/nginx/error.log  # View errors

# PM2
pm2 status                        # Check status
pm2 logs                          # View logs
pm2 restart all                   # Restart all apps

# SSL
sudo certbot certificates         # List certificates
sudo certbot renew                # Renew certificates

# DNS
nslookup subdomain.riowebworks.net
dig subdomain.riowebworks.net
```

---

## 🐛 Troubleshooting

### Subdomain not resolving?
- Check DNS in GoDaddy
- Wait for DNS propagation (up to 48 hours, usually 5-10 min)
- Verify: `nslookup subdomain.riowebworks.net`

### SSL certificate errors?
- Check certificate exists: `ls /etc/letsencrypt/live/riowebworks.net/`
- Verify Nginx config: `sudo nginx -t`
- Check certificate expiry: `sudo certbot certificates`

### 502 Bad Gateway?
- Check if backend running: `pm2 status`
- Check backend logs: `pm2 logs assetlifecycle-backend`
- Verify port 5000: `sudo netstat -tlnp | grep 5000`

### Subdomain not recognized?
- Check backend logs for subdomain extraction
- Verify subdomain in database: `SELECT * FROM tblOrgs WHERE subdomain = 'testorg';`
- Check middleware logs: Look for `[SubdomainMiddleware]`

**See `DEPLOYMENT_GUIDE.md` Troubleshooting section for more details.**

---

## 🎉 Success!

Once deployed, your multi-tenant system will:

✅ **Automatically handle all subdomains** (no configuration per tenant)  
✅ **Secure all connections** with SSL/HTTPS  
✅ **Work in real-time** (new tenants work immediately)  
✅ **Scale easily** (add unlimited tenants)  

**No manual configuration needed for new tenants!** 🚀

---

## 📞 Next Steps

1. **Monitor logs** regularly: `pm2 logs`
2. **Set up backups** for databases
3. **Configure monitoring** (optional)
4. **Test tenant creation** end-to-end
5. **Document your specific setup** for your team

---

## Quick Start Command Reference

```bash
# 1. Run quick deploy script
sudo ./QUICK_DEPLOY.sh

# 2. Get SSL certificate
sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net

# 3. Deploy backend
cd AssetLifecycleBackend && npm install && pm2 start server.js

# 4. Deploy frontend
cd AssetLifecycleWebFrontend && npm install && npm run build && pm2 start serve -- -s -l 5173 dist

# 5. Verify
curl -I https://test.riowebworks.net
```

---

**For detailed instructions, see `DEPLOYMENT_GUIDE.md`**

