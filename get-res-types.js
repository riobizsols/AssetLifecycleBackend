const { getDb } = require('./utils/dbContext');

const getResponseTypes = async () => {
  const dbPool = getDb();
  
  try {
    const result = await dbPool.query('SELECT "IRTD_Id", "Name" FROM "tblInspResTypeDet" ORDER BY "Name"');
    console.log('Response Types:');
    result.rows.forEach(row => {
      console.log(`- ID: ${row.IRTD_Id}, Name: ${row.Name}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

getResponseTypes();
