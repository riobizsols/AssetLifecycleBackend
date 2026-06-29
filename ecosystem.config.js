# Optional — local/non-Docker deploys only. Production uses Docker (see docker-compose.yml).
module.exports = {
  apps: [
    {
      name: 'assetlifecycle-backend',
      cwd: './',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '../logs/assetlifecycle-backend-error.log',
      out_file: '../logs/assetlifecycle-backend-out.log',
      log_file: '../logs/assetlifecycle-backend-combined.log',
      time: true,
    },
  ],
};
