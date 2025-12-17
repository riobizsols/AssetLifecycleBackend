#!/bin/bash

# SSL Certificate Setup Script for riowebworks.net
# This script helps automate the SSL certificate setup process

set -e

echo "🔒 SSL Certificate Setup for riowebworks.net"
echo "=============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if Certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt-get update
    apt-get install certbot python3-certbot-nginx -y
    echo "✅ Certbot installed"
else
    echo "✅ Certbot is already installed"
fi

echo ""
echo "📋 Certificate Setup Options:"
echo "1. Manual DNS challenge (for wildcard certificate)"
echo "2. Automatic with Nginx plugin (requires HTTP access first)"
echo ""
read -p "Choose option (1 or 2): " option

case $option in
    1)
        echo ""
        echo "🌐 Starting manual DNS challenge for wildcard certificate..."
        echo "You will need to add a DNS TXT record in GoDaddy when prompted."
        echo ""
        certbot certonly --manual --preferred-challenges dns \
            -d *.riowebworks.net \
            -d riowebworks.net \
            --email admin@riowebworks.net \
            --agree-tos \
            --no-eff-email
        ;;
    2)
        echo ""
        echo "🌐 Starting automatic certificate setup with Nginx..."
        echo "Make sure Nginx is running and riowebworks.net is accessible on port 80"
        echo ""
        certbot --nginx -d riowebworks.net -d *.riowebworks.net
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

# Check if certificate was created
if [ -f "/etc/letsencrypt/live/riowebworks.net/fullchain.pem" ]; then
    echo ""
    echo "✅ Certificate created successfully!"
    echo ""
    echo "📁 Certificate location:"
    echo "   /etc/letsencrypt/live/riowebworks.net/"
    echo ""
    echo "📝 Next steps:"
    echo "1. Copy nginx-ssl.conf to /etc/nginx/sites-available/riowebworks.net"
    echo "2. Update backend port in the config if needed (currently set to 5001)"
    echo "3. Test Nginx config: sudo nginx -t"
    echo "4. Enable site: sudo ln -s /etc/nginx/sites-available/riowebworks.net /etc/nginx/sites-enabled/"
    echo "5. Reload Nginx: sudo systemctl reload nginx"
    echo ""
    echo "🔄 Setting up auto-renewal..."
    
    # Test renewal
    certbot renew --dry-run
    
    # Enable auto-renewal timer
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo "✅ Auto-renewal configured"
    echo ""
    echo "🎉 SSL setup complete! Your subdomains should now work with HTTPS."
else
    echo ""
    echo "❌ Certificate creation failed. Please check the error messages above."
    exit 1
fi


