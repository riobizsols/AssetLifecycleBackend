# Subdomain-Based Multi-Tenant Setup Guide

## Overview

This system implements subdomain-based multi-tenancy where each organization gets its own subdomain (e.g., `orgname.example.com`). Users only need to enter their email and password - the organization is automatically determined from the subdomain in the URL.

## Architecture

### How It Works

1. **Subdomain Extraction**: When a user accesses the application via a subdomain (e.g., `orgname.example.com`), the subdomain middleware extracts it from the request hostname.

2. **Organization Lookup**: The subdomain is mapped to an `org_id` by querying the `tenants` table or `tblOrgs` table.

3. **Database Connection**: Based on the `org_id`, the system determines whether to use:
   - **Tenant Database**: If the organization exists in the `tenants` table, it uses the tenant's dedicated database
   - **Default Database**: If not in tenants table, it uses the default shared database

4. **Authentication**: Users log in with only email and password. The system automatically:
   - Finds the user in the correct database (tenant or default)
   - Verifies the user belongs to the organization matching the subdomain
   - Generates a JWT token with the appropriate database connection flags

## Database Schema Changes

### Migration Required

Run the migration script to add subdomain columns:

```bash
psql -U your_user -d your_database -f migrations/add_subdomain_to_orgs_and_tenants.sql
```

This migration:
- Adds `subdomain` column to `tblOrgs` table
- Adds `subdomain` column to `tenants` table
- Creates indexes for fast subdomain lookups
- Generates subdomains for existing organizations

## Setup Steps

### 1. Run Database Migration

```sql
-- Execute the migration file
\i migrations/add_subdomain_to_orgs_and_tenants.sql
```

### 2. Configure DNS (Production)

For production, configure your DNS to support wildcard subdomains:

```
*.example.com    A    YOUR_SERVER_IP
```

Or use a CNAME:
```
*.example.com    CNAME    your-main-domain.com
```

### 3. Configure Web Server (Production)

Configure your web server (Nginx/Apache) to handle subdomain routing:

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name *.example.com example.com;
    
    location / {
        proxy_pass http://localhost:YOUR_PORT;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. Development Setup

For local development, you can use:
- `orgname.localhost:PORT` (works in modern browsers)
- Or modify `/etc/hosts` to add entries like:
  ```
  127.0.0.1 orgname.localhost
  ```

## Organization Registration

When a new organization is registered:

1. A unique subdomain is automatically generated from the organization name
2. The subdomain is stored in both `tblOrgs` and `tenants` tables (if tenant exists)
3. The subdomain is URL-safe and follows DNS naming conventions

### Subdomain Generation Rules

- Converted to lowercase
- Special characters replaced with hyphens
- Multiple hyphens collapsed to single hyphen
- Limited to 63 characters (DNS limit)
- Cannot start with a number (prefixed with 'org-' if needed)
- Made unique by appending numbers if conflicts exist

## API Changes

### Login Endpoint

**Before:**
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "org_id": "ORG001"  // Required
}
```

**After:**
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
  // org_id is determined from subdomain
}
```

### Error Responses

- `400 Bad Request`: Invalid subdomain (no subdomain in URL)
- `404 Not Found`: Organization not found for subdomain
- `404 Not Found`: User not found in this organization

## Frontend Changes

The frontend login form no longer requires `org_id`. Users simply:
1. Access the application via their organization's subdomain URL
2. Enter email and password
3. The system automatically determines the organization

## Testing

### Test Subdomain Extraction

```javascript
// Test in browser console
const hostname = window.location.hostname;
console.log('Subdomain:', extractSubdomain(hostname));
```

### Test Organization Lookup

```sql
-- Check subdomain mapping
SELECT org_id, subdomain FROM "tblOrgs" WHERE subdomain = 'your-subdomain';
SELECT org_id, subdomain FROM "tenants" WHERE subdomain = 'your-subdomain';
```

## Troubleshooting

### Issue: "Organization not found for subdomain"

**Solution:**
1. Verify the subdomain exists in database:
   ```sql
   SELECT * FROM "tblOrgs" WHERE subdomain = 'your-subdomain';
   SELECT * FROM "tenants" WHERE subdomain = 'your-subdomain';
   ```
2. Check subdomain middleware is running (check server logs)
3. Verify DNS/web server configuration

### Issue: "User not found in this organization"

**Solution:**
1. Verify user exists in the correct database (tenant or default)
2. Check user's `org_id` matches the subdomain's organization
3. Verify database connection is correct

### Issue: Subdomain not extracted in development

**Solution:**
- Use `orgname.localhost:PORT` format
- Or add entries to `/etc/hosts` file
- Check browser supports localhost subdomains

## Security Considerations

1. **Subdomain Validation**: Always validate subdomain exists before processing requests
2. **User-Org Matching**: Verify users belong to the organization matching the subdomain
3. **Database Isolation**: Ensure tenant databases are properly isolated
4. **Token Security**: JWT tokens include subdomain information for validation

## Migration from Old System

If migrating from the old system (with org_id in login):

1. Run the database migration
2. Generate subdomains for existing organizations
3. Update frontend to remove org_id field
4. Configure DNS/web server for subdomain routing
5. Test with existing organizations
6. Update documentation for users

## Files Modified

- `utils/subdomainUtils.js` - Subdomain extraction and mapping utilities
- `middlewares/subdomainMiddleware.js` - Middleware to extract subdomain
- `controllers/authController.js` - Updated login to use subdomain
- `controllers/orgController.js` - Auto-generate subdomain on org creation
- `models/orgModel.js` - Support subdomain in org model
- `server.js` - Added subdomain middleware
- `migrations/add_subdomain_to_orgs_and_tenants.sql` - Database migration

