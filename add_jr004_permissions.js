const db = require('./config/db');

async function addJR004Permissions() {
  try {
    console.log('🔧 Adding navigation permissions for Job Role JR004...\n');
    
    // Basic permissions for JR004
    const permissions = [
      {
        job_role_nav_id: 'JRN024',
        org_id: 'ORG001',
        int_status: 1,
        job_role_id: 'JR004',
        parent_id: null,
        app_id: 'DASHBOARD',
        label: 'Dashboard',
        sequence: 1,
        access_level: 'A',
        is_group: false,
        mob_desk: 'D'
      },
      {
        job_role_nav_id: 'JRN025',
        org_id: 'ORG001',
        int_status: 1,
        job_role_id: 'JR004',
        parent_id: null,
        app_id: 'ASSETS',
        label: 'Assets',
        sequence: 2,
        access_level: 'D',
        is_group: false,
        mob_desk: 'D'
      },
      {
        job_role_nav_id: 'JRN026',
        org_id: 'ORG001',
        int_status: 1,
        job_role_id: 'JR004',
        parent_id: null,
        app_id: 'REPORTS',
        label: 'Reports',
        sequence: 3,
        access_level: 'A',
        is_group: false,
        mob_desk: 'D'
      }
    ];
    
    // Insert permissions
    for (const permission of permissions) {
      await db.query(
        `INSERT INTO "tblJobRoleNav" (
          job_role_nav_id, org_id, int_status, job_role_id, 
          parent_id, app_id, label, sequence, access_level, is_group, mob_desk
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          permission.job_role_nav_id,
          permission.org_id,
          permission.int_status,
          permission.job_role_id,
          permission.parent_id,
          permission.app_id,
          permission.label,
          permission.sequence,
          permission.access_level,
          permission.is_group,
          permission.mob_desk
        ]
      );
      
      console.log(`✅ Added: ${permission.label} (${permission.app_id}) - Access: ${permission.access_level}`);
    }
    
    console.log('\n🎉 Successfully added permissions for JR004!');
    console.log('\n📋 JR004 users will now see:');
    console.log('   - Dashboard (Full Access)');
    console.log('   - Assets (Read Only)');
    console.log('   - Reports (Full Access)');
    
    console.log('\n🔄 Please log out and log back in as USR002 to see the changes.');
    
  } catch (error) {
    console.error('❌ Error adding JR004 permissions:', error);
  } finally {
    await db.end();
  }
}

addJR004Permissions(); 