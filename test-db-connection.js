#!/usr/bin/env node

// Database Connection Test Script
require('dotenv').config();
const pool = require('./config/db.js');

console.log('🔍 Testing database connection...');
console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

pool.query('SELECT NOW() as current_time, version() as db_version', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:');
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    process.exit(1);
  } else {
    console.log('✅ Database connection successful!');
    console.log('Current time:', res.rows[0].current_time);
    console.log('Database version:', res.rows[0].db_version);
    process.exit(0);
  }
});
