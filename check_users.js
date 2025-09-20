const db = require('./config/db');

async function checkUsers() {
    try {
        console.log('Checking available users...');
        
        const result = await db.query('SELECT user_id, full_name, email FROM "tblUsers" LIMIT 5');
        
        if (result.rows.length > 0) {
            console.log('✅ Available users:');
            result.rows.forEach(user => {
                console.log(`- ${user.user_id}: ${user.full_name} (${user.email})`);
            });
        } else {
            console.log('❌ No users found in database');
        }
        
    } catch (error) {
        console.error('❌ Error checking users:', error.message);
    }
    
    process.exit(0);
}

checkUsers();
