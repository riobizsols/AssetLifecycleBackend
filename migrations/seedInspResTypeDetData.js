const db = require('../config/db');

/**
 * Script to seed tblInspResTypeDet table with sample data
 * Also checks and creates sample organization if needed
 */

const seedInspResTypeDetData = async () => {
  const client = await db.connect();
  
  try {
    console.log('\n=== SEEDING tblInspResTypeDet TABLE ===\n');

    // Step 1: Check if tblOrgs has any data
    console.log('Step 1: Checking for existing organizations...');
    const orgCheck = await client.query(`
      SELECT org_id, text as org_name FROM "tblOrgs" LIMIT 1
    `);
    
    let orgId;
    
    if (orgCheck.rows.length === 0) {
      console.log('⚠️  No organizations found. Creating sample organization...');
      
      // Create a sample organization
      orgId = 'ORG_DEMO_001';
      await client.query(`
        INSERT INTO "tblOrgs" (org_id, text, org_code, valid_from, int_status)
        VALUES ($1, $2, $3, CURRENT_DATE, 1)
        ON CONFLICT (org_id) DO NOTHING
      `, [orgId, 'Demo Organization', 'DEMO']);
      
      console.log(`✅ Created sample organization: ${orgId}`);
    } else {
      orgId = orgCheck.rows[0].org_id;
      console.log(`✅ Using existing organization: ${orgId} (${orgCheck.rows[0].org_name || 'unnamed'})`);
    }
    
    // Step 2: Check if tblInspResTypeDet already has data
    console.log('\nStep 2: Checking existing data in tblInspResTypeDet...');
    const existingData = await client.query(`
      SELECT COUNT(*) as count FROM "tblInspResTypeDet"
    `);
    
    if (existingData.rows[0].count > 0) {
      console.log(`⚠️  Table already has ${existingData.rows[0].count} records.`);
      console.log('Do you want to continue adding more data? (Skipping for now)');
      console.log('');
    }
    
    // Step 3: Insert sample response type data
    console.log('Step 3: Inserting sample response type definitions...\n');
    
    const sampleData = [
      // Qualitative - Yes/No type
      { 
        id: 'IRTD_QL_YES_NO_001', 
        name: 'QL_Yes_No', 
        expectedValue: 'Yes', 
        option: 'Yes' 
      },
      { 
        id: 'IRTD_QL_YES_NO_002', 
        name: 'QL_Yes_No', 
        expectedValue: 'No', 
        option: 'No' 
      },
      
      // Qualitative - Multi Option type
      { 
        id: 'IRTD_QL_MULTI_001', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Good' 
      },
      { 
        id: 'IRTD_QL_MULTI_002', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Excellent' 
      },
      { 
        id: 'IRTD_QL_MULTI_003', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Fair' 
      },
      { 
        id: 'IRTD_QL_MULTI_004', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Poor' 
      },
      { 
        id: 'IRTD_QL_MULTI_005', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Maybe' 
      },
      { 
        id: 'IRTD_QL_MULTI_006', 
        name: 'QL_Multi_Option', 
        expectedValue: null, 
        option: 'Not Applicable' 
      },
      
      // Quantitative - Numeric type
      { 
        id: 'IRTD_QN_001', 
        name: 'QN', 
        expectedValue: null, 
        option: null 
      }
    ];
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const data of sampleData) {
      try {
        await client.query(`
          INSERT INTO "tblInspResTypeDet" (
            irtd_id, 
            name, 
            expected_value, 
            option, 
            org_id, 
            created_by, 
            created_on
          )
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (irtd_id) DO NOTHING
        `, [
          data.id,
          data.name,
          data.expectedValue,
          data.option,
          orgId,
          'SYSTEM'
        ]);
        
        console.log(`✅ Inserted: ${data.name} - ${data.option || 'NULL (numeric)'}`);
        insertedCount++;
      } catch (error) {
        if (error.code === '23505') { // Unique violation
          console.log(`⚠️  Skipped (already exists): ${data.name} - ${data.option || 'NULL'}`);
          skippedCount++;
        } else {
          throw error;
        }
      }
    }
    
    // Step 4: Verify the inserted data
    console.log('\n=== VERIFICATION ===\n');
    const verification = await client.query(`
      SELECT 
        name,
        COUNT(*) as option_count,
        STRING_AGG(option, ', ' ORDER BY option) as options
      FROM "tblInspResTypeDet"
      WHERE org_id = $1
      GROUP BY name
      ORDER BY name
    `, [orgId]);
    
    console.log('Response Types Summary:\n');
    verification.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.name}`);
      console.log(`     Options (${row.option_count}): ${row.options || 'NULL (for numeric input)'}`);
      console.log('');
    });
    
    console.log(`✅ Seeding completed successfully!`);
    console.log(`   Inserted: ${insertedCount} records`);
    console.log(`   Skipped: ${skippedCount} records (already existed)`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
};

// Run seeding
seedInspResTypeDetData()
  .then(() => {
    console.log('\n✅ Data seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Data seeding failed:', error);
    process.exit(1);
  });
