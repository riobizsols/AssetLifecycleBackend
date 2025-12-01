# Multi-Tenant Implementation Guide

## Overview

This system implements multi-tenancy where each organization has its own database. The main PostgreSQL server (from `DATABASE_URL`) contains a `tenants` table that stores database credentials for each organization.

## Architecture

```
Tenant Registry Database (TENANT_DATABASE_URL)
├── tenants table (stores org database credentials)
│
└── Organization Databases
    ├── assetLifecycle (ORG001)
    ├── hospitality (ORG002)
    └── ... (other org databases)
```

## Components

### 1. Tenant Table (`tenants`)
Located in the tenant registry database (TENANT_DATABASE_URL), stores:
- `org_id` (primary key)
- `db_host`, `db_port`, `db_name`, `db_user`, `db_password`
- `is_active`, `created_at`, `updated_at`

### 2. Tenant Service (`services/tenantService.js`)
Provides functions to:
- `getTenantCredentials(orgId)` - Get database credentials for an org
- `getTenantPool(orgId)` - Get a connection pool for an org's database
- `getTenantClient(orgId)` - Get a client connection for transactions
- `registerTenant(orgId, dbConfig)` - Register a new tenant
- `updateTenant(orgId, dbConfig)` - Update tenant credentials
- `deactivateTenant(orgId)` - Deactivate a tenant

### 3. Updated Login Flow

**Before:**
```
User → Login API → Default Database → Authenticate
```

**After:**
```
User → Login API (with org_id) → Tenant Table Lookup → Org Database → Authenticate
```

## Setup Instructions

### 1. Create Tenant Table

Run the migration script:
```bash
node scripts/create-tenant-table.js
```

### 2. Register Existing Organizations

If you have existing organizations, register them:
```bash
node scripts/register-existing-tenant.js ORG001 assetLifecycle
node scripts/register-existing-tenant.js ORG002 hospitality
```

### 3. New Organization Setup

When running the setup wizard, the tenant is automatically registered after organization creation.

## Login API Changes

### Request Format
```json
{
  "org_id": "ORG001",
  "email": "user@example.com",
  "password": "password123"
}
```

### Response Format
```json
{
  "token": "jwt_token_here",
  "user": {
    "user_id": "USR001",
    "full_name": "John Doe",
    "email": "user@example.com",
    "org_id": "ORG001",
    "roles": [...],
    "branch_id": "...",
    ...
  }
}
```

## Database Connection Flow

1. **Login Request** arrives with `org_id`, `email`, `password`
2. **Tenant Lookup**: Query `tenants` table in tenant registry database (TENANT_DATABASE_URL) using `org_id`
3. **Get Credentials**: Retrieve encrypted database credentials
4. **Decrypt Password**: Decrypt the database password
5. **Connect to Org DB**: Create connection pool to organization's database
6. **Authenticate User**: Query `tblUsers` in organization's database
7. **Return Token**: Generate JWT with `org_id` included

## Security

- Database passwords in `tenants` table are encrypted using AES-256
- Encryption key is derived from `JWT_SECRET` environment variable
- Each organization's database is isolated
- Tenant lookup happens before any user authentication

## Files Modified

1. **`migrations/create_tenant_table.sql`** - Tenant table schema
2. **`services/tenantService.js`** - Tenant management service (NEW)
3. **`controllers/authController.js`** - Updated login to use tenant lookup
4. **`middlewares/authMiddleware.js`** - Updated to use tenant database
5. **`models/userModel.js`** - Updated to accept tenant pool parameter
6. **`models/userJobRoleModel.js`** - Updated to accept tenant pool parameter
7. **`services/setupWizardService.js`** - Auto-registers tenant after setup

## Testing

### Test Tenant Connection
```javascript
const { testTenantConnection } = require('./services/tenantService');
const result = await testTenantConnection('ORG001');
console.log(result);
```

### Verify Tenant Registration
```sql
SELECT org_id, db_host, db_name, is_active, created_at 
FROM tenants;
```

## Notes

- The tenant registry database (`TENANT_DATABASE_URL`) is used for the `tenants` table
- All application data (users, assets, etc.) is stored in organization-specific databases
- Each organization's database is completely isolated
- The `org_id` is included in JWT tokens for tenant identification

## Future Enhancements

- Add tenant-level connection pooling
- Implement tenant-level caching
- Add tenant migration tools
- Implement tenant backup/restore utilities

