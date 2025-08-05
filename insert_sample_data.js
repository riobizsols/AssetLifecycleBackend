const db = require('./config/db');

async function insertSampleData() {
    try {
        console.log('Inserting sample navigation data...');

        // Sample navigation data for JR001 (System Administrator)
        const navigationData = [
            // Top level items
            { job_role_nav_id: 'JRN001', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'DASHBOARD', label: 'Dashboard', sequence: 1, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN002', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'ASSETS', label: 'Assets', sequence: 2, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN003', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'ASSETASSIGNMENT', label: 'Asset Assignment', sequence: 3, is_group: true, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN004', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'MAINTENANCE', label: 'Maintenance', sequence: 4, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN005', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'MAINTENANCEAPPROVAL', label: 'Maintenance Approval', sequence: 5, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN006', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'SUPERVISORAPPROVAL', label: 'Supervisor Approval', sequence: 6, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN007', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'REPORTS', label: 'Reports', sequence: 7, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN008', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'ADMINSETTINGS', label: 'Admin Settings', sequence: 8, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN009', org_id: 'ORG001', job_role_id: 'JR001', app_id: 'MASTERDATA', label: 'Master Data', sequence: 9, is_group: true, access_level: 'A', mob_desk: 'D' },

            // Child items under Asset Assignment
            { job_role_nav_id: 'JRN010', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN003', app_id: 'DEPTASSIGNMENT', label: 'Department Assignment', sequence: 1, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN011', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN003', app_id: 'EMPASSIGNMENT', label: 'Employee Assignment', sequence: 2, is_group: false, access_level: 'A', mob_desk: 'D' },

            // Child items under Master Data
            { job_role_nav_id: 'JRN012', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ORGANIZATIONS', label: 'Organizations', sequence: 1, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN013', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ASSETTYPES', label: 'Asset Types', sequence: 2, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN014', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTS', label: 'Departments', sequence: 3, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN015', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTSADMIN', label: 'Departments Admin', sequence: 4, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN016', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTSASSET', label: 'Departments Asset', sequence: 5, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN017', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'BRANCHES', label: 'Branches', sequence: 6, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN018', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'VENDORS', label: 'Vendors', sequence: 7, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN019', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'PRODSERV', label: 'Products/Services', sequence: 8, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN020', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ROLES', label: 'Roles', sequence: 9, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN021', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'USERS', label: 'Users', sequence: 10, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN022', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'MAINTENANCESCHEDULE', label: 'Maintenance Schedule', sequence: 11, is_group: false, access_level: 'A', mob_desk: 'D' },
            { job_role_nav_id: 'JRN023', org_id: 'ORG001', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'AUDITLOGS', label: 'Audit Logs', sequence: 12, is_group: false, access_level: 'A', mob_desk: 'D' }
        ];

        for (const item of navigationData) {
            await db.query(`
                INSERT INTO "tblJobRoleNav" 
                (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, sequence, is_group, access_level, mob_desk)
                VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (job_role_nav_id) DO UPDATE SET
                    org_id = EXCLUDED.org_id,
                    int_status = 1,
                    job_role_id = EXCLUDED.job_role_id,
                    parent_id = EXCLUDED.parent_id,
                    app_id = EXCLUDED.app_id,
                    label = EXCLUDED.label,
                    sequence = EXCLUDED.sequence,
                    is_group = EXCLUDED.is_group,
                    access_level = EXCLUDED.access_level,
                    mob_desk = EXCLUDED.mob_desk
            `, [item.job_role_nav_id, item.org_id, item.job_role_id, item.parent_id, item.app_id, item.label, item.sequence, item.is_group, item.access_level, item.mob_desk]);
        }
        console.log('✅ Sample navigation data inserted');

        // Verify the data
        const navigationItems = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav" WHERE job_role_id = \'JR001\' AND int_status = 1');
        console.log(`\n📊 Navigation items for JR001: ${navigationItems.rows[0].count}`);

        console.log('\n🎉 Sample data inserted successfully!');
        console.log('You can now test the navigation system.');

    } catch (error) {
        console.error('❌ Error inserting sample data:', error);
    } finally {
        process.exit(0);
    }
}

insertSampleData(); 