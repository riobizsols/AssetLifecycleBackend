const Redis = require('ioredis');

let client = null;
let connectAttempted = false;
let unavailableLogged = false;

function isCacheEnabled() {
  return process.env.CACHE_ENABLED !== 'false';
}

function getRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;
  const db = process.env.REDIS_DB || '0';
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  }
  return `redis://${host}:${port}/${db}`;
}

function getRedis() {
  if (!isCacheEnabled()) return null;
  if (client) return client;

  client = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on('error', (err) => {
    if (!unavailableLogged) {
      console.warn('[Redis] Connection error — cache disabled for this process:', err.message);
      unavailableLogged = true;
    }
  });

  client.on('connect', () => {
    unavailableLogged = false;
    console.log('[Redis] Connected');
  });

  return client;
}

async function connectRedis() {
  if (!isCacheEnabled()) return null;
  const redis = getRedis();
  if (!redis || connectAttempted) return redis;

  connectAttempted = true;
  try {
    if (redis.status === 'wait' || redis.status === 'end') {
      await redis.connect();
    }
  } catch (err) {
    console.warn('[Redis] Initial connect failed — continuing without cache:', err.message);
  }
  return redis;
}

async function quitRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    // ignore shutdown errors
  } finally {
    client = null;
    connectAttempted = false;
  }
}

module.exports = {
  getRedis,
  connectRedis,
  quitRedis,
  isCacheEnabled,
};
