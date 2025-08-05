const db = require('./config/db');

async function checkTableDetails() {
    try {
        console.log('Checking detailed table structure...');

        // Get all columns with their constraints
        const columns = await db.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'tblJobRoleNav'
            ORDER BY ordinal_position;
        `);
        
        console.log('\n📋 All columns in tblJobRoleNav:');
        columns.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'}) ${col.column_default ? `default: ${col.column_default}` : ''}`);
        });

        // Check for constraints
        const constraints = await db.query(`
            SELECT 
                constraint_name,
                constraint_type,
                column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'tblJobRoleNav';
        `);
        
        console.log('\n🔒 Table constraints:');
        constraints.rows.forEach(constraint => {
            console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
        });

        // Try to insert a test record to see what's missing
        console.log('\n🧪 Testing insert...');
        try {
            await db.query(`
                INSERT INTO "tblJobRoleNav" 
                (job_role_nav_id, org_id, int_status, job_role_id, app_id, label, access_level, is_group, mob_desk)
                VALUES ('TEST001', 'ORG001', 1, 'JR001', 'TEST', 'Test Item', 'A', false, 'D')
            `);
            console.log('✅ Test insert successful');
            
            // Clean up test record
            await db.query(`DELETE FROM "tblJobRoleNav" WHERE job_role_nav_id = 'TEST001'`);
            console.log('✅ Test record cleaned up');
        } catch (error) {
            console.log('❌ Test insert failed:', error.message);
        }

    } catch (error) {
        console.error('❌ Error checking table details:', error);
    } finally {
        process.exit(0);
    }
}

checkTableDetails(); 