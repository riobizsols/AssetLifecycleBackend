-- Setup Script for Permission System Tables
-- Run this script in your PostgreSQL database

-- 1. Create the tables
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
    access_level CHAR(1), -- 'A' for full access, 'D' for read-only, NULL for no access
    mobile_desktop CHAR(1) DEFAULT 'D'
);

-- 2. Insert Job Roles (if not already exists)
INSERT INTO "tblJobRoles" (job_role_id, text, job_function, int_status) VALUES
('JR001', 'System Administrator', 'Full system access', 1),
('JR002', 'Department Manager', 'Department level access', 1),
('JR003', 'Asset Manager', 'Asset management access', 1),
('JR004', 'Maintenance Supervisor', 'Maintenance access', 1),
('JR005', 'View Only User', 'Read-only access', 1)
ON CONFLICT (job_role_id) DO NOTHING;

-- 3. Sample Navigation Data for JR001 (System Administrator)
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

-- 4. Sample Navigation Data for JR002 (Department Manager)
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

-- 5. Assign Users to Job Roles (replace USR001 with your actual user ID)
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, int_status) VALUES
('USR001', 'JR001', 'USR001', 1)
ON CONFLICT (user_id) DO UPDATE SET 
    job_role_id = EXCLUDED.job_role_id,
    assigned_by = EXCLUDED.assigned_by,
    assigned_on = CURRENT_DATE,
    int_status = 1;

-- 6. Verify the data
SELECT 'User Job Roles:' as info;
SELECT * FROM "tblUserJobRoles";

SELECT 'Navigation Items for JR001:' as info;
SELECT * FROM "tblJobRoleNav" WHERE job_role_id = 'JR001' AND int_status = 1 ORDER BY seq;

SELECT 'Navigation Items for JR002:' as info;
SELECT * FROM "tblJobRoleNav" WHERE job_role_id = 'JR002' AND int_status = 1 ORDER BY seq; 