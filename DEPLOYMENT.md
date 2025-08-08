# Asset Lifecycle Management Backend - Deployment Guide

## 🚀 Overview

This guide provides step-by-step instructions for deploying the Asset Lifecycle Management Backend on Ubuntu with PM2 and Nginx.

## 📋 Prerequisites

- Ubuntu 20.04+ server
- Domain name (optional but recommended)
- SSH access to server
- Git repository access

## 🛠️ Server Setup

### 1. Initial Server Setup

```bash
# Run the server setup script
chmod +x setup-server.sh
./setup-server.sh
```

This script will:
- Update system packages
- Install Node.js 18.x
- Install PostgreSQL
- Install Nginx
- Install PM2
- Setup firewall
- Create application directory

### 2. Manual PostgreSQL Configuration

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf
# Add: listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all 127.0.0.1/32 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## 📁 Project Structure

```
/var/www/assetlifecycle/
├── backend/                    # Backend repository
│   ├── .env                   # Backend environment variables
│   ├── server.js              # Express server
│   ├── ecosystem.config.js    # PM2 configuration
│   ├── nginx.conf             # Nginx configuration
│   ├── deploy.sh              # Backend deployment script
│   └── setup-server.sh        # Server setup script
├── frontend/                   # Frontend repository
│   ├── dist/                  # Built frontend files
│   ├── .env                   # Frontend environment variables
│   └── ...
└── logs/                      # PM2 logs
```

## 🔧 Environment Configuration

### Backend Environment (.env)

```bash
# Database
DATABASE_URL=postgresql://assetuser:your_secure_password@localhost:5432/assetlifecycle

# Server
PORT=5000
NODE_ENV=production

# JWT
JWT_SECRET=your_jwt_secret_here

# URLs
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com
API_BASE_URL=https://your-domain.com/api

# Email (for password reset)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Cron Service Token (optional)
CRON_API_TOKEN=your_cron_token_here
```

## 🚀 Deployment

### 1. Clone Backend Repository

```bash
cd /var/www/assetlifecycle
git clone https://github.com/your-username/assetlifecycle-backend.git backend
```

### 2. Setup Environment Files

```bash
cd backend
cp env.example .env
nano .env  # Edit with your configuration
```

### 3. Run Database Migrations

```bash
cd /var/www/assetlifecycle/backend
node run_migration.js
```

### 4. Deploy Backend

```bash
cd /var/www/assetlifecycle/backend
chmod +x deploy.sh
./deploy.sh production
```

## 🌐 Nginx Configuration

### 1. Copy Nginx Configuration

```bash
sudo cp /var/www/assetlifecycle/backend/nginx.conf /etc/nginx/sites-available/assetlifecycle
```

### 2. Update Domain Name

Edit `/etc/nginx/sites-available/assetlifecycle` and replace `your-domain.com` with your actual domain.

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/assetlifecycle /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 📊 Monitoring & Management

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs assetlifecycle-backend

# Restart application
pm2 restart assetlifecycle-backend

# Stop application
pm2 stop assetlifecycle-backend

# Delete application
pm2 delete assetlifecycle-backend
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Updates & Maintenance

### Update Backend

```bash
cd /var/www/assetlifecycle/backend
git pull origin main
./deploy.sh production
```

### Update Dependencies

```bash
cd /var/www/assetlifecycle/backend
npm update
pm2 restart assetlifecycle-backend
```

## 🐛 Troubleshooting

### Common Issues

1. **Port 5000 not accessible**
   ```bash
   sudo ufw allow 5000
   ```

2. **Database connection failed**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connection
   psql -h localhost -U assetuser -d assetlifecycle
   ```

3. **Nginx 502 Bad Gateway**
   ```bash
   # Check if backend is running
   pm2 status
   
   # Check backend logs
   pm2 logs assetlifecycle-backend
   ```

### Log Locations

- **PM2 Logs**: `/var/www/assetlifecycle/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **System Logs**: `/var/log/syslog`

## 📈 Performance Optimization

### PM2 Optimization

```bash
# Monitor memory usage
pm2 monit

# Set memory limit
pm2 restart assetlifecycle-backend --max-memory-restart 1G
```

## 🔐 Security Considerations

1. **Firewall**: UFW is configured to allow only necessary ports
2. **SSL**: Use Let's Encrypt for HTTPS
3. **Environment Variables**: Never commit .env files
4. **Database**: Use strong passwords and limit access
5. **Updates**: Regularly update system packages

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs assetlifecycle-backend`
2. Test API: `curl http://localhost:5000/api/health`
3. Check Nginx: `sudo nginx -t`
4. Verify environment variables are set correctly
