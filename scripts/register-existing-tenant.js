/**
 * Register Existing Tenant Script
 * 
 * This script registers an existing organization as a tenant
 * by adding its database credentials to the tenant table.
 * 
 * Usage: node scripts/register-existing-tenant.js <org_id> <database_name>
 * Example: node scripts/register-existing-tenant.js ORG001 assetLifecycle
 */

require('dotenv').config();
const { registerTenant } = require('../services/tenantService');

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

async function registerExistingTenant() {
  const orgId = process.argv[2];
  const databaseName = process.argv[3];

  if (!orgId) {
    console.error('❌ Error: Organization ID is required');
    console.log('Usage: node scripts/register-existing-tenant.js <org_id> <database_name>');
    process.exit(1);
  }

  if (!databaseName) {
    console.error('❌ Error: Database name is required');
    console.log('Usage: node scripts/register-existing-tenant.js <org_id> <database_name>');
    process.exit(1);
  }

  try {
    const mainDbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    
    // Use the same host, port, user, password as main database
    // but different database name
    await registerTenant(orgId, {
      host: mainDbConfig.host,
      port: parseInt(mainDbConfig.port),
      database: databaseName,
      user: mainDbConfig.user,
      password: mainDbConfig.password,
    });

    console.log(`✅ Successfully registered tenant: ${orgId} -> ${databaseName}`);
    console.log(`   Host: ${mainDbConfig.host}:${mainDbConfig.port}`);
    console.log(`   Database: ${databaseName}`);
  } catch (error) {
    console.error(`❌ Error registering tenant: ${error.message}`);
    process.exit(1);
  }
}

registerExistingTenant();

