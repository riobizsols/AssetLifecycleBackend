const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

function trustProxy(app) {
  if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  }
}

function applyScalingMiddleware(app) {
  trustProxy(app);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    compression({
      threshold: 1024,
      level: Number(process.env.COMPRESSION_LEVEL || 6),
    }),
  );

  const globalMax = Number(process.env.RATE_LIMIT_MAX_PER_MIN || 300);
  if (globalMax > 0) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        max: globalMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many requests. Please try again shortly.' },
      }),
    );
  }

  const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX_PER_15MIN || 30);
  if (authMax > 0) {
    app.use(
      '/api/auth/login',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: authMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: 'Too many login attempts. Please wait and try again.' },
      }),
    );
  }
}

function registerHealthRoutes(app) {
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/ready', async (req, res) => {
    try {
      const db = require('../config/db');
      await db.query('SELECT 1');
      const { getRedis, isCacheEnabled } = require('../config/redis');
      const redis = getRedis();
      const cacheReady = !isCacheEnabled() || redis?.status === 'ready';
      if (!cacheReady) {
        return res.status(503).json({ status: 'degraded', db: 'ok', redis: 'down' });
      }
      res.json({ status: 'ready', db: 'ok', redis: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'not ready', error: err.message });
    }
  });
}

module.exports = {
  applyScalingMiddleware,
  registerHealthRoutes,
};
