const db = require('./config/db');

async function checkNavigation() {
    try {
        console.log('🔍 Checking navigation data...\n');
        
        // Check total navigation items
        const totalResult = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav"');
        console.log(`📊 Total navigation items: ${totalResult.rows[0].count}`);
        
        // Check active navigation items
        const activeResult = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav" WHERE int_status = 1');
        console.log(`✅ Active navigation items: ${activeResult.rows[0].count}`);
        
        // Check by platform
        const desktopResult = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav" WHERE int_status = 1 AND mob_desk = \'D\'');
        console.log(`🖥️  Desktop navigation items: ${desktopResult.rows[0].count}`);
        
        const mobileResult = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav" WHERE int_status = 1 AND mob_desk = \'M\'');
        console.log(`📱 Mobile navigation items: ${mobileResult.rows[0].count}`);
        
        // Check job roles
        const jobRolesResult = await db.query('SELECT DISTINCT job_role_id FROM "tblJobRoleNav" WHERE int_status = 1');
        console.log(`👥 Job roles with navigation: ${jobRolesResult.rows.length}`);
        
        if (jobRolesResult.rows.length > 0) {
            console.log('Job role IDs:', jobRolesResult.rows.map(row => row.job_role_id).join(', '));
        }
        
        // Check user job roles
        const userJobRolesResult = await db.query('SELECT COUNT(*) as count FROM "tblUserJobRoles"');
        console.log(`👤 Users with job roles: ${userJobRolesResult.rows[0].count}`);
        
        // Sample navigation items
        const sampleResult = await db.query('SELECT job_role_id, app_id, label, mob_desk, int_status FROM "tblJobRoleNav" LIMIT 5');
        console.log('\n📋 Sample navigation items:');
        sampleResult.rows.forEach((row, index) => {
            console.log(`${index + 1}. Job Role: ${row.job_role_id}, App: ${row.app_id}, Label: ${row.label}, Platform: ${row.mob_desk}, Status: ${row.int_status}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking navigation:', error);
    } finally {
        await db.end();
    }
}

checkNavigation(); 