require('dotenv').config();
const { Pool } = require('pg');

async function checkTblRioAdminSchema() {
  const genericPool = new Pool({
    connectionString: process.env.GENERIC_URL,
  });

  const databasePool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('=== Checking tblRioAdmin schema in GENERIC_URL ===');
    const genericSchema = await genericPool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tblRioAdmin'
      ORDER BY ordinal_position
    `);
    console.log('\nGeneric DB columns:', genericSchema.rows.length);
    genericSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    console.log('\n=== Checking tblRioAdmin schema in DATABASE_URL ===');
    const databaseSchema = await databasePool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tblRioAdmin'
      ORDER BY ordinal_position
    `);
    console.log('\nDatabase URL columns:', databaseSchema.rows.length);
    databaseSchema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Find missing columns
    const genericCols = new Set(genericSchema.rows.map(r => r.column_name));
    const databaseCols = new Set(databaseSchema.rows.map(r => r.column_name));
    
    const missingInDatabase = [...genericCols].filter(col => !databaseCols.has(col));
    const extraInDatabase = [...databaseCols].filter(col => !genericCols.has(col));

    if (missingInDatabase.length > 0) {
      console.log('\n❌ Missing columns in DATABASE_URL:');
      missingInDatabase.forEach(col => console.log(`  - ${col}`));
    }

    if (extraInDatabase.length > 0) {
      console.log('\n⚠️ Extra columns in DATABASE_URL:');
      extraInDatabase.forEach(col => console.log(`  - ${col}`));
    }

    if (missingInDatabase.length === 0 && extraInDatabase.length === 0) {
      console.log('\n✅ Schemas match perfectly!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await genericPool.end();
    await databasePool.end();
  }
}

checkTblRioAdminSchema();
