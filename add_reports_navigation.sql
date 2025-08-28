-- Add Reports dropdown and Asset Report navigation items for different job roles
-- This script adds a new "Reports" dropdown with "Asset Report" as a child item

-- First, let's add the Reports dropdown for JR001 (System Administrator)
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN030', 
    'ORG001', 
    1, 
    'JR001', 
    NULL, 
    'REPORTS', 
    'Reports', 
    NULL, 
    7, 
    'A', 
    TRUE, 
    'D'
);

-- Add Asset Report as child of Reports dropdown for JR001
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN031', 
    'ORG001', 
    1, 
    'JR001', 
    'JRN030', 
    'ASSETREPORT', 
    'Asset Report', 
    NULL, 
    1, 
    'A', 
    FALSE, 
    'D'
);

-- Add Reports dropdown for JR002 (Department Manager)
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN032', 
    'ORG001', 
    1, 
    'JR002', 
    NULL, 
    'REPORTS', 
    'Reports', 
    NULL, 
    6, 
    'A', 
    TRUE, 
    'D'
);

-- Add Asset Report as child of Reports dropdown for JR002
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN033', 
    'ORG001', 
    1, 
    'JR002', 
    'JRN032', 
    'ASSETREPORT', 
    'Asset Report', 
    NULL, 
    1, 
    'D', 
    FALSE, 
    'D'
);

-- Add Reports dropdown for JR003 (Asset Manager)
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN034', 
    'ORG001', 
    1, 
    'JR003', 
    NULL, 
    'REPORTS', 
    'Reports', 
    NULL, 
    5, 
    'A', 
    TRUE, 
    'D'
);

-- Add Asset Report as child of Reports dropdown for JR003
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN035', 
    'ORG001', 
    1, 
    'JR003', 
    'JRN034', 
    'ASSETREPORT', 
    'Asset Report', 
    NULL, 
    1, 
    'A', 
    FALSE, 
    'D'
);

-- Add Reports dropdown for JR004 (Maintenance Supervisor)
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN036', 
    'ORG001', 
    1, 
    'JR004', 
    NULL, 
    'REPORTS', 
    'Reports', 
    NULL, 
    4, 
    'A', 
    TRUE, 
    'D'
);

-- Add Asset Report as child of Reports dropdown for JR004
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN037', 
    'ORG001', 
    1, 
    'JR004', 
    'JRN036', 
    'ASSETREPORT', 
    'Asset Report', 
    NULL, 
    1, 
    'D', 
    FALSE, 
    'D'
);

-- Add Reports dropdown for JR005 (View Only User)
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN038', 
    'ORG001', 
    1, 
    'JR005', 
    NULL, 
    'REPORTS', 
    'Reports', 
    NULL, 
    3, 
    'D', 
    TRUE, 
    'D'
);

-- Add Asset Report as child of Reports dropdown for JR005
INSERT INTO "tblJobRoleNav" (
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
) VALUES (
    'JRN039', 
    'ORG001', 
    1, 
    'JR005', 
    'JRN038', 
    'ASSETREPORT', 
    'Asset Report', 
    NULL, 
    1, 
    'D', 
    FALSE, 
    'D'
);

-- Verify the insertions
SELECT 
    job_role_nav_id, 
    org_id, 
    int_status, 
    job_role_id, 
    parent_id, 
    app_id, 
    label, 
    sub_menu, 
    sequence, 
    access_level, 
    is_group, 
    mob_desk
FROM public."tblJobRoleNav" 
WHERE app_id IN ('REPORTS', 'ASSETREPORT')
ORDER BY job_role_id, sequence, job_role_nav_id;
