const db = require('./config/db');

async function setupAllJobRoles() {
  try {
    console.log('🔧 Setting up access levels for all job roles...\n');
    
    // Clear existing permissions for JR002-JR005 (keep JR001 as is)
    await db.query('DELETE FROM "tblJobRoleNav" WHERE job_role_id IN (\'JR002\', \'JR003\', \'JR004\', \'JR005\')');
    console.log('✅ Cleared existing permissions for JR002-JR005\n');
    
    // Define permissions for each role
    const rolePermissions = {
      // JR002 - Department Manager
      'JR002': [
        { app_id: 'DASHBOARD', label: 'Dashboard', access_level: 'A', sequence: 1 },
        { app_id: 'ASSETS', label: 'Assets', access_level: 'A', sequence: 2 },
        { app_id: 'ASSETASSIGNMENT', label: 'Asset Assignment', access_level: 'A', sequence: 3, is_group: true },
        { app_id: 'DEPTASSIGNMENT', label: 'Department Assignment', access_level: 'A', sequence: 4 },
        { app_id: 'EMPASSIGNMENT', label: 'Employee Assignment', access_level: 'A', sequence: 5 },
        { app_id: 'MAINTENANCE', label: 'Maintenance', access_level: 'A', sequence: 6 },
        { app_id: 'MAINTENANCEAPPROVAL', label: 'Maintenance Approval', access_level: 'A', sequence: 7 },
        { app_id: 'REPORTS', label: 'Reports', access_level: 'A', sequence: 8 },
        { app_id: 'MASTERDATA', label: 'Master Data', access_level: 'D', sequence: 9, is_group: true },
        { app_id: 'ORGANIZATIONS', label: 'Organizations', access_level: 'D', sequence: 10 },
        { app_id: 'ASSETTYPES', label: 'Asset Types', access_level: 'D', sequence: 11 },
        { app_id: 'DEPARTMENTS', label: 'Departments', access_level: 'D', sequence: 12 },
        { app_id: 'BRANCHES', label: 'Branches', access_level: 'D', sequence: 13 },
        { app_id: 'VENDORS', label: 'Vendors', access_level: 'D', sequence: 14 },
        { app_id: 'USERS', label: 'Users', access_level: 'D', sequence: 15 }
      ],
      
      // JR003 - Supervisor
      'JR003': [
        { app_id: 'DASHBOARD', label: 'Dashboard', access_level: 'A', sequence: 1 },
        { app_id: 'ASSETS', label: 'Assets', access_level: 'D', sequence: 2 },
        { app_id: 'ASSETASSIGNMENT', label: 'Asset Assignment', access_level: 'D', sequence: 3, is_group: true },
        { app_id: 'DEPTASSIGNMENT', label: 'Department Assignment', access_level: 'D', sequence: 4 },
        { app_id: 'EMPASSIGNMENT', label: 'Employee Assignment', access_level: 'D', sequence: 5 },
        { app_id: 'MAINTENANCE', label: 'Maintenance', access_level: 'A', sequence: 6 },
        { app_id: 'MAINTENANCEAPPROVAL', label: 'Maintenance Approval', access_level: 'A', sequence: 7 },
        { app_id: 'SUPERVISORAPPROVAL', label: 'Supervisor Approval', access_level: 'A', sequence: 8 },
        { app_id: 'REPORTS', label: 'Reports', access_level: 'A', sequence: 9 },
        { app_id: 'MASTERDATA', label: 'Master Data', access_level: 'D', sequence: 10, is_group: true },
        { app_id: 'ORGANIZATIONS', label: 'Organizations', access_level: 'D', sequence: 11 },
        { app_id: 'ASSETTYPES', label: 'Asset Types', access_level: 'D', sequence: 12 },
        { app_id: 'DEPARTMENTS', label: 'Departments', access_level: 'D', sequence: 13 },
        { app_id: 'BRANCHES', label: 'Branches', access_level: 'D', sequence: 14 },
        { app_id: 'VENDORS', label: 'Vendors', access_level: 'D', sequence: 15 }
      ],
      
      // JR004 - Employee
      'JR004': [
        { app_id: 'DASHBOARD', label: 'Dashboard', access_level: 'A', sequence: 1 },
        { app_id: 'ASSETS', label: 'Assets', access_level: 'D', sequence: 2 },
        { app_id: 'MAINTENANCE', label: 'Maintenance', access_level: 'D', sequence: 3 },
        { app_id: 'REPORTS', label: 'Reports', access_level: 'D', sequence: 4 },
        { app_id: 'MASTERDATA', label: 'Master Data', access_level: 'D', sequence: 5, is_group: true },
        { app_id: 'ORGANIZATIONS', label: 'Organizations', access_level: 'D', sequence: 6 },
        { app_id: 'ASSETTYPES', label: 'Asset Types', access_level: 'D', sequence: 7 },
        { app_id: 'DEPARTMENTS', label: 'Departments', access_level: 'D', sequence: 8 },
        { app_id: 'BRANCHES', label: 'Branches', access_level: 'D', sequence: 9 },
        { app_id: 'VENDORS', label: 'Vendors', access_level: 'D', sequence: 10 }
      ],
      
      // JR005 - Viewer
      'JR005': [
        { app_id: 'DASHBOARD', label: 'Dashboard', access_level: 'A', sequence: 1 },
        { app_id: 'ASSETS', label: 'Assets', access_level: 'D', sequence: 2 },
        { app_id: 'REPORTS', label: 'Reports', access_level: 'D', sequence: 3 },
        { app_id: 'MASTERDATA', label: 'Master Data', access_level: 'D', sequence: 4, is_group: true },
        { app_id: 'ORGANIZATIONS', label: 'Organizations', access_level: 'D', sequence: 5 },
        { app_id: 'ASSETTYPES', label: 'Asset Types', access_level: 'D', sequence: 6 },
        { app_id: 'DEPARTMENTS', label: 'Departments', access_level: 'D', sequence: 7 },
        { app_id: 'BRANCHES', label: 'Branches', access_level: 'D', sequence: 8 },
        { app_id: 'VENDORS', label: 'Vendors', access_level: 'D', sequence: 9 }
      ]
    };
    
    // Insert permissions for each role
    for (const [jobRoleId, permissions] of Object.entries(rolePermissions)) {
      console.log(`📋 Setting up permissions for ${jobRoleId}...`);
      
      for (let i = 0; i < permissions.length; i++) {
        const permission = permissions[i];
        const jobRoleNavId = `JRN${jobRoleId.slice(-3)}${String(i + 1).padStart(2, '0')}`;
        
        await db.query(
          `INSERT INTO "tblJobRoleNav" (
            job_role_nav_id, org_id, int_status, job_role_id, 
            parent_id, app_id, label, sequence, access_level, is_group, mob_desk
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            jobRoleNavId,
            'ORG001',
            1,
            jobRoleId,
            permission.is_group ? null : (permission.app_id === 'DEPTASSIGNMENT' || permission.app_id === 'EMPASSIGNMENT' ? 
              `JRN${jobRoleId.slice(-3)}03` : null),
            permission.app_id,
            permission.label,
            permission.sequence,
            permission.access_level,
            permission.is_group || false,
            'D'
          ]
        );
        
        const accessType = permission.access_level === 'A' ? 'Full Access' : 'Read Only';
        console.log(`   ✅ ${permission.label} - ${accessType}`);
      }
      
      console.log(`✅ Completed ${jobRoleId}\n`);
    }
    
    console.log('🎉 Successfully set up all job role permissions!');
    console.log('\n📊 Summary of Access Levels:');
    console.log('\n🔐 JR001 - System Administrator:');
    console.log('   - Full Access to everything (already configured)');
    
    console.log('\n👨‍💼 JR002 - Department Manager:');
    console.log('   - Full Access: Dashboard, Assets, Asset Assignment, Maintenance, Reports');
    console.log('   - Read Only: Master Data items');
    
    console.log('\n👨‍💻 JR003 - Supervisor:');
    console.log('   - Full Access: Dashboard, Maintenance, Maintenance Approval, Supervisor Approval, Reports');
    console.log('   - Read Only: Assets, Asset Assignment, Master Data items');
    
    console.log('\n👤 JR004 - Employee:');
    console.log('   - Full Access: Dashboard');
    console.log('   - Read Only: Assets, Maintenance, Reports, Master Data items');
    
    console.log('\n👁️ JR005 - Viewer:');
    console.log('   - Full Access: Dashboard');
    console.log('   - Read Only: Assets, Reports, Master Data items');
    
    console.log('\n🔄 Please log out and log back in to see the changes for each user role.');
    
  } catch (error) {
    console.error('❌ Error setting up job role permissions:', error);
  } finally {
    await db.end();
  }
}

setupAllJobRoles(); 