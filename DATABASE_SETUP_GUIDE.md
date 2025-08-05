# Database Setup Guide for Permission System

## Overview

This guide will help you set up the database tables required for the database-driven permission system. The system uses two main tables: `tblUserJobRoles` and `tblJobRoleNav`.

## Database Tables

### 1. tblUserJobRoles Table

This table links users to their job roles:

```sql
CREATE TABLE "tblUserJobRoles" (
    user_id VARCHAR PRIMARY KEY,
    job_role_id VARCHAR NOT NULL,
    assigned_by VARCHAR,
    assigned_on DATE DEFAULT CURRENT_DATE,
    updated_by VARCHAR,
    updated_on DATE,
    int_status INTEGER DEFAULT 1
);
```

### 2. tblJobRoleNav Table

This table defines navigation items and permissions for each job role:

```sql
CREATE TABLE "tblJobRoleNav" (
    id VARCHAR PRIMARY KEY,
    int_status INTEGER DEFAULT 1,
    job_role_id VARCHAR NOT NULL,
    parent_id VARCHAR,
    app_id VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    seq INTEGER DEFAULT 10,
    access_level CHAR(1), -- 'A' for full access, 'D' for read-only, NULL for no access
    mobile_desktop CHAR(1) DEFAULT 'D'
);
```

## Sample Data

### Insert Job Roles (if not already exists)

```sql
INSERT INTO "tblJobRoles" (job_role_id, text, job_function, int_status) VALUES
('JR001', 'System Administrator', 'Full system access', 1),
('JR002', 'Department Manager', 'Department level access', 1),
('JR003', 'Asset Manager', 'Asset management access', 1),
('JR004', 'Maintenance Supervisor', 'Maintenance access', 1),
('JR005', 'View Only User', 'Read-only access', 1);
```

### Sample Navigation Data for JR001 (System Administrator)

```sql
-- Top level items
INSERT INTO "tblJobRoleNav" (id, job_role_id, app_id, label, is_group, seq, access_level) VALUES
('JRN001', 'JR001', 'DASHBOARD', 'Dashboard', FALSE, 1, 'A'),
('JRN002', 'JR001', 'ASSETS', 'Assets', FALSE, 2, 'A'),
('JRN003', 'JR001', 'ASSETASSIGNMENT', 'Asset Assignment', TRUE, 3, 'A'),
('JRN004', 'JR001', 'MAINTENANCE', 'Maintenance', FALSE, 4, 'A'),
('JRN005', 'JR001', 'MAINTENANCEAPPROVAL', 'Maintenance Approval', FALSE, 5, 'A'),
('JRN006', 'JR001', 'SUPERVISORAPPROVAL', 'Supervisor Approval', FALSE, 6, 'A'),
('JRN007', 'JR001', 'REPORTS', 'Reports', FALSE, 7, 'A'),
('JRN008', 'JR001', 'ADMINSETTINGS', 'Admin Settings', FALSE, 8, 'A'),
('JRN009', 'JR001', 'MASTERDATA', 'Master Data', TRUE, 9, 'A');

-- Child items under Asset Assignment
INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level) VALUES
('JRN010', 'JR001', 'JRN003', 'DEPTASSIGNMENT', 'Department Assignment', FALSE, 1, 'A'),
('JRN011', 'JR001', 'JRN003', 'EMPASSIGNMENT', 'Employee Assignment', FALSE, 2, 'A');

-- Child items under Master Data
INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level) VALUES
('JRN012', 'JR001', 'JRN009', 'ORGANIZATIONS', 'Organizations', FALSE, 1, 'A'),
('JRN013', 'JR001', 'JRN009', 'ASSETTYPES', 'Asset Types', FALSE, 2, 'A'),
('JRN014', 'JR001', 'JRN009', 'DEPARTMENTS', 'Departments', FALSE, 3, 'A'),
('JRN015', 'JR001', 'JRN009', 'DEPARTMENTSADMIN', 'Departments Admin', FALSE, 4, 'A'),
('JRN016', 'JR001', 'JRN009', 'DEPARTMENTSASSET', 'Departments Asset', FALSE, 5, 'A'),
('JRN017', 'JR001', 'JRN009', 'BRANCHES', 'Branches', FALSE, 6, 'A'),
('JRN018', 'JR001', 'JRN009', 'VENDORS', 'Vendors', FALSE, 7, 'A'),
('JRN019', 'JR001', 'JRN009', 'PRODSERV', 'Products/Services', FALSE, 8, 'A'),
('JRN020', 'JR001', 'JRN009', 'ROLES', 'Roles', FALSE, 9, 'A'),
('JRN021', 'JR001', 'JRN009', 'USERS', 'Users', FALSE, 10, 'A'),
('JRN022', 'JR001', 'JRN009', 'MAINTENANCESCHEDULE', 'Maintenance Schedule', FALSE, 11, 'A'),
('JRN023', 'JR001', 'JRN009', 'AUDITLOGS', 'Audit Logs', FALSE, 12, 'A');
```

### Sample Navigation Data for JR002 (Department Manager)

```sql
-- Top level items with limited access
INSERT INTO "tblJobRoleNav" (id, job_role_id, app_id, label, is_group, seq, access_level) VALUES
('JRN101', 'JR002', 'DASHBOARD', 'Dashboard', FALSE, 1, 'A'),
('JRN102', 'JR002', 'ASSETS', 'Assets', FALSE, 2, 'D'),
('JRN103', 'JR002', 'ASSETASSIGNMENT', 'Asset Assignment', TRUE, 3, 'A'),
('JRN104', 'JR002', 'MAINTENANCE', 'Maintenance', FALSE, 4, 'D'),
('JRN105', 'JR002', 'MAINTENANCEAPPROVAL', 'Maintenance Approval', FALSE, 5, 'A'),
('JRN106', 'JR002', 'REPORTS', 'Reports', FALSE, 6, 'D'),
('JRN107', 'JR002', 'MASTERDATA', 'Master Data', TRUE, 7, 'D');

-- Child items under Asset Assignment
INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level) VALUES
('JRN110', 'JR002', 'JRN103', 'DEPTASSIGNMENT', 'Department Assignment', FALSE, 1, 'A'),
('JRN111', 'JR002', 'JRN103', 'EMPASSIGNMENT', 'Employee Assignment', FALSE, 2, 'A');

-- Child items under Master Data (read-only)
INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level) VALUES
('JRN112', 'JR002', 'JRN107', 'ORGANIZATIONS', 'Organizations', FALSE, 1, 'D'),
('JRN113', 'JR002', 'JRN107', 'ASSETTYPES', 'Asset Types', FALSE, 2, 'D'),
('JRN114', 'JR002', 'JRN107', 'DEPARTMENTS', 'Departments', FALSE, 3, 'D'),
('JRN115', 'JR002', 'JRN107', 'BRANCHES', 'Branches', FALSE, 4, 'D'),
('JRN116', 'JR002', 'JRN107', 'VENDORS', 'Vendors', FALSE, 5, 'D');
```

### Assign Users to Job Roles

```sql
-- Assign user USR001 to System Administrator role
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, int_status) VALUES
('USR001', 'JR001', 'USR001', 1);

-- Assign user USR002 to Department Manager role
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, int_status) VALUES
('USR002', 'JR002', 'USR001', 1);
```

## Access Levels Explained

- **A (Authorized)**: Full access - can view and edit
- **D (Display)**: Read-only access - can view only
- **NULL**: No access - item is hidden

## App ID Mapping

The system maps these app IDs to frontend routes:

| App ID | Route | Description |
|--------|-------|-------------|
| DASHBOARD | /dashboard | Dashboard page |
| ASSETS | /assets | Assets management |
| ASSETASSIGNMENT | /assign-department-assets | Asset assignment (group) |
| DEPTASSIGNMENT | /assign-department-assets | Department asset assignment |
| EMPASSIGNMENT | /assign-employee-assets | Employee asset assignment |
| MAINTENANCE | /maintenance | Maintenance management |
| MAINTENANCEAPPROVAL | /maintenance-approval | Maintenance approval |
| SUPERVISORAPPROVAL | /supervisor-approval | Supervisor approval |
| REPORTS | /reports | Reports |
| ADMINSETTINGS | /admin-settings | Admin settings |
| MASTERDATA | /master-data | Master data (group) |
| ORGANIZATIONS | /master-data/organizations | Organizations |
| ASSETTYPES | /master-data/asset-types | Asset types |
| DEPARTMENTS | /master-data/departments | Departments |
| DEPARTMENTSADMIN | /master-data/departments-admin | Departments admin |
| DEPARTMENTSASSET | /master-data/departments-asset | Departments asset |
| BRANCHES | /master-data/branches | Branches |
| VENDORS | /master-data/vendors | Vendors |
| PRODSERV | /master-data/prod-serv | Products/Services |
| ROLES | /master-data/roles | Roles |
| USERS | /master-data/users | Users |
| MAINTENANCESCHEDULE | /master-data/maintenance-schedule | Maintenance schedule |
| AUDITLOGS | /master-data/audit-logs | Audit logs |

## Testing the System

1. **Start the backend server**:
   ```bash
   cd AssetLifecycleManagementBackend
   npm start
   ```

2. **Start the frontend**:
   ```bash
   cd AssetLifecycleManagementFrontend
   npm run dev
   ```

3. **Test with different users**:
   - Login with USR001 (System Administrator) - should see all items with full access
   - Login with USR002 (Department Manager) - should see limited items with read-only access for some features

4. **Check the demo page**:
   - Navigate to `/database-permission-demo` to see the current navigation structure and permissions

## Troubleshooting

### Common Issues

1. **Navigation not loading**: Check if the user has a job role assigned in `tblUserJobRoles`
2. **Items not showing**: Verify that `int_status = 1` for the navigation items
3. **Access level not working**: Ensure `access_level` is set to 'A', 'D', or NULL
4. **API errors**: Check the backend logs for database connection issues

### Debug Queries

```sql
-- Check user's job role
SELECT * FROM "tblUserJobRoles" WHERE user_id = 'USR001';

-- Check navigation for a job role
SELECT * FROM "tblJobRoleNav" WHERE job_role_id = 'JR001' AND int_status = 1 ORDER BY seq;

-- Check navigation structure
SELECT 
    parent.label as parent_label,
    child.label as child_label,
    child.access_level
FROM "tblJobRoleNav" parent
LEFT JOIN "tblJobRoleNav" child ON parent.id = child.parent_id
WHERE parent.job_role_id = 'JR001' AND parent.int_status = 1
ORDER BY parent.seq, child.seq;
```

## Migration from Hardcoded System

The system is now using the database-driven sidebar. The old hardcoded system files can be safely removed:

- `src/components/Sidebar.jsx` (replaced by `DatabaseSidebar.jsx`)
- `src/config/sidebarConfig.js` (no longer needed)

The new system provides:
- Dynamic permission loading from database
- Visual indicators for access levels
- Flexible role-based access control
- Easy permission management through database updates 