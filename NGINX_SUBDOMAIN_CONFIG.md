# Nginx Configuration for Subdomain-Based Multi-Tenancy

## Overview

This guide explains how to configure Nginx to handle subdomain routing for `riowebworks.net` with wildcard DNS pointing to `103.27.234.248`.

## DNS Configuration (Already Done)

Your GoDaddy DNS is configured with:
- `*` (wildcard) → `103.27.234.248`

This means any subdomain like `orgname.riowebworks.net` will resolve to your server IP.

## Nginx Configuration

### Option 1: Single Server Block for All Subdomains (Recommended)

Create or update `/etc/nginx/sites-available/riowebworks.net`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name *.riowebworks.net riowebworks.net;

    # Redirect HTTP to HTTPS (if you have SSL)
    # return 301 https://$host$request_uri;

    # Or serve HTTP directly (for development/testing)
    location / {
        proxy_pass http://localhost:5173;  # Frontend port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API requests go to backend
    location /api {
        proxy_pass http://localhost:5000;  # Backend port
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}

# HTTPS configuration (if you have SSL certificate)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.riowebworks.net riowebworks.net;

    # SSL certificate configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:5173;  # Frontend port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:5000;  # Backend port
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

### Option 2: Separate Server Block for Main Domain

If you want to handle the main domain (`riowebworks.net`) separately:

```nginx
# Main domain
server {
    listen 80;
    server_name riowebworks.net;
    
    # Redirect to www or serve main site
    return 301 https://www.riowebworks.net$request_uri;
}

# All subdomains
server {
    listen 80;
    server_name *.riowebworks.net;
    
    location / {
        proxy_pass http://localhost:5173;
        # ... same proxy settings as above
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        # ... same proxy settings as above
    }
}
```

## Setup Steps

1. **Create Nginx configuration file:**
   ```bash
   sudo nano /etc/nginx/sites-available/riowebworks.net
   ```

2. **Copy the configuration above** (adjust ports if needed)

3. **Enable the site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/riowebworks.net /etc/nginx/sites-enabled/
   ```

4. **Test Nginx configuration:**
   ```bash
   sudo nginx -t
   ```

5. **Reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

## SSL Certificate Setup (REQUIRED for Production Security)

**⚠️ IMPORTANT:** SSL/HTTPS is required for secure tenant access. All tenant subdomains should use HTTPS.

See **SSL_SETUP_GUIDE.md** for detailed instructions on:
- Obtaining wildcard SSL certificate for `*.riowebworks.net`
- Configuring Nginx with SSL
- Setting up auto-renewal
- Security best practices

### Quick Start (Let's Encrypt)

1. **Install Certbot:**
   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **Get wildcard SSL certificate:**
   ```bash
   sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net
   ```

3. **Add DNS TXT record** in GoDaddy when prompted

4. **Update Nginx config** (see SSL_SETUP_GUIDE.md for complete configuration)

## Testing

1. **Test subdomain access:**
   - Create a test organization with subdomain `testorg`
   - Access: `http://testorg.riowebworks.net`
   - Should load your frontend application

2. **Test API:**
   - Access: `http://testorg.riowebworks.net/api/auth/login`
   - Should reach your backend API

3. **Check subdomain extraction:**
   - Backend logs should show: `[SubdomainMiddleware] Subdomain: testorg, Org ID: ...`

## Troubleshooting

### Issue: Subdomain not resolving

**Check DNS:**
```bash
nslookup testorg.riowebworks.net
# Should return: 103.27.234.248
```

### Issue: Nginx not routing correctly

**Check Nginx error logs:**
```bash
sudo tail -f /var/log/nginx/error.log
```

**Verify server_name matches:**
```bash
sudo nginx -T | grep server_name
```

### Issue: CORS errors

**Verify CORS configuration** in `environment.js` allows `*.riowebworks.net`

**Check browser console** for CORS error details

## Environment Variables

Add to your `.env` file:

```env
MAIN_DOMAIN=riowebworks.net
NODE_ENV=production
FRONTEND_PORT=5173
```

## Port Configuration

Make sure your applications are running on:
- **Frontend:** Port 5173 (or your configured port)
- **Backend:** Port 5000 (or your configured port)

Update Nginx proxy_pass URLs if your ports are different.

