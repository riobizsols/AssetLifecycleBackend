const db = require('./config/db');

async function setupDatabase() {
    try {
        console.log('Setting up database tables...');

        // 1. Create tblUserJobRoles table
        await db.query(`
            CREATE TABLE IF NOT EXISTS "tblUserJobRoles" (
                user_id VARCHAR PRIMARY KEY,
                job_role_id VARCHAR NOT NULL,
                assigned_by VARCHAR,
                assigned_on DATE DEFAULT CURRENT_DATE,
                updated_by VARCHAR,
                updated_on DATE,
                int_status INTEGER DEFAULT 1
            );
        `);
        console.log('✅ tblUserJobRoles table created');

        // 2. Create tblJobRoleNav table
        await db.query(`
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
        `);
        console.log('✅ tblJobRoleNav table created');

        // 3. Insert sample navigation data for JR001
        const navigationData = [
            // Top level items
            { id: 'JRN001', job_role_id: 'JR001', app_id: 'DASHBOARD', label: 'Dashboard', is_group: false, seq: 1, access_level: 'A' },
            { id: 'JRN002', job_role_id: 'JR001', app_id: 'ASSETS', label: 'Assets', is_group: false, seq: 2, access_level: 'A' },
            { id: 'JRN003', job_role_id: 'JR001', app_id: 'ASSETASSIGNMENT', label: 'Asset Assignment', is_group: true, seq: 3, access_level: 'A' },
            { id: 'JRN004', job_role_id: 'JR001', app_id: 'MAINTENANCE', label: 'Maintenance', is_group: false, seq: 4, access_level: 'A' },
            { id: 'JRN005', job_role_id: 'JR001', app_id: 'MAINTENANCEAPPROVAL', label: 'Maintenance Approval', is_group: false, seq: 5, access_level: 'A' },
            { id: 'JRN006', job_role_id: 'JR001', app_id: 'SUPERVISORAPPROVAL', label: 'Supervisor Approval', is_group: false, seq: 6, access_level: 'A' },
            { id: 'JRN007', job_role_id: 'JR001', app_id: 'REPORTS', label: 'Reports', is_group: false, seq: 7, access_level: 'A' },
            { id: 'JRN008', job_role_id: 'JR001', app_id: 'ADMINSETTINGS', label: 'Admin Settings', is_group: false, seq: 8, access_level: 'A' },
            { id: 'JRN009', job_role_id: 'JR001', app_id: 'MASTERDATA', label: 'Master Data', is_group: true, seq: 9, access_level: 'A' },

            // Child items under Asset Assignment
            { id: 'JRN010', job_role_id: 'JR001', parent_id: 'JRN003', app_id: 'DEPTASSIGNMENT', label: 'Department Assignment', is_group: false, seq: 1, access_level: 'A' },
            { id: 'JRN011', job_role_id: 'JR001', parent_id: 'JRN003', app_id: 'EMPASSIGNMENT', label: 'Employee Assignment', is_group: false, seq: 2, access_level: 'A' },

            // Child items under Master Data
            { id: 'JRN012', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ORGANIZATIONS', label: 'Organizations', is_group: false, seq: 1, access_level: 'A' },
            { id: 'JRN013', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ASSETTYPES', label: 'Asset Types', is_group: false, seq: 2, access_level: 'A' },
            { id: 'JRN014', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTS', label: 'Departments', is_group: false, seq: 3, access_level: 'A' },
            { id: 'JRN015', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTSADMIN', label: 'Departments Admin', is_group: false, seq: 4, access_level: 'A' },
            { id: 'JRN016', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'DEPARTMENTSASSET', label: 'Departments Asset', is_group: false, seq: 5, access_level: 'A' },
            { id: 'JRN017', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'BRANCHES', label: 'Branches', is_group: false, seq: 6, access_level: 'A' },
            { id: 'JRN018', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'VENDORS', label: 'Vendors', is_group: false, seq: 7, access_level: 'A' },
            { id: 'JRN019', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'PRODSERV', label: 'Products/Services', is_group: false, seq: 8, access_level: 'A' },
            { id: 'JRN020', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'ROLES', label: 'Roles', is_group: false, seq: 9, access_level: 'A' },
            { id: 'JRN021', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'USERS', label: 'Users', is_group: false, seq: 10, access_level: 'A' },
            { id: 'JRN022', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'MAINTENANCESCHEDULE', label: 'Maintenance Schedule', is_group: false, seq: 11, access_level: 'A' },
            { id: 'JRN023', job_role_id: 'JR001', parent_id: 'JRN009', app_id: 'AUDITLOGS', label: 'Audit Logs', is_group: false, seq: 12, access_level: 'A' }
        ];

        for (const item of navigationData) {
            await db.query(`
                INSERT INTO "tblJobRoleNav" (id, job_role_id, parent_id, app_id, label, is_group, seq, access_level, int_status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
                ON CONFLICT (id) DO UPDATE SET
                    job_role_id = EXCLUDED.job_role_id,
                    parent_id = EXCLUDED.parent_id,
                    app_id = EXCLUDED.app_id,
                    label = EXCLUDED.label,
                    is_group = EXCLUDED.is_group,
                    seq = EXCLUDED.seq,
                    access_level = EXCLUDED.access_level,
                    int_status = 1
            `, [item.id, item.job_role_id, item.parent_id, item.app_id, item.label, item.is_group, item.seq, item.access_level]);
        }
        console.log('✅ Sample navigation data inserted');

        // 4. Assign user to job role (replace USR001 with your actual user ID)
        await db.query(`
            INSERT INTO "tblUserJobRoles" (user_id, job_role_id, assigned_by, int_status)
            VALUES ('USR001', 'JR001', 'USR001', 1)
            ON CONFLICT (user_id) DO UPDATE SET
                job_role_id = EXCLUDED.job_role_id,
                assigned_by = EXCLUDED.assigned_by,
                assigned_on = CURRENT_DATE,
                int_status = 1
        `);
        console.log('✅ User assigned to job role');

        // 5. Verify the data
        const userJobRoles = await db.query('SELECT * FROM "tblUserJobRoles"');
        const navigationItems = await db.query('SELECT * FROM "tblJobRoleNav" WHERE job_role_id = \'JR001\' AND int_status = 1 ORDER BY seq');

        console.log('\n📊 Database Setup Complete!');
        console.log(`Users with job roles: ${userJobRoles.rows.length}`);
        console.log(`Navigation items for JR001: ${navigationItems.rows.length}`);

        console.log('\n🎉 Database setup completed successfully!');
        console.log('You can now start your frontend and test the navigation system.');

    } catch (error) {
        console.error('❌ Error setting up database:', error);
    } finally {
        process.exit(0);
    }
}

setupDatabase(); 