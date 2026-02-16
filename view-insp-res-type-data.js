const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== VIEWING tblInspResTypeDet DATA ===\n');
    
    // Get all data
    const allData = await db.query(`
      SELECT 
        "IRTD_Id",
        "Name",
        "Expected_Value",
        "Option",
        org_id,
        created_by,
        TO_CHAR(created_on, 'YYYY-MM-DD HH24:MI:SS') as created_on
      FROM "tblInspResTypeDet"
      ORDER BY "Name", "Option"
    `);
    
    console.log(`Total records: ${allData.rows.length}\n`);
    
    // Group by Name
    const grouped = {};
    allData.rows.forEach(row => {
      if (!grouped[row.Name]) {
        grouped[row.Name] = [];
      }
      grouped[row.Name].push(row);
    });
    
    // Display grouped data
    Object.keys(grouped).sort().forEach((name, idx) => {
      console.log(`${idx + 1}. Response Type: ${name}`);
      console.log(`   Options (${grouped[name].length}):`);
      grouped[name].forEach((row, i) => {
        const option = row.Option || 'NULL (for numeric input)';
        const expectedValue = row.Expected_Value || '-';
        console.log(`      ${i + 1}. ${option}`);
        console.log(`         ID: ${row.IRTD_Id}`);
        console.log(`         Expected: ${expectedValue}`);
      });
      console.log('');
    });
    
    // Get summary by organization
    console.log('=== SUMMARY BY ORGANIZATION ===\n');
    const summary = await db.query(`
      SELECT 
        org_id,
        COUNT(*) as total_records,
        COUNT(DISTINCT "Name") as response_types
      FROM "tblInspResTypeDet"
      GROUP BY org_id
    `);
    
    summary.rows.forEach(row => {
      console.log(`Organization: ${row.org_id}`);
      console.log(`  Total Records: ${row.total_records}`);
      console.log(`  Response Types: ${row.response_types}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
