const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    // Retry settings
    retryDelayMs: 1000,
    maxRetries: 3,
    // SSL settings for remote connections
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Handle connection errors
pool.on('connect', (client) => {
    console.log('✅ Database client connected');
});

pool.on('remove', (client) => {
    console.log('🔌 Database client removed from pool');
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Database connected successfully at:', res.rows[0].now);
    }
});

module.exports = pool;
    