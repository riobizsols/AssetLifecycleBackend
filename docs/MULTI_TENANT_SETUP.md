# Multi-Tenant Setup Documentation

## Overview

The production branch now has a dedicated multi-tenant setup system that excludes `tblRioAdmin` and all RioAdmin-specific functionality from tenant databases. This ensures that tenant databases only contain tables and data relevant to regular organizational operations.

## Key Changes

### 1. New Tenant Schema Service (`services/tenantSchemaService.js`)

A dedicated service for generating database schemas specifically for tenant databases.

**Features:**
- Dynamically generates schema from `DATABASE_URL` database
- **Excludes `tblRioAdmin` table** from tenant databases
- Automatically syncs with origin database schema
- Includes all tables, constraints, indexes, sequences, and foreign keys
- Filters out foreign keys that reference excluded tables

**Excluded Tables:**
- `tblRioAdmin` - Super admin table (only for main organization)

### 2. Updated Tenant Setup Service (`services/tenantSetupService.js`)

Modified to use the new tenant schema service and seed tenant-specific data.

**Key Changes:**
- Imports `tenantSchemaService` instead of `setupWizardService`
- Uses `generateTenantSchemaSql()` to create tenant database schema
- Added `seedTenantDefaultData()` function for default data population
- Removed all RioAdmin-specific seeding logic

**Seeded Default Data:**
- ID Sequences (tblIDSequences)
- Job Roles (tblJobRoles) - Including System Administrator (JR001)
- Job Role Navigation (tblJobRoleNav) - Full navigation for System Administrator
- Asset Types (tblAssetTypes) - Default asset types
- Products/Services (tblProdServ)
- Maintenance Types (tblMaintTypes)
- Maintenance Status (tblMaintStatus)
- Events (tblEvents)
- Apps (tblApps)
- Audit Events (tblAuditEvents)
- Organization Settings (tblOrgSettings) - **Excludes `super_access_users`**

## Architecture

### Schema Generation Flow

```
DATABASE_URL (origin database)
    ↓
tenantSchemaService.generateTenantSchemaSql()
    ↓
[Filter out tblRioAdmin and related FKs]
    ↓
Generate CREATE TABLE statements
    ↓
Generate Sequences, Indexes, Constraints
    ↓
Execute in Tenant Database
```

### Tenant Creation Flow

```
POST /api/tenant-setup/create
    ↓
tenantSetupService.createTenant()
    ↓
1. Validate org_id uniqueness
2. Generate database name
3. Create database
4. Register tenant in registry
5. Generate tenant schema (without tblRioAdmin)
6. Execute schema SQL
7. Create organization record (tblOrgs)
8. Create admin user (tblUsers)
9. Seed default data
10. Return tenant credentials
```

## Differences: Main Org vs Tenant

| Feature | Main Organization | Tenant Organization |
|---------|------------------|-------------------|
| Setup Service | `setupWizardService` | `tenantSchemaService` |
| Schema Source | DATABASE_URL | DATABASE_URL (filtered) |
| tblRioAdmin | ✅ Included | ❌ Excluded |
| RioAdmin User | ✅ Created (username: rioadmin) | ❌ Not created |
| Super Access Users | ✅ Setting added to tblOrgSettings | ❌ Setting excluded |
| Admin User Table | tblRioAdmin | tblUsers |
| Admin User Format | rioadmin (username) | email@domain.com (email) |
| Default Password | "Initial1" (hardcoded) | User-provided during setup |
| Job Roles | Full set with special JR001 nav | Full set with standard JR001 nav |
| Default Data | Full seed with RioAdmin config | Standard seed without RioAdmin |

## Usage

### Creating a Tenant

**Endpoint:** `POST /api/tenant-setup/create`

**Request Body:**
```json
{
  "orgId": "TENANT001",
  "orgName": "Tenant Organization Name",
  "orgCode": "TNT001",
  "orgCity": "City Name",
  "adminUser": {
    "fullName": "Admin Name",
    "email": "admin@tenant.com",
    "password": "SecurePassword123",
    "phone": "+1234567890"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tenant created successfully",
  "data": {
    "orgId": "TENANT001",
    "generatedOrgId": "ORG001",
    "orgName": "Tenant Organization Name",
    "subdomain": "tenant-organization-name",
    "subdomainUrl": "https://tenant-organization-name.riowebworks.net",
    "database": "tenant001_db",
    "adminCredentials": {
      "userId": "USR001",
      "email": "admin@tenant.com",
      "password": "SecurePassword123",
      "fullName": "Admin Name"
    }
  }
}
```

### Tenant Login

Tenants log in using:
- **Organization ID:** TENANT001 (unique identifier)
- **Email:** admin@tenant.com (stored in tblUsers)
- **Password:** User-provided password

**No username-based login for tenants** - they always use email.

### Schema Sync

Tenant databases **automatically** receive schema updates from the origin database (DATABASE_URL) when created:

1. Schema is generated dynamically from DATABASE_URL
2. tblRioAdmin is filtered out during generation
3. All other tables, constraints, and indexes are included
4. Foreign keys referencing excluded tables are removed

This ensures:
- ✅ Tenants always have the latest schema
- ✅ No manual schema maintenance required
- ✅ Origin database remains the single source of truth
- ✅ RioAdmin functionality is completely isolated

## Security Considerations

1. **Isolated Super Admin Access**: 
   - RioAdmin (super admin) only exists in main organization
   - Tenants cannot access RioAdmin functionality
   - No super_access_users setting in tenant databases

2. **Tenant Isolation**:
   - Each tenant has its own database
   - No cross-tenant data access
   - Separate admin users per tenant

3. **Authentication**:
   - Main org: RioAdmin uses username ("rioadmin")
   - Tenants: Admins use email for login
   - Different authentication flows prevent confusion

## Future Enhancements

1. **Schema Migrations**: Automatic tenant database schema updates
2. **Backup/Restore**: Tenant-specific backup strategies
3. **Resource Quotas**: Limit tenant database size/connections
4. **Analytics**: Tenant usage monitoring and reporting
5. **Customization**: Per-tenant feature flags and settings

## Troubleshooting

### Issue: Tenant database missing tables

**Solution:** Check that:
- DATABASE_URL is accessible
- Origin database has all required tables
- tenantSchemaService can query information_schema

### Issue: Foreign key errors during setup

**Solution:** 
- Verify that all referenced tables exist in origin database
- Check that FK filtering is working correctly
- Review foreign key statements in generated SQL

### Issue: Admin user cannot login

**Solution:**
- Verify user was created in tblUsers (not tblRioAdmin)
- Check that JR001 job role exists
- Verify tblUserJobRoles has entry for admin user
- Ensure email and password are correct

## Files Modified

- `services/tenantSchemaService.js` (NEW) - Tenant schema generation
- `services/tenantSetupService.js` (MODIFIED) - Updated to use tenant schema
- `docs/MULTI_TENANT_SETUP.md` (NEW) - This documentation

## Migration Notes

**For existing deployments:**

1. Pull latest production branch
2. No database migrations needed
3. New tenants will automatically use new schema service
4. Existing tenants are unaffected
5. Main organization setup remains unchanged

---

**Last Updated:** December 6, 2025  
**Version:** 1.0.0  
**Branch:** production

