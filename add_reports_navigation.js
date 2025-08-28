const db = require('./config/db');

async function addReportsNavigation() {
    try {
        console.log('Adding Reports dropdown and all report navigation items...');

        // Navigation data for different job roles
        const navigationData = [
            // JR001 (System Administrator) - Reports dropdown
            {
                job_role_nav_id: 'JRN030',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: null,
                app_id: 'REPORTS',
                label: 'Reports',
                sub_menu: null,
                sequence: 7,
                is_group: true,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Asset Lifecycle Report
            {
                job_role_nav_id: 'JRN031',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'ASSETLIFECYCLEREPORT',
                label: 'Asset Lifecycle Report',
                sub_menu: null,
                sequence: 1,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Asset Report
            {
                job_role_nav_id: 'JRN032',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'ASSETREPORT',
                label: 'Asset Report',
                sub_menu: null,
                sequence: 2,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Maintenance History of Asset
            {
                job_role_nav_id: 'JRN033',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'MAINTENANCEHISTORY',
                label: 'Maintenance History of Asset',
                sub_menu: null,
                sequence: 3,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Asset Valuation
            {
                job_role_nav_id: 'JRN034',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'ASSETVALUATION',
                label: 'Asset Valuation',
                sub_menu: null,
                sequence: 4,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Asset Workflow History
            {
                job_role_nav_id: 'JRN035',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'ASSETWORKFLOWHISTORY',
                label: 'Asset Workflow History',
                sub_menu: null,
                sequence: 5,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Report History
            {
                job_role_nav_id: 'JRN036',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'REPORTHISTORY',
                label: 'Report History',
                sub_menu: null,
                sequence: 6,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR001 (System Administrator) - Breakdown History
            {
                job_role_nav_id: 'JRN037',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR001',
                parent_id: 'JRN030',
                app_id: 'BREAKDOWNHISTORY',
                label: 'Breakdown History',
                sub_menu: null,
                sequence: 7,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },

            // JR002 (Department Manager) - Reports dropdown
            {
                job_role_nav_id: 'JRN040',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: null,
                app_id: 'REPORTS',
                label: 'Reports',
                sub_menu: null,
                sequence: 6,
                is_group: true,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR002 (Department Manager) - Asset Lifecycle Report
            {
                job_role_nav_id: 'JRN041',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'ASSETLIFECYCLEREPORT',
                label: 'Asset Lifecycle Report',
                sub_menu: null,
                sequence: 1,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Asset Report
            {
                job_role_nav_id: 'JRN042',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'ASSETREPORT',
                label: 'Asset Report',
                sub_menu: null,
                sequence: 2,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Maintenance History of Asset
            {
                job_role_nav_id: 'JRN043',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'MAINTENANCEHISTORY',
                label: 'Maintenance History of Asset',
                sub_menu: null,
                sequence: 3,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Asset Valuation
            {
                job_role_nav_id: 'JRN044',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'ASSETVALUATION',
                label: 'Asset Valuation',
                sub_menu: null,
                sequence: 4,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Asset Workflow History
            {
                job_role_nav_id: 'JRN045',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'ASSETWORKFLOWHISTORY',
                label: 'Asset Workflow History',
                sub_menu: null,
                sequence: 5,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Report History
            {
                job_role_nav_id: 'JRN046',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'REPORTHISTORY',
                label: 'Report History',
                sub_menu: null,
                sequence: 6,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR002 (Department Manager) - Breakdown History
            {
                job_role_nav_id: 'JRN047',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR002',
                parent_id: 'JRN040',
                app_id: 'BREAKDOWNHISTORY',
                label: 'Breakdown History',
                sub_menu: null,
                sequence: 7,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },

            // JR003 (Asset Manager) - Reports dropdown
            {
                job_role_nav_id: 'JRN050',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: null,
                app_id: 'REPORTS',
                label: 'Reports',
                sub_menu: null,
                sequence: 5,
                is_group: true,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Asset Lifecycle Report
            {
                job_role_nav_id: 'JRN051',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'ASSETLIFECYCLEREPORT',
                label: 'Asset Lifecycle Report',
                sub_menu: null,
                sequence: 1,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Asset Report
            {
                job_role_nav_id: 'JRN052',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'ASSETREPORT',
                label: 'Asset Report',
                sub_menu: null,
                sequence: 2,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Maintenance History of Asset
            {
                job_role_nav_id: 'JRN053',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'MAINTENANCEHISTORY',
                label: 'Maintenance History of Asset',
                sub_menu: null,
                sequence: 3,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Asset Valuation
            {
                job_role_nav_id: 'JRN054',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'ASSETVALUATION',
                label: 'Asset Valuation',
                sub_menu: null,
                sequence: 4,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Asset Workflow History
            {
                job_role_nav_id: 'JRN055',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'ASSETWORKFLOWHISTORY',
                label: 'Asset Workflow History',
                sub_menu: null,
                sequence: 5,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Report History
            {
                job_role_nav_id: 'JRN056',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'REPORTHISTORY',
                label: 'Report History',
                sub_menu: null,
                sequence: 6,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR003 (Asset Manager) - Breakdown History
            {
                job_role_nav_id: 'JRN057',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR003',
                parent_id: 'JRN050',
                app_id: 'BREAKDOWNHISTORY',
                label: 'Breakdown History',
                sub_menu: null,
                sequence: 7,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },

            // JR004 (Maintenance Supervisor) - Reports dropdown
            {
                job_role_nav_id: 'JRN060',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: null,
                app_id: 'REPORTS',
                label: 'Reports',
                sub_menu: null,
                sequence: 4,
                is_group: true,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR004 (Maintenance Supervisor) - Asset Lifecycle Report
            {
                job_role_nav_id: 'JRN061',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'ASSETLIFECYCLEREPORT',
                label: 'Asset Lifecycle Report',
                sub_menu: null,
                sequence: 1,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR004 (Maintenance Supervisor) - Asset Report
            {
                job_role_nav_id: 'JRN062',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'ASSETREPORT',
                label: 'Asset Report',
                sub_menu: null,
                sequence: 2,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR004 (Maintenance Supervisor) - Maintenance History of Asset
            {
                job_role_nav_id: 'JRN063',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'MAINTENANCEHISTORY',
                label: 'Maintenance History of Asset',
                sub_menu: null,
                sequence: 3,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },
            // JR004 (Maintenance Supervisor) - Asset Valuation
            {
                job_role_nav_id: 'JRN064',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'ASSETVALUATION',
                label: 'Asset Valuation',
                sub_menu: null,
                sequence: 4,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR004 (Maintenance Supervisor) - Asset Workflow History
            {
                job_role_nav_id: 'JRN065',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'ASSETWORKFLOWHISTORY',
                label: 'Asset Workflow History',
                sub_menu: null,
                sequence: 5,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR004 (Maintenance Supervisor) - Report History
            {
                job_role_nav_id: 'JRN066',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'REPORTHISTORY',
                label: 'Report History',
                sub_menu: null,
                sequence: 6,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR004 (Maintenance Supervisor) - Breakdown History
            {
                job_role_nav_id: 'JRN067',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR004',
                parent_id: 'JRN060',
                app_id: 'BREAKDOWNHISTORY',
                label: 'Breakdown History',
                sub_menu: null,
                sequence: 7,
                is_group: false,
                mob_desk: 'D',
                access_level: 'A'
            },

            // JR005 (View Only User) - Reports dropdown
            {
                job_role_nav_id: 'JRN070',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: null,
                app_id: 'REPORTS',
                label: 'Reports',
                sub_menu: null,
                sequence: 3,
                is_group: true,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Asset Lifecycle Report
            {
                job_role_nav_id: 'JRN071',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'ASSETLIFECYCLEREPORT',
                label: 'Asset Lifecycle Report',
                sub_menu: null,
                sequence: 1,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Asset Report
            {
                job_role_nav_id: 'JRN072',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'ASSETREPORT',
                label: 'Asset Report',
                sub_menu: null,
                sequence: 2,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Maintenance History of Asset
            {
                job_role_nav_id: 'JRN073',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'MAINTENANCEHISTORY',
                label: 'Maintenance History of Asset',
                sub_menu: null,
                sequence: 3,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Asset Valuation
            {
                job_role_nav_id: 'JRN074',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'ASSETVALUATION',
                label: 'Asset Valuation',
                sub_menu: null,
                sequence: 4,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Asset Workflow History
            {
                job_role_nav_id: 'JRN075',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'ASSETWORKFLOWHISTORY',
                label: 'Asset Workflow History',
                sub_menu: null,
                sequence: 5,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Report History
            {
                job_role_nav_id: 'JRN076',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'REPORTHISTORY',
                label: 'Report History',
                sub_menu: null,
                sequence: 6,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            },
            // JR005 (View Only User) - Breakdown History
            {
                job_role_nav_id: 'JRN077',
                org_id: 'ORG001',
                int_status: 1,
                job_role_id: 'JR005',
                parent_id: 'JRN070',
                app_id: 'BREAKDOWNHISTORY',
                label: 'Breakdown History',
                sub_menu: null,
                sequence: 7,
                is_group: false,
                mob_desk: 'D',
                access_level: 'D'
            }
        ];

        // Insert each navigation item
        for (const item of navigationData) {
            try {
                await db.query(`
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
                        is_group,
                        mob_desk,
                        access_level
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (job_role_nav_id) DO UPDATE SET
                        org_id = EXCLUDED.org_id,
                        int_status = EXCLUDED.int_status,
                        job_role_id = EXCLUDED.job_role_id,
                        parent_id = EXCLUDED.parent_id,
                        app_id = EXCLUDED.app_id,
                        label = EXCLUDED.label,
                        sub_menu = EXCLUDED.sub_menu,
                        sequence = EXCLUDED.sequence,
                        is_group = EXCLUDED.is_group,
                        mob_desk = EXCLUDED.mob_desk,
                        access_level = EXCLUDED.access_level
                `, [
                    item.job_role_nav_id,
                    item.org_id,
                    item.int_status,
                    item.job_role_id,
                    item.parent_id,
                    item.app_id,
                    item.label,
                    item.sub_menu,
                    item.sequence,
                    item.is_group,
                    item.mob_desk,
                    item.access_level
                ]);
                console.log(`✅ Added navigation item: ${item.label} for ${item.job_role_id}`);
            } catch (error) {
                console.error(`❌ Error adding navigation item ${item.job_role_nav_id}:`, error.message);
            }
        }

        // Verify the insertions
        console.log('\n📋 Verifying navigation items...');
        const result = await db.query(`
            SELECT 
                job_role_nav_id, 
                job_role_id, 
                parent_id, 
                app_id, 
                label, 
                is_group, 
                sequence, 
                access_level
            FROM "tblJobRoleNav" 
            WHERE app_id IN ('REPORTS', 'ASSETLIFECYCLEREPORT', 'ASSETREPORT', 'MAINTENANCEHISTORY', 'ASSETVALUATION', 'ASSETWORKFLOWHISTORY', 'REPORTHISTORY', 'BREAKDOWNHISTORY')
            ORDER BY job_role_id, sequence, job_role_nav_id
        `);

        console.log('\n📊 Navigation items added:');
        result.rows.forEach(row => {
            const type = row.is_group ? 'GROUP' : 'ITEM';
            const parent = row.parent_id ? `(Parent: ${row.parent_id})` : '(Top Level)';
            console.log(`  - ${row.label} [${type}] ${parent} (${row.job_role_id}) - Access: ${row.access_level}`);
        });

        console.log('\n✅ Reports navigation setup completed successfully!');
        console.log('\n📝 Summary:');
        console.log('  - Added "Reports" dropdown for all job roles');
        console.log('  - Added 7 report items under Reports:');
        console.log('    1. Asset Lifecycle Report');
        console.log('    2. Asset Report');
        console.log('    3. Maintenance History of Asset');
        console.log('    4. Asset Valuation');
        console.log('    5. Asset Workflow History');
        console.log('    6. Report History');
        console.log('    7. Breakdown History');
        console.log('  - JR001, JR003: Full access (A)');
        console.log('  - JR002, JR004, JR005: Read-only access (D)');
        console.log('  - JR004: Special access to Maintenance History and Breakdown History (A)');

    } catch (error) {
        console.error('❌ Error setting up Reports navigation:', error);
    } finally {
        await db.end();
    }
}

// Run the script
addReportsNavigation();
