/**
 * Script: Verify Certificate Database Tables
 * This script checks if all required tables exist in the database
 */

const { getDb } = require('../utils/dbContext');

const getDbContext = () => {
  try {
    return getDb();
  } catch (error) {
    console.error('Error getting database context:', error.message);
    return null;
  }
};

const verifyTables = async () => {
  const dbPool = getDbContext();
  
  if (!dbPool) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }

  try {
    console.log('\n🔍 Verifying Certificate Management Database Tables...\n');
    
    const requiredTables = [
      'tblApps',
      'tblJobRoleNav',
      'tblTechCertificates',
      'tblEmployeeTechCertificates',
      'tblAssetTypeCertificates',
      'tblOrgs',
      'tblJobRoles',
    ];

    const tableCheckResults = [];

    for (const tableName of requiredTables) {
      try {
        const result = await dbPool.query(
          `SELECT EXISTS(
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )`,
          [tableName]
        );

        const exists = result.rows[0].exists;
        tableCheckResults.push({
          table: tableName,
          exists,
          status: exists ? '✅' : '❌'
        });

        console.log(`${exists ? '✅' : '❌'} ${tableName}`);
      } catch (error) {
        console.log(`❌ ${tableName} - Error checking: ${error.message}`);
        tableCheckResults.push({
          table: tableName,
          exists: false,
          status: '❌',
          error: error.message
        });
      }
    }

    console.log('\n📊 Navigation Entries Check:\n');

    try {
      // Check if navigation entries were added
      const navResult = await dbPool.query(
        `SELECT COUNT(*) as count, app_id 
         FROM "tblJobRoleNav" 
         WHERE app_id IN ('CERTIFICATIONS', 'TECHCERTUPLOAD', 'HR/MANAGERAPPROVAL')
         GROUP BY app_id
         ORDER BY app_id`
      );

      if (navResult.rows.length > 0) {
        console.log('✅ Certificate navigation entries found:');
        navResult.rows.forEach(row => {
          console.log(`   • ${row.app_id}: ${row.count} entries`);
        });
      } else {
        console.log('⚠️  No certificate navigation entries found yet.');
        console.log('   Run: node migrations/addCertificationsApps.js');
      }
    } catch (error) {
      console.log(`⚠️  Could not verify navigation entries: ${error.message}`);
    }

    console.log('\n📋 Certificate Master Data Check:\n');

    try {
      const certResult = await dbPool.query(
        `SELECT COUNT(*) as count FROM "tblTechCertificates" WHERE int_status = 1`
      );

      console.log(`✅ Tech Certificates: ${certResult.rows[0].count} active record(s)`);
    } catch (error) {
      console.log(`⚠️  Could not check tech certificates: ${error.message}`);
    }

    try {
      const empCertResult = await dbPool.query(
        `SELECT COUNT(*) as count FROM "tblEmployeeTechCertificates" WHERE int_status = 1`
      );

      console.log(`✅ Employee Certificates: ${empCertResult.rows[0].count} record(s)`);
    } catch (error) {
      console.log(`⚠️  Could not check employee certificates: ${error.message}`);
    }

    console.log('\n📝 Summary:\n');

    const allExist = tableCheckResults.every(r => r.exists);

    if (allExist) {
      console.log('✅ All required tables exist!');
      console.log('\n🎯 Next Steps:');
      console.log('1. Run: node migrations/addCertificationsApps.js');
      console.log('2. Start backend: npm start');
      console.log('3. Start frontend: npm run dev');
      console.log('4. Login and check for certificate menu items\n');
    } else {
      console.log('❌ Some required tables are missing!');
      console.log('\nMissing tables:');
      tableCheckResults
        .filter(r => !r.exists)
        .forEach(r => console.log(`   • ${r.table}`));
      console.log('\nPlease ensure the database is properly initialized.\n');
    }

    process.exit(allExist ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Database verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run verification
verifyTables().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

module.exports = { verifyTables };
