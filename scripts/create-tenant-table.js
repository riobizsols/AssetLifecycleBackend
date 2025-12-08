/**
 * Create Tenant Table Script
 * 
 * This script creates the tenant table in the tenant registry database
 * (uses TENANT_DATABASE_URL if set, otherwise falls back to DATABASE_URL).
 * 
 * Usage: node scripts/create-tenant-table.js
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function createTenantTable() {
  const connectionString = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: Neither TENANT_DATABASE_URL nor DATABASE_URL environment variable is set');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    const dbName = process.env.TENANT_DATABASE_URL ? 'tenant registry database (TENANT_DATABASE_URL)' : 'database (DATABASE_URL)';
    console.log(`✅ Connected to ${dbName}`);

    // Read the migration SQL file
    const sqlPath = path.join(__dirname, '../migrations/create_tenant_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await client.query(sql);
    console.log('✅ Tenant table created successfully');

    // Verify the table exists
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verification: Tenant table exists');
    } else {
      console.log('❌ Verification failed: Tenant table not found');
    }

  } catch (error) {
    console.error('❌ Error creating tenant table:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createTenantTable();

