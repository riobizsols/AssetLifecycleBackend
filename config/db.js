const { Pool } = require('pg');
require('dotenv').config();

if (global.__ASSET_LIFECYCLE_DB_SINGLETON__) {
  module.exports = global.__ASSET_LIFECYCLE_DB_SINGLETON__;
} else {
  const buildConnectionString = () => process.env.DATABASE_URL || 'postgresql://localhost/postgres';
  const isPoolEndedError = (err) => Boolean(err && /pool after calling end/i.test(String(err.message || err)));

  if (!process.env.DATABASE_URL) {
    console.error('❌ [DB POOL] DATABASE_URL is not set. Set it in .env or environment.');
  }

  function createPool(connectionString) {
    const pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('❌ [DB POOL] Unexpected error on idle client:', err.message);
    });

    pool.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ [DB POOL] Client connected. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
      }
    });

    pool.on('remove', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔌 [DB POOL] Client removed. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
      }
    });

    return pool;
  }

  let currentPool = createPool(buildConnectionString());
  let reloadLock = null;

  function recreateCurrentPool() {
    console.warn('⚠️ [DB POOL] Recreating ended pool using current DATABASE_URL...');
    currentPool = createPool(buildConnectionString());
    return currentPool;
  }

  const dbApi = {
    async query(...args) {
      try {
        return await currentPool.query(...args);
      } catch (err) {
        if (!isPoolEndedError(err)) throw err;
        const recoveredPool = recreateCurrentPool();
        return recoveredPool.query(...args);
      }
    },

    async connect(...args) {
      try {
        return await currentPool.connect(...args);
      } catch (err) {
        if (!isPoolEndedError(err)) throw err;
        const recoveredPool = recreateCurrentPool();
        return recoveredPool.connect(...args);
      }
    },

    async end() {
      console.warn('⚠️ [DB POOL] .end() ignored on app DB API. Use reloadPool or process exit.');
      return Promise.resolve();
    },

    get totalCount() {
      return currentPool?.totalCount ?? 0;
    },

    get idleCount() {
      return currentPool?.idleCount ?? 0;
    },

    get waitingCount() {
      return currentPool?.waitingCount ?? 0;
    },
  };

  async function reloadPool(newConnectionString) {
    if (!newConnectionString || typeof newConnectionString !== 'string') {
      throw new Error('reloadPool requires a valid connection string');
    }
    while (reloadLock) {
      await reloadLock;
    }
    let release;
    reloadLock = new Promise((resolve) => { release = resolve; });
    try {
      const newPool = createPool(newConnectionString);
      try {
        await newPool.query('SELECT 1');
      } catch (err) {
        await newPool.end().catch(() => {});
        throw new Error('New database connection failed: ' + (err?.message || err));
      }
      currentPool = newPool;
      process.env.DATABASE_URL = newConnectionString;
      console.log('✅ [DB POOL] Reloaded successfully. New database connected.');
    } finally {
      release();
      reloadLock = null;
    }
  }

  function getCurrentPool() {
    return dbApi;
  }

  async function shutdownPool() {
    console.warn('⚠️ [DB POOL] shutdownPool() is a no-op; pool is not ended to avoid breaking in-flight requests.');
  }

  // Log pool stats periodically (development only)
  if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
      try {
        const total = dbApi.totalCount;
        const idle = dbApi.idleCount;
        const waiting = dbApi.waitingCount;
        const usage = total > 0 ? ((total - idle) / total * 100).toFixed(1) : 0;
        if (total > 0 || waiting > 0) {
          console.log(`📊 [DB POOL STATS] Total: ${total}, Idle: ${idle}, Active: ${total - idle}, Waiting: ${waiting}, Usage: ${usage}%`);
        }
      } catch (_) {
        // no-op
      }
    }, 60000);
  }

  currentPool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
    } else {
      console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
  });

  module.exports = dbApi;
  module.exports.getCurrentPool = getCurrentPool;
  module.exports.reloadPool = reloadPool;
  module.exports.shutdownPool = shutdownPool;
  global.__ASSET_LIFECYCLE_DB_SINGLETON__ = module.exports;
}
