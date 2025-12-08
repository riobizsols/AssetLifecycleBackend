# Debugging Normal Login (DATABASE_URL) Issues

## Problem
When accessing through DATABASE_URL (normal login), sidebar items are empty and screens are not populated.

## Root Causes to Check

### 1. Navigation/Sidebar Issues

**Check if user has job roles assigned:**
```sql
-- In your default DATABASE_URL database
SELECT * FROM "tblUserJobRoles" WHERE user_id = 'YOUR_USER_ID';
```

**Check if navigation items exist:**
```sql
-- In your default DATABASE_URL database
SELECT * FROM "tblJobRoleNav" WHERE int_status = 1;
```

**Check if job roles exist:**
```sql
-- In your default DATABASE_URL database
SELECT * FROM "tblJobRoles" WHERE int_status = 1;
```

### 2. Screen Data Issues

**Check if data exists for the user's org_id:**
```sql
-- Replace 'YOUR_ORG_ID' with the org_id from the user's token
SELECT COUNT(*) FROM "tblAssets" WHERE org_id = 'YOUR_ORG_ID';
SELECT COUNT(*) FROM "tblAssetTypes" WHERE org_id = 'YOUR_ORG_ID';
SELECT COUNT(*) FROM "tblBranches" WHERE org_id = 'YOUR_ORG_ID';
```

### 3. Database Context Issues

The middleware should:
1. Check if `org_id` exists in `tenants` table
2. If NOT found → use default DATABASE_URL
3. Set `req.db` to default database pool
4. Use `runWithDb()` to set async context

**Check logs for:**
```
[AuthMiddleware] Normal user detected - Using default DATABASE_URL for org_id: XXX
[NavigationController] Using database: DEFAULT
[JobRoleNavModel] User job roles found: X
```

## Solutions

### Solution 1: Ensure User Has Job Roles

If the user doesn't have job roles assigned:

```sql
-- Assign a job role to the user
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, assigned_on, int_status)
VALUES ('YOUR_USER_ID', 'JR001', 'SYSTEM', CURRENT_DATE, 1);
```

### Solution 2: Ensure Navigation Items Exist

If `tblJobRoleNav` is empty, you need to populate it. Check the setup wizard or run:

```sql
-- Example: Add navigation items for System Administrator (JR001)
INSERT INTO "tblJobRoleNav" (job_role_nav_id, job_role_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status)
VALUES 
('JRN001', 'JR001', 'DASHBOARD', 'Dashboard', FALSE, 1, 'A', 'D', 1),
('JRN002', 'JR001', 'ASSETS', 'Assets', FALSE, 2, 'A', 'D', 1);
-- ... add more as needed
```

### Solution 3: Ensure Data Exists for User's org_id

If screens are empty, check if data exists for the user's `org_id`:

```sql
-- Check what org_id the user has
SELECT user_id, org_id FROM "tblUsers" WHERE user_id = 'YOUR_USER_ID';

-- Then check if data exists for that org_id
SELECT COUNT(*) FROM "tblAssets" WHERE org_id = (SELECT org_id FROM "tblUsers" WHERE user_id = 'YOUR_USER_ID');
```

### Solution 4: Verify Database Context

Check the server logs when logging in. You should see:
- `[AuthMiddleware] Normal user detected - Using default DATABASE_URL`
- `[NavigationController] Using database: DEFAULT`
- `[JobRoleNavModel] User job roles found: X`

If you see errors or the database context is not being set, check:
1. The middleware is running (`protect` middleware)
2. The token contains `org_id`
3. The `tenants` table lookup is working correctly

## Testing

1. **Test Navigation:**
   ```bash
   # After login, check the navigation API
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/navigation/user
   ```

2. **Test Assets:**
   ```bash
   # Check if assets are returned
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/assets
   ```

3. **Check Server Logs:**
   Look for the debug messages added to see what's happening.

## Key Points

1. **Navigation doesn't filter by org_id** - it should work if user has job roles
2. **Screen data filters by org_id** - ensure data exists for user's org_id
3. **Database context must be set** - middleware uses `runWithDb()` to set context
4. **Default database must have data** - ensure tables are populated

