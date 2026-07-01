# Update Backend Port to 5001

## ✅ What's Been Done

1. ✅ Frontend is already configured to use port 5001
   - File: `AssetLifecycleWebFrontend/src/config/environment.js`
   - API_BASE_URL: `http://localhost:5001/api`

2. ✅ Backend environment.js updated to default to port 5001
   - File: `AssetLifecycleBackend/config/environment.js`
   - Default PORT changed from 5000 to 5001

## 📝 Action Required: Update .env File

### For Development:

Open your `.env` file and add or update this line:

```env
PORT=5001
```

### Where to find .env file:
```
AssetLifecycleBackend/.env
```

### Complete .env should include:
```env
PORT=5001
DATABASE_URL=your_database_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

### For Production:

Update your production `.env` file:

```env
PORT=5001
DATABASE_URL=your_production_database_url
JWT_SECRET=your_production_jwt_secret
NODE_ENV=production
```

## 🚀 Restart Your Backend Server

After updating the .env file:

1. **Stop the current server** (Ctrl+C in the terminal where npm run dev is running)
2. **Start it again:**
   ```bash
   npm run dev
   ```

You should see:
```
Server is listening on port 5001
```

## ✅ Verify It's Working

### Test 1: Backend is running on 5001
Open browser: `http://localhost:5001`

You should see: "Server is running!"

### Test 2: Frontend can connect
Open your frontend app and test any API call. It should now connect to port 5001.

## 🚀 Production Deployment

### Option 1: Direct Port Access (Simple)
Your app will be accessible at:
```
https://your-domain.com:5001/api
```

**Note:** You'll need to:
- Open port 5001 in your firewall
- Configure SSL certificate for port 5001
- Ensure your domain DNS is configured

### Option 2: Reverse Proxy (Recommended)
Use Nginx or Apache to proxy requests from port 443 (HTTPS) to 5001:

**Nginx Example:**
```nginx
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api {
        proxy_pass http://localhost:5001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

This way, users access `https://api.your-domain.com/api` and Nginx forwards to `http://localhost:5001/api`

### Environment Variables for Production

Set these in your production environment:
```env
PORT=5001
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-strong-secret-key
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com:5001
API_BASE_URL=https://api.your-domain.com:5001/api
```

**Or with reverse proxy (Option 2):**
```env
PORT=5001
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-strong-secret-key
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com
API_BASE_URL=https://api.your-domain.com/api
```

## 🔍 Troubleshooting

### Port already in use?
If port 5001 is already in use, check what's running:

**Windows:**
```powershell
netstat -ano | findstr :5001
```

Kill the process:
```powershell
taskkill /PID <process_id> /F
```

**Linux:**
```bash
sudo lsof -i :5001
sudo kill -9 <PID>
```

### Still running on 5000?
- Make sure you saved the .env file
- Make sure you restarted the server (Ctrl+C and npm run dev again)
- Check the terminal output for the port number

### Production CORS errors?
Make sure your production CORS settings include:
- Your frontend domain
- Port 5001 (if using direct access)
- Any subdomains you're using

---

**Status**: ⏳ Awaiting .env file update and server restart
