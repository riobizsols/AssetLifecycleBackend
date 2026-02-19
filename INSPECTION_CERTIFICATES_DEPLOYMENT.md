# Inspection Certificates Feature - Deployment Guide

## Overview
This guide explains how to deploy the new Inspection Certificates feature in the ALM (Asset Lifecycle Management) system. The feature allows administrators to map inspection certificates to asset types.

## What Changed

### Frontend Changes
- Added "Inspection Certificates" tab to the Certifications admin page
- Implemented asset type selection and certificate mapping interface
- Two-column certificate selector with move buttons (→, >>, ←, <<)
- Improved error messages for database configuration issues

### Backend Changes
- Added `/asset-types/:assetTypeId/inspection-certificates` API endpoints
- Implemented `tblATInspCert` table for storing mappings
- Added proper error handling for missing database table

### Database Changes
- New table: `tblATInspCert` for storing inspection certificate mappings
- Columns: atic_id, asset_type_id, tc_id, org_id, created_by, created_on
- Foreign key constraints to ensure data integrity
- Indexes for performance optimization

## Deployment Steps

### Step 1: Deploy Backend Code
Update the backend with the latest code containing:
- Updated `techCertController.js` with inspection certificate handlers
- Updated `techCertModel.js` with inspection certificate queries
- Updated `techCertRoutes.js` with inspection certificate routes

### Step 2: Run Database Migration
Execute the migration to create the `tblATInspCert` table. Choose ONE of these methods:

#### Option A: Using the Migration Runner Script (Recommended)
```bash
cd d:\Work\ALM\AssetLifecycleBackend
node run-inspection-cert-migration.js
```

This script will:
1. Check if the table already exists
2. Read and execute the migration SQL
3. Confirm successful creation
4. Display any errors with helpful messages

#### Option B: Direct SQL Execution
Execute the SQL from `migrations/create_tblATInspCert.sql`:
```bash
# Using psql command-line
psql -h localhost -U postgres -d your_database_name < migrations/create_tblATInspCert.sql

# Or copy the entire SQL content and run it in your SQL client (pgAdmin, DBeaver, etc.)
```

#### Option C: In Code During Startup
The system will automatically detect if the table is missing and:
- Not crash the application
- Return helpful error messages to admins
- Indicate that the migration needs to be run

### Step 3: Deploy Frontend Code
Update the frontend with:
- Updated `Certifications.jsx` with Inspection Certificates tab and improved error handling

### Step 4: Restart the Application
Restart both frontend and backend services for changes to take effect.

### Step 5: Verify Deployment
1. Log in as an administrator
2. Navigate to Admin Settings → Certifications
3. Verify three tabs exist:
   - Certificate
   - Maintenance Certificate
   - Inspection Certificates
4. Click on "Inspection Certificates" tab
5. Select an asset type from the dropdown
6. Click "Add" to open the mapping form
7. Try adding some inspection certificates
8. Verify data saves successfully

## Troubleshooting

### "Failed to save inspection certificates" Error
**Cause:** The `tblATInspCert` table hasn't been created yet.

**Solution:** Run the migration using one of the methods above. The error message will guide you:
> "Database setup required. Please contact your administrator to run the inspection certificates migration."

### Migration Script Fails
**Common causes:**
1. Database connection issues - verify connection string and credentials
2. User doesn't have CREATE TABLE permissions - verify database user privileges
3. Table already exists (from partial previous creation) - the migration script handles this gracefully

**Solution:** 
- Check database connectivity
- Verify user has proper CREATE TABLE and CONSTRAINT permissions
- Run the inspection script to check table status:
```javascript
const { getPool } = require('./config/database');
const pool = getPool();

pool.query(`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tblATInspCert'
  );
`).then(result => {
  console.log('Table exists:', result.rows[0].exists);
}).catch(error => {
  console.error('Error checking table:', error);
});
```

### Data Not Persisting After Save
1. Verify migration was executed successfully
2. Check database logs for any CONSTRAINT or FOREIGN KEY errors
3. Verify `org_id` is set correctly (system filters by organization)
4. Check browser console for API error messages

## Performance Considerations

The migration includes indexes on:
- `asset_type_id` - for filtering by asset type
- `tc_id` - for validating certificate references
- `org_id` - for multi-tenant organization filtering

These indexes ensure optimal query performance when mapping and retrieving certificates.

## Rollback Procedure

If you need to rollback this feature:

```sql
-- Drop the inspection certificates table
DROP TABLE IF EXISTS tblATInspCert CASCADE;

-- Or, if you want to keep the schema but clear the data:
TRUNCATE TABLE tblATInspCert RESTART IDENTITY CASCADE;
```

Note: The frontend UI will gracefully degrade if the table is missing - no crashes, just helpful error messages.

## Support

For issues or questions about the Inspection Certificates feature:
1. Check the migration log for detailed error messages
2. Verify database connectivity and user permissions
3. Review the error messages in the browser console
4. Check the backend logs for API errors

## Additional Files

- **Migration Script:** `migrations/create_tblATInspCert.sql`
- **Migration Runner:** `run-inspection-cert-migration.js`
- **Frontend Component:** `src/pages/adminSettings/Certifications.jsx`
- **Backend Controller:** `controllers/techCertController.js`
- **Backend Model:** `models/techCertModel.js`
- **Routes Config:** `routes/techCertRoutes.js`
