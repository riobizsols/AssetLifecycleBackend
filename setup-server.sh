#!/bin/bash

# Ubuntu Server Setup Script for Asset Lifecycle Management Backend
# Run this script on a fresh Ubuntu server

set -e

echo "🚀 Setting up Ubuntu server for Asset Lifecycle Management Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Update system
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
print_status "Installing PostgreSQL..."
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
print_status "Installing Nginx..."
sudo apt install nginx -y

# Install PM2 globally
print_status "Installing PM2..."
sudo npm install -g pm2

# Install Git
print_status "Installing Git..."
sudo apt install git -y

# Install build tools
print_status "Installing build tools..."
sudo apt install build-essential -y

# Setup PostgreSQL
print_status "Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE assetlifecycle;"
sudo -u postgres psql -c "CREATE USER assetuser WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE assetlifecycle TO assetuser;"

# Create application directory
print_status "Creating application directory..."
sudo mkdir -p /var/www/assetlifecycle
sudo chown $USER:$USER /var/www/assetlifecycle

# Setup firewall
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000
sudo ufw --force enable

# Setup Nginx
print_status "Setting up Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default

# Create logs directory
print_status "Creating logs directory..."
mkdir -p /var/www/assetlifecycle/logs

print_status "Server setup completed!"
print_status "Next steps:"
print_status "1. Clone your backend repository to /var/www/assetlifecycle/backend"
print_status "2. Clone your frontend repository to /var/www/assetlifecycle/frontend"
print_status "3. Copy nginx.conf to /etc/nginx/sites-available/assetlifecycle"
print_status "4. Enable the site: sudo ln -s /etc/nginx/sites-available/assetlifecycle /etc/nginx/sites-enabled/"
print_status "5. Test Nginx: sudo nginx -t"
print_status "6. Restart Nginx: sudo systemctl restart nginx"
print_status "7. Run the deployment script: cd backend && ./deploy.sh"
