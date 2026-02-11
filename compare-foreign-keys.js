require('dotenv').config();
const { Pool } = require('pg');

async function compareForeignKeys() {
  const genericPool = new Pool({
    connectionString: process.env.GENERIC_URL,
  });

  const databasePool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('=== Fetching Foreign Keys from GENERIC_URL ===');
    const genericFKQuery = `
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `;
    const genericFK = await genericPool.query(genericFKQuery);
    console.log(`Found ${genericFK.rows.length} foreign keys in GENERIC_URL\n`);

    console.log('=== Fetching Foreign Keys from DATABASE_URL ===');
    const databaseFK = await databasePool.query(genericFKQuery);
    console.log(`Found ${databaseFK.rows.length} foreign keys in DATABASE_URL\n`);

    // Create maps for comparison
    const genericFKMap = new Map();
    genericFK.rows.forEach(fk => {
      const key = `${fk.table_name}::${fk.constraint_name}`;
      genericFKMap.set(key, fk);
    });

    const databaseFKMap = new Map();
    databaseFK.rows.forEach(fk => {
      const key = `${fk.table_name}::${fk.constraint_name}`;
      databaseFKMap.set(key, fk);
    });

    // Group by table for better reporting
    const genericByTable = {};
    genericFK.rows.forEach(fk => {
      if (!genericByTable[fk.table_name]) {
        genericByTable[fk.table_name] = [];
      }
      genericByTable[fk.table_name].push(fk);
    });

    const databaseByTable = {};
    databaseFK.rows.forEach(fk => {
      if (!databaseByTable[fk.table_name]) {
        databaseByTable[fk.table_name] = [];
      }
      databaseByTable[fk.table_name].push(fk);
    });

    // Find missing and extra FKs
    const missingFKs = [];
    const extraFKs = [];
    const mismatchedFKs = [];

    // Check for missing FKs in DATABASE_URL
    for (const [key, genericFk] of genericFKMap) {
      if (!databaseFKMap.has(key)) {
        missingFKs.push(genericFk);
      } else {
        // Check if they're identical
        const dbFk = databaseFKMap.get(key);
        if (
          genericFk.column_name !== dbFk.column_name ||
          genericFk.foreign_table_name !== dbFk.foreign_table_name ||
          genericFk.foreign_column_name !== dbFk.foreign_column_name ||
          genericFk.update_rule !== dbFk.update_rule ||
          genericFk.delete_rule !== dbFk.delete_rule
        ) {
          mismatchedFKs.push({
            generic: genericFk,
            database: dbFk
          });
        }
      }
    }

    // Check for extra FKs in DATABASE_URL
    for (const [key, dbFk] of databaseFKMap) {
      if (!genericFKMap.has(key)) {
        extraFKs.push(dbFk);
      }
    }

    // Report by table
    console.log('=== TABLE-BY-TABLE COMPARISON ===\n');
    
    const allTables = new Set([...Object.keys(genericByTable), ...Object.keys(databaseByTable)]);
    const sortedTables = Array.from(allTables).sort();

    let hasAnyDifferences = false;

    for (const tableName of sortedTables) {
      const genericFKs = genericByTable[tableName] || [];
      const databaseFKs = databaseByTable[tableName] || [];
      
      if (genericFKs.length === databaseFKs.length) {
        // Check if all FKs match
        const missingInTable = missingFKs.filter(fk => fk.table_name === tableName);
        const extraInTable = extraFKs.filter(fk => fk.table_name === tableName);
        const mismatchedInTable = mismatchedFKs.filter(m => m.generic.table_name === tableName);
        
        if (missingInTable.length === 0 && extraInTable.length === 0 && mismatchedInTable.length === 0) {
          console.log(`✅ ${tableName}: ${genericFKs.length} FKs (MATCH)`);
        } else {
          hasAnyDifferences = true;
          console.log(`\n⚠️  ${tableName}: Differences found`);
          console.log(`   GENERIC: ${genericFKs.length} FKs | DATABASE: ${databaseFKs.length} FKs`);
          
          if (missingInTable.length > 0) {
            console.log(`   ❌ Missing in DATABASE_URL:`);
            missingInTable.forEach(fk => {
              console.log(`      - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
            });
          }
          
          if (extraInTable.length > 0) {
            console.log(`   ➕ Extra in DATABASE_URL:`);
            extraInTable.forEach(fk => {
              console.log(`      - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
            });
          }
          
          if (mismatchedInTable.length > 0) {
            console.log(`   🔄 Mismatched:`);
            mismatchedInTable.forEach(m => {
              console.log(`      - ${m.generic.constraint_name}:`);
              console.log(`        GENERIC:  ${m.generic.column_name} -> ${m.generic.foreign_table_name}(${m.generic.foreign_column_name}) [${m.generic.update_rule}/${m.generic.delete_rule}]`);
              console.log(`        DATABASE: ${m.database.column_name} -> ${m.database.foreign_table_name}(${m.database.foreign_column_name}) [${m.database.update_rule}/${m.database.delete_rule}]`);
            });
          }
        }
      } else {
        hasAnyDifferences = true;
        console.log(`\n⚠️  ${tableName}: Count mismatch`);
        console.log(`   GENERIC: ${genericFKs.length} FKs | DATABASE: ${databaseFKs.length} FKs`);
        
        const missingInTable = missingFKs.filter(fk => fk.table_name === tableName);
        const extraInTable = extraFKs.filter(fk => fk.table_name === tableName);
        
        if (missingInTable.length > 0) {
          console.log(`   ❌ Missing in DATABASE_URL:`);
          missingInTable.forEach(fk => {
            console.log(`      - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
          });
        }
        
        if (extraInTable.length > 0) {
          console.log(`   ➕ Extra in DATABASE_URL:`);
          extraInTable.forEach(fk => {
            console.log(`      - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
          });
        }
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total FKs in GENERIC_URL:  ${genericFK.rows.length}`);
    console.log(`Total FKs in DATABASE_URL: ${databaseFK.rows.length}`);
    console.log(`Missing in DATABASE_URL:   ${missingFKs.length}`);
    console.log(`Extra in DATABASE_URL:     ${extraFKs.length}`);
    console.log(`Mismatched:                ${mismatchedFKs.length}`);

    if (!hasAnyDifferences) {
      console.log('\n✅ All foreign keys match perfectly!');
    } else {
      console.log('\n⚠️  Differences found between databases');
      
      if (missingFKs.length > 0) {
        console.log('\n=== DETAILED MISSING FKs ===');
        missingFKs.forEach(fk => {
          console.log(`${fk.table_name}.${fk.constraint_name}:`);
          console.log(`  ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
          console.log(`  ON UPDATE ${fk.update_rule} | ON DELETE ${fk.delete_rule}\n`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await genericPool.end();
    await databasePool.end();
  }
}

compareForeignKeys();
