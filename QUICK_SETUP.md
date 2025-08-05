# Quick Setup Guide for Permission System

## Current Status
✅ **Backend**: Fully implemented and ready  
✅ **Frontend**: Database-driven sidebar is active  
❌ **Database**: Tables need to be created and populated  

## What You Should See Right Now

Since there are no records in `tblJobRoleNav`, your sidebar should show:
- **Empty sidebar** with just the logo
- **Message**: "No navigation items found. Please check your database setup."
- **No navigation links** - URLs would be undefined

## Quick Fix - Set Up Database

### Option 1: Run the SQL Script
1. Open your PostgreSQL database client (pgAdmin, DBeaver, etc.)
2. Run the script: `AssetLifecycleManagementBackend/setup_permission_tables.sql`
3. This will create tables and insert sample data

### Option 2: Manual Setup

#### Step 1: Create Tables
```sql
CREATE TABLE IF NOT EXISTS "tblUserJobRoles" (
    user_id VARCHAR PRIMARY KEY,
    job_role_id VARCHAR NOT NULL,
    assigned_by VARCHAR,
    assigned_on DATE DEFAULT CURRENT_DATE,
    updated_by VARCHAR,
    updated_on DATE,
    int_status INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "tblJobRoleNav" (
    id VARCHAR PRIMARY KEY,
    int_status INTEGER DEFAULT 1,
    job_role_id VARCHAR NOT NULL,
    parent_id VARCHAR,
    app_id VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    seq INTEGER DEFAULT 10,
    access_level CHAR(1),
    mobile_desktop CHAR(1) DEFAULT 'D'
);
```

#### Step 2: Insert Sample Data
```sql
-- Insert a few test navigation items
INSERT INTO "tblJobRoleNav" (id, job_role_id, app_id, label, is_group, seq, access_level) VALUES
('JRN001', 'JR001', 'DASHBOARD', 'Dashboard', FALSE, 1, 'A'),
('JRN002', 'JR001', 'ASSETS', 'Assets', FALSE, 2, 'A'),
('JRN003', 'JR001', 'MASTERDATA', 'Master Data', TRUE, 3, 'A');

-- Child items under Master Data
INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level) VALUES
('JRN004', 'JR001', 'JRN003', 'VENDORS', 'Vendors', FALSE, 1, 'A'),
('JRN005', 'JR001', 'JRN003', 'USERS', 'Users', FALSE, 2, 'A');
```

#### Step 3: Assign Your User to a Job Role
```sql
-- Replace 'USR001' with your actual user ID
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, int_status) VALUES
('USR001', 'JR001', 'USR001', 1)
ON CONFLICT (user_id) DO UPDATE SET 
    job_role_id = EXCLUDED.job_role_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_on = CURRENT_DATE,
    int_status = 1;
```

## Test the System

1. **Start your backend**:
   ```bash
   cd AssetLifecycleManagementBackend
   npm start
   ```

2. **Start your frontend**:
   ```bash
   cd AssetLifecycleManagementFrontend
   npm run dev
   ```

3. **Login and check**:
   - You should now see navigation items in the sidebar
   - Each item should have colored borders (green for full access, yellow for read-only)
   - Click on items to navigate

4. **Test the demo page**:
   - Navigate to `/database-permission-demo`
   - You should see the navigation structure and permissions

## Troubleshooting

### If sidebar is still empty:
1. Check if your user has a job role assigned:
   ```sql
   SELECT * FROM "tblUserJobRoles" WHERE user_id = 'YOUR_USER_ID';
   ```

2. Check if there are navigation items for your job role:
   ```sql
   SELECT * FROM "tblJobRoleNav" WHERE job_role_id = 'JR001' AND int_status = 1;
   ```

3. Check the browser console for API errors

### If you see API errors:
1. Check if the backend is running
2. Check if the database connection is working
3. Verify the API endpoint: `GET /api/navigation/user/navigation`

## Expected Results

After setup, you should see:
- ✅ **Dashboard** (green border - full access)
- ✅ **Assets** (green border - full access)  
- ✅ **Master Data** (dropdown with children)
  - **Vendors** (green border - full access)
  - **Users** (green border - full access)

The system is now fully database-driven! 🎉 