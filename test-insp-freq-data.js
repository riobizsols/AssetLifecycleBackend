const db = require('./config/db');

(async () => {
  try {
    console.log('Checking inspection frequency data...\n');
    
    // Check count
    const countResult = await db.query('SELECT COUNT(*) as count FROM "tblAAT_Insp_Freq"');
    console.log('✓ Inspection Freq Records:', countResult.rows[0].count);
    
    // Check checklist mapping count
    const mappingResult = await db.query('SELECT COUNT(*) as count FROM "tblAATInspCheckList"');
    console.log('✓ Checklist Mapping Records:', mappingResult.rows[0].count);
    
    // Sample inspection freq data
    const sampleFreq = await db.query('SELECT * FROM "tblAAT_Insp_Freq" LIMIT 3');
    console.log('\nSample Inspection Frequency Records:');
    console.log(JSON.stringify(sampleFreq.rows, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
