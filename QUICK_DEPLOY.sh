#!/bin/bash

# Quick Deployment Script for Multi-Tenant Subdomain Setup
# Run this script on your Ubuntu server after initial setup

set -e  # Exit on error

echo "=========================================="
echo "Multi-Tenant Subdomain Deployment Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

echo -e "${YELLOW}Step 2: Installing required software...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx git

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js 18.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
fi

echo -e "${YELLOW}Step 3: Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo -e "${YELLOW}Step 4: Creating Nginx configuration...${NC}"
cat > /etc/nginx/sites-available/riowebworks.net << 'EOF'
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

    # SSL Certificate Configuration (update after certificate setup)
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
        
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

echo -e "${YELLOW}Step 5: Enabling Nginx site...${NC}"
ln -sf /etc/nginx/sites-available/riowebworks.net /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo -e "${YELLOW}Step 6: Testing Nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}Nginx configuration is valid${NC}"
    systemctl reload nginx
else
    echo -e "${RED}Nginx configuration has errors. Please fix them.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Basic setup complete!"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure DNS in GoDaddy:"
echo "   - Add A record: * → 103.27.234.248"
echo "   - Add A record: @ → 103.27.234.248"
echo ""
echo "2. Get SSL certificate:"
echo "   sudo certbot certonly --manual --preferred-challenges dns -d *.riowebworks.net -d riowebworks.net"
echo ""
echo "3. Deploy your applications:"
echo "   - Backend: cd /path/to/AssetLifecycleBackend && npm install && pm2 start server.js"
echo "   - Frontend: cd /path/to/AssetLifecycleWebFrontend && npm install && npm run build && pm2 start serve -- -s -l 5173 dist"
echo ""
echo "4. Set up SSL auto-renewal (see DEPLOYMENT_GUIDE.md)"
echo ""
echo -e "${GREEN}For detailed instructions, see DEPLOYMENT_GUIDE.md${NC}"

