const db = require('./config/db');

async function checkTables() {
    try {
        console.log('Checking existing tables...');

        // Check if tblJobRoleNav exists and its structure
        const tableExists = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tblJobRoleNav'
            );
        `);

        if (tableExists.rows[0].exists) {
            console.log('✅ tblJobRoleNav table exists');
            
            // Get table structure
            const structure = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'tblJobRoleNav'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n📋 Table structure:');
            structure.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });

            // Check if there's data
            const data = await db.query('SELECT COUNT(*) as count FROM "tblJobRoleNav"');
            console.log(`\n📊 Records in table: ${data.rows[0].count}`);
        } else {
            console.log('❌ tblJobRoleNav table does not exist');
        }

        // Check if tblUserJobRoles exists
        const userTableExists = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tblUserJobRoles'
            );
        `);

        if (userTableExists.rows[0].exists) {
            console.log('✅ tblUserJobRoles table exists');
            
            const userStructure = await db.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'tblUserJobRoles'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n📋 User table structure:');
            userStructure.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });

            const userData = await db.query('SELECT COUNT(*) as count FROM "tblUserJobRoles"');
            console.log(`\n📊 Records in user table: ${userData.rows[0].count}`);
        } else {
            console.log('❌ tblUserJobRoles table does not exist');
        }

    } catch (error) {
        console.error('❌ Error checking tables:', error);
    } finally {
        process.exit(0);
    }
}

checkTables(); 