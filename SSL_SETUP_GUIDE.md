# SSL Certificate Setup Guide for Wildcard Domain (*.riowebworks.net)

## Overview

This guide explains how to obtain and configure a wildcard SSL certificate for `*.riowebworks.net` to secure all tenant subdomains.

## Option 1: Let's Encrypt (Free) - Recommended

Let's Encrypt provides free SSL certificates, including wildcard certificates.

### Prerequisites

1. **DNS Access**: You need access to your GoDaddy DNS to add TXT records for domain validation
2. **Server Access**: SSH access to your server at `103.27.234.248`
3. **Nginx Installed**: Nginx should be installed and running

### Step 1: Install Certbot

```bash
# Update package list
sudo apt-get update

# Install Certbot
sudo apt-get install certbot python3-certbot-nginx
```

### Step 2: Obtain Wildcard Certificate (Manual DNS Challenge)

For wildcard certificates, Let's Encrypt requires DNS-01 challenge (not HTTP-01).

```bash
# Request wildcard certificate
sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net
```

**Important Steps During Certificate Request:**

1. Certbot will prompt you to add a DNS TXT record
2. It will show something like:
   ```
   Please deploy a DNS TXT record under the name
   _acme-challenge.riowebworks.net with the following value:
   
   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Go to GoDaddy DNS Management:**
   - Log in to GoDaddy
   - Navigate to DNS Management for `riowebworks.net`
   - Add a new TXT record:
     - **Type**: TXT
     - **Name**: `_acme-challenge`
     - **Value**: (the value shown by Certbot)
     - **TTL**: 600 (or default)

4. **Wait for DNS propagation** (usually 1-5 minutes):
   ```bash
   # Verify DNS record is propagated
   dig TXT _acme-challenge.riowebworks.net
   # or
   nslookup -type=TXT _acme-challenge.riowebworks.net
   ```

5. **Press Enter** in Certbot terminal to continue

6. Certbot will verify and issue the certificate

### Step 3: Certificate Location

After successful issuance, certificates will be stored at:
```
/etc/letsencrypt/live/riowebworks.net/
├── fullchain.pem    # Certificate + intermediate certificates
├── privkey.pem      # Private key
├── cert.pem         # Certificate only
└── chain.pem        # Intermediate certificates
```

## Option 2: GoDaddy SSL Certificate (Paid)

If you prefer to use GoDaddy's SSL certificate service:

### Step 1: Purchase Wildcard SSL Certificate

1. Log in to GoDaddy
2. Go to SSL Certificates section
3. Purchase a wildcard SSL certificate for `*.riowebworks.net`
4. Complete the validation process

### Step 2: Download Certificate Files

After validation, download:
- Certificate file (`.crt` or `.pem`)
- Private key file (`.key`)
- Intermediate certificate (if provided)

### Step 3: Upload to Server

```bash
# Create directory for certificates
sudo mkdir -p /etc/ssl/riowebworks.net

# Upload certificate files (use SCP or SFTP)
# Place files in /etc/ssl/riowebworks.net/
```

## Nginx Configuration with SSL

### Complete Nginx Configuration

Update `/etc/nginx/sites-available/riowebworks.net`:

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name *.riowebworks.net riowebworks.net;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

# HTTPS - Main configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.riowebworks.net riowebworks.net;

    # SSL Certificate Configuration
    # For Let's Encrypt:
    ssl_certificate /etc/letsencrypt/live/riowebworks.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/riowebworks.net/privkey.pem;
    
    # For GoDaddy SSL (if using):
    # ssl_certificate /etc/ssl/riowebworks.net/certificate.crt;
    # ssl_certificate_key /etc/ssl/riowebworks.net/private.key;
    # ssl_trusted_certificate /etc/ssl/riowebworks.net/intermediate.crt;

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

    # Frontend - React App
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

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # CORS headers (if needed)
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

## Apply Configuration

1. **Test Nginx configuration:**
   ```bash
   sudo nginx -t
   ```

2. **If test passes, reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

3. **Check Nginx status:**
   ```bash
   sudo systemctl status nginx
   ```

## Auto-Renewal Setup (Let's Encrypt)

Let's Encrypt certificates expire after 90 days. Set up auto-renewal:

### Step 1: Test Renewal

```bash
sudo certbot renew --dry-run
```

### Step 2: Set Up Cron Job

```bash
# Edit crontab
sudo crontab -e

# Add this line to renew certificates twice daily and reload nginx
0 0,12 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

Or use systemd timer (recommended):

```bash
# Create timer file
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

Enable and start:
```bash
sudo systemctl enable certbot-renew.timer
sudo systemctl start certbot-renew.timer
sudo systemctl status certbot-renew.timer
```

## Update Backend Configuration

Update your backend to use HTTPS URLs:

### Environment Variables

Add to `.env` file:

```env
MAIN_DOMAIN=riowebworks.net
NODE_ENV=production
FORCE_HTTP=false  # Set to true only if you want HTTP instead of HTTPS
```

### Update tenantSetupService.js

The service already uses HTTPS for production. Verify it's using the correct protocol:

```javascript
// In tenantSetupService.js, the subdomain URL generation already handles this:
const protocol = process.env.FORCE_HTTP === 'true' ? 'http' : 'https';
finalSubdomainUrl = `${protocol}://${subdomain}.${MAIN_DOMAIN}`;
```

## Testing SSL

### 1. Test Certificate

```bash
# Check certificate details
openssl ssl_client -showcerts -connect riowebworks.net:443 < /dev/null

# Or use online tools:
# https://www.ssllabs.com/ssltest/analyze.html?d=riowebworks.net
```

### 2. Test Subdomain

```bash
# Test a subdomain
curl -I https://testorg.riowebworks.net

# Should return 200 OK with SSL
```

### 3. Browser Test

1. Access `https://orgname.riowebworks.net` in browser
2. Check for padlock icon (🔒) in address bar
3. Verify certificate is valid and trusted

## Troubleshooting

### Issue: Certificate Not Trusted

**Solution:**
- Ensure intermediate certificates are included (use `fullchain.pem`)
- For GoDaddy, include the intermediate certificate chain

### Issue: Mixed Content Warnings

**Solution:**
- Ensure all resources (images, scripts, APIs) use HTTPS
- Update frontend to use HTTPS URLs
- Check browser console for mixed content errors

### Issue: Certificate Renewal Fails

**Solution:**
- Verify DNS TXT record is accessible
- Check DNS propagation: `dig TXT _acme-challenge.riowebworks.net`
- Ensure Nginx is running and accessible
- Check Certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

### Issue: Nginx SSL Errors

**Check Nginx error logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**Common fixes:**
- Verify certificate paths are correct
- Check file permissions (certificates should be readable by nginx user)
- Ensure private key matches certificate

## Security Best Practices

1. **Use Strong SSL Configuration:**
   - TLS 1.2 and 1.3 only
   - Strong cipher suites
   - HSTS header enabled

2. **File Permissions:**
   ```bash
   # Secure certificate files
   sudo chmod 600 /etc/letsencrypt/live/riowebworks.net/privkey.pem
   sudo chmod 644 /etc/letsencrypt/live/riowebworks.net/fullchain.pem
   ```

3. **Firewall Configuration:**
   ```bash
   # Allow HTTPS
   sudo ufw allow 443/tcp
   sudo ufw allow 80/tcp  # For Let's Encrypt renewal
   ```

4. **Regular Monitoring:**
   - Set up alerts for certificate expiration
   - Monitor SSL Labs rating
   - Check certificate validity regularly

## Verification Checklist

- [ ] Wildcard SSL certificate obtained and installed
- [ ] Nginx configured with SSL
- [ ] HTTP to HTTPS redirect working
- [ ] All subdomains accessible via HTTPS
- [ ] Certificate auto-renewal configured
- [ ] Backend generates HTTPS URLs for subdomains
- [ ] Frontend works correctly with HTTPS
- [ ] No mixed content warnings
- [ ] SSL Labs rating is A or A+

## Support

For issues:
1. Check Nginx error logs: `/var/log/nginx/error.log`
2. Check Certbot logs: `/var/log/letsencrypt/letsencrypt.log`
3. Verify DNS records in GoDaddy
4. Test SSL configuration: `https://www.ssllabs.com/ssltest/`

