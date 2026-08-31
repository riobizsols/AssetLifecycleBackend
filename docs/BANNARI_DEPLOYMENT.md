# Bannari Docker Deployment

This branch runs as an isolated ALM project at:

- Frontend: `https://bannari.rioassetmanagement.net`
- Backend: `https://bannari.rioassetmanagement.net/api`
- Backend container/host port: `alm-bannari-backend` / `5004`
- Frontend container/host port: `alm-bannari-frontend` / `3004`
- Compose project: `bannari-alm`
- Application database: `bannari_db`
- MinIO bucket: `alm-bannari`

## Server directory

The deployment scripts expect this layout:

```text
~/bannari/
├── backend/
└── frontend/
```

Clone the `bannari` branch into those folders, then configure the backend:

```bash
cd ~/bannari/backend
cp .env.production.example .env.production
nano .env.production
```

Set real values for `DATABASE_URL`, `TENANT_DATABASE_URL`, `GENERIC_URL`,
`JWT_SECRET`, MinIO credentials, email credentials, and any enabled
integration credentials. Do not commit `.env` or `.env.production`.

The `DATABASE_URL` database must exist before deployment. Create `bannari_db`
using the server's PostgreSQL administration procedure and grant the configured
database user access to it.

## Deploy

```bash
cd ~/bannari/backend
chmod +x deploy-docker.sh scripts/deploy/*.sh
./deploy-docker.sh --all
```

The script pulls the `bannari` branch, enforces Bannari-specific ports,
containers, URLs, database name, Redis settings, and MinIO bucket, then
recreates both containers and runs HTTP health checks.

## Nginx

Point `bannari.rioassetmanagement.net` DNS to the server. If wildcard DNS is
already configured, add only the Nginx server block for this host:

```nginx
server {
    listen 443 ssl;
    server_name bannari.rioassetmanagement.net;

    location /api/ {
        proxy_pass http://127.0.0.1:5004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
    }

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Use the server's existing certificate/Certbot process for the hostname, then
run `sudo nginx -t` and reload Nginx.

