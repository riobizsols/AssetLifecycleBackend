/**
 * Script: Diagnose Certificate Dropdown Issue
 * 
 * Run this to identify why the certificate dropdown is empty:
 * node scripts/diagnose-certificate-dropdown.js
 */

const { getDb } = require('../utils/dbContext');

const getDbContext = () => {
  try {
    return getDb();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    return null;
  }
};

async function diagnoseCertificates() {
  const dbPool = getDbContext();
  
  if (!dbPool) {
    console.error('\n❌ Cannot connect to database. Make sure:');
    console.log('   1. PostgreSQL is running');
    console.log('   2. DATABASE_URL is set in .env');
    console.log('   3. Database credentials are correct\n');
    process.exit(1);
  }

  console.log('\n🔍 Certificate Dropdown Diagnostic Check\n');
  console.log('=' .repeat(50));

  try {
    // 1. Check if tblTechCert table exists
    console.log('\n1️⃣  Checking tblTechCert table...\n');
    
    const tableCheck = await dbPool.query(
      `SELECT EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tblTechCert'
      )`
    );

    const tableExists = tableCheck.rows[0].exists;
    if (!tableExists) {
      console.log('❌ Table tblTechCert does NOT exist\n');
      console.log('   Action: This table should exist in the database');
      process.exit(1);
    }

    console.log('✅ Table tblTechCert exists\n');

    // 2. Check column structure
    console.log('2️⃣  Checking table columns...\n');
    
    const columnsResult = await dbPool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'tblTechCert'
       ORDER BY column_name`
    );

    if (columnsResult.rows.length === 0) {
      console.log('❌ No columns found in tblTechCert\n');
      process.exit(1);
    }

    console.log('✅ Found columns:');
    columnsResult.rows.forEach(col => {
      console.log(`   • ${col.column_name} (${col.data_type})`);
    });

    const columnNames = columnsResult.rows.map(c => c.column_name.toLowerCase());
    console.log('\n📋 Expected columns check:');
    
    const expectedColumns = ['tc_id', 'certificate_name', 'certificate_no', 'org_id'];
    let hasAllRequired = true;
    
    expectedColumns.forEach(col => {
      const found = columnNames.includes(col.toLowerCase());
      console.log(`   ${found ? '✅' : '❌'} ${col}`);
      if (!found) hasAllRequired = false;
    });

    if (!hasAllRequired) {
      console.log('\n⚠️  Some expected columns are missing');
      console.log('   Note: Columns might have different names');
      console.log('   Check your actual table structure');
    }

    // 3. Check for data
    console.log('\n3️⃣  Checking for certificate data...\n');
    
    const countResult = await dbPool.query(
      'SELECT COUNT(*) as count FROM "tblTechCert"'
    );

    const totalCount = countResult.rows[0].count;
    console.log(`✅ Total records in tblTechCert: ${totalCount}`);

    if (totalCount === 0) {
      console.log('\n⚠️  NO CERTIFICATES FOUND IN DATABASE\n');
      console.log('   Action Required:');
      console.log('   1. Go to Admin Settings → Certifications');
      console.log('   2. Create at least one certificate');
      console.log('   3. Try uploading again\n');
      process.exit(1);
    }

    // 4. Check first few records
    console.log('\n4️⃣  Sample certificate records:\n');
    
    const dataResult = await dbPool.query(
      `SELECT * FROM "tblTechCert" LIMIT 5`
    );

    if (dataResult.rows.length > 0) {
      console.log(`Found ${dataResult.rows.length} record(s):`);
      dataResult.rows.forEach((row, idx) => {
        console.log(`\n   Record ${idx + 1}:`);
        Object.entries(row).forEach(([key, val]) => {
          console.log(`      ${key}: ${val}`);
        });
      });
    }

    // 5. Check org_id filtering
    console.log('\n5️⃣  Checking org_id filtering...\n');
    
    const orgResult = await dbPool.query(
      'SELECT DISTINCT org_id FROM "tblTechCert"'
    );

    console.log(`✅ Certificates distributed across ${orgResult.rows.length} organization(s):`);
    orgResult.rows.forEach(row => {
      console.log(`   • org_id: ${row.org_id}`);
    });

    // 6. API simulation
    console.log('\n6️⃣  Simulating API call with org_id = ORG001...\n');
    
    try {
      // Try selecting with org_id
      const apiResult = await dbPool.query(
        `SELECT "tc_id", "certificate_name", "certificate_no" 
         FROM "tblTechCert" 
         WHERE "org_id" = $1 
         LIMIT 5`,
        ['ORG001']
      );

      console.log(`✅ API call returned ${apiResult.rows.length} record(s) for ORG001`);
      if (apiResult.rows.length > 0) {
        console.log('   Sample response:');
        console.log('   ', JSON.stringify(apiResult.rows[0], null, 2));
      } else {
        console.log('   ⚠️  No certificates found for ORG001');
        console.log('   Check if this org_id has any certificates');
      }
    } catch (error) {
      console.log(`❌ Query failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ Diagnostic Complete\n');
    console.log('Summary:');
    console.log(`   • Table exists: ✅`);
    console.log(`   • Records: ${totalCount}`);
    console.log(`   • Status: ${totalCount > 0 ? '✅ Ready' : '❌ No data'}\n`);

    if (totalCount === 0) {
      console.log('💡 Next Action: Create certificates in Admin Settings\n');
    } else {
      console.log('💡 If dropdown still empty:');
      console.log('   1. Check browser console (F12) for errors');
      console.log('   2. Verify user has proper permissions');
      console.log('   3. Check network tab to see API response\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run diagnostic
diagnoseCertificates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
