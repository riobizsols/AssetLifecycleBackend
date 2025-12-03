const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connection pool settings
    // Reduced from 50 to 20 to leave room for DBeaver and other tools
    // PostgreSQL default max_connections is usually 100
    max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of clients in the pool
    min: parseInt(process.env.DB_POOL_MIN) || 2, // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    // Allow the pool to wait for a connection if all are busy
    allowExitOnIdle: false,
    // SSL settings for remote connections
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('❌ [DB POOL] Unexpected error on idle client:', err.message);
    // Don't exit on pool errors - let the application handle it gracefully
});

// Monitor pool connections
pool.on('connect', (client) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ [DB POOL] Client connected. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
    }
});

pool.on('remove', (client) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`🔌 [DB POOL] Client removed. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
    }
});

// Log pool stats periodically (only in development)
if (process.env.NODE_ENV !== 'production') {
    setInterval(() => {
        const stats = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
            usage: pool.totalCount > 0 ? ((pool.totalCount - pool.idleCount) / pool.totalCount * 100).toFixed(1) : 0
        };
        if (stats.total > 0 || stats.waiting > 0) {
            console.log(`📊 [DB POOL STATS] Total: ${stats.total}, Idle: ${stats.idle}, Active: ${stats.total - stats.idle}, Waiting: ${stats.waiting}, Usage: ${stats.usage}%`);
        }
    }, 60000); // Every minute
}

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
});

// Graceful shutdown - close pool on process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 [DB POOL] Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 [DB POOL] Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

module.exports = pool;
