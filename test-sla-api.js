const { Pool } = require('pg');
require('dotenv').config();

async function testSLAReportQuery() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Testing SLA Report Query...\n');
    
    // Test the actual query from slaReportModel
    const query = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        v.company_name,
        v.company_email,
        v.contact_person_name,
        v.contact_person_number,
        v.contract_start_date,
        v.contract_end_date,
        vs.vsla_id,
        vs."SLA-1" as sla_1_value,
        vs."SLA-2" as sla_2_value,
        vs."SLA-3" as sla_3_value,
        vs."SLA-4" as sla_4_value,
        vs."SLA-5" as sla_5_value,
        vs."SLA-6" as sla_6_value,
        vs."SLA-7" as sla_7_value,
        vs."SLA-8" as sla_8_value,
        vs."SLA-9" as sla_9_value,
        vs."SLA-10" as sla_10_value,
        sd1.sla_id as sla_1_id,
        sd1.description as sla_1_description,
        sd2.sla_id as sla_2_id,
        sd2.description as sla_2_description,
        sd3.sla_id as sla_3_id,
        sd3.description as sla_3_description,
        sd4.sla_id as sla_4_id,
        sd4.description as sla_4_description,
        sd5.sla_id as sla_5_id,
        sd5.description as sla_5_description,
        sd6.sla_id as sla_6_id,
        sd6.description as sla_6_description,
        sd7.sla_id as sla_7_id,
        sd7.description as sla_7_description,
        sd8.sla_id as sla_8_id,
        sd8.description as sla_8_description,
        sd9.sla_id as sla_9_id,
        sd9.description as sla_9_description,
        sd10.sla_id as sla_10_id,
        sd10.description as sla_10_description,
        at.asset_type_id,
        at.text as asset_type_name
      FROM "tblVendors" v
      INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
      LEFT JOIN tblsla_desc sd1 ON sd1.sla_id = 'SLA-1'
      LEFT JOIN tblsla_desc sd2 ON sd2.sla_id = 'SLA-2'
      LEFT JOIN tblsla_desc sd3 ON sd3.sla_id = 'SLA-3'
      LEFT JOIN tblsla_desc sd4 ON sd4.sla_id = 'SLA-4'
      LEFT JOIN tblsla_desc sd5 ON sd5.sla_id = 'SLA-5'
      LEFT JOIN tblsla_desc sd6 ON sd6.sla_id = 'SLA-6'
      LEFT JOIN tblsla_desc sd7 ON sd7.sla_id = 'SLA-7'
      LEFT JOIN tblsla_desc sd8 ON sd8.sla_id = 'SLA-8'
      LEFT JOIN tblsla_desc sd9 ON sd9.sla_id = 'SLA-9'
      LEFT JOIN tblsla_desc sd10 ON sd10.sla_id = 'SLA-10'
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND ps.org_id = v.org_id
      LEFT JOIN "tblAssetTypes" at ON ps.asset_type_id = at.asset_type_id
      WHERE v.org_id = $1 AND v.int_status = 1
      ORDER BY v.vendor_name, at.text
      LIMIT 10
    `;
    
    const org_id = 'ORG001';
    console.log(`📊 Executing query for org_id: ${org_id}\n`);
    
    const result = await pool.query(query, [org_id]);
    
    console.log(`✅ Query executed successfully!`);
    console.log(`📋 Found ${result.rows.length} rows\n`);
    
    if (result.rows.length > 0) {
      console.log('📊 Sample Results:\n');
      result.rows.forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`);
        console.log(`  Vendor ID: ${row.vendor_id}`);
        console.log(`  Vendor Name: ${row.vendor_name}`);
        console.log(`  Asset Type ID: ${row.asset_type_id || 'NULL'}`);
        console.log(`  Asset Type Name: ${row.asset_type_name || 'NULL'}`);
        console.log(`  SLA-1 Value: ${row.sla_1_value || 'NULL'}`);
        console.log(`  SLA-1 Description: ${row.sla_1_description || 'NULL'}`);
        console.log('');
      });
      
      // Check how many rows have asset types
      const withAssetType = result.rows.filter(r => r.asset_type_id && r.asset_type_name);
      const withoutAssetType = result.rows.filter(r => !r.asset_type_id || !r.asset_type_name);
      
      console.log(`\n📈 Summary:`);
      console.log(`  Rows with Asset Type: ${withAssetType.length}`);
      console.log(`  Rows without Asset Type: ${withoutAssetType.length}`);
      
      if (withoutAssetType.length > 0) {
        console.log(`\n⚠️  Vendors without Asset Types:`);
        withoutAssetType.forEach(row => {
          console.log(`    - ${row.vendor_id}: ${row.vendor_name}`);
        });
      }
    } else {
      console.log('⚠️  No results found!');
    }
    
    // Also test the relationship chain
    console.log('\n🔍 Testing relationship chain...\n');
    const chainTest = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        COUNT(DISTINCT vps.prod_serv_id) as prod_serv_count,
        COUNT(DISTINCT ps.asset_type_id) as asset_type_count
      FROM "tblVendors" v
      INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND ps.org_id = v.org_id
      WHERE v.org_id = $1 AND v.int_status = 1
      GROUP BY v.vendor_id, v.vendor_name
    `;
    
    const chainResult = await pool.query(chainTest, [org_id]);
    console.log('Relationship Chain Test Results:');
    chainResult.rows.forEach(row => {
      console.log(`  ${row.vendor_name} (${row.vendor_id}):`);
      console.log(`    Product/Service entries: ${row.prod_serv_count}`);
      console.log(`    Asset Types linked: ${row.asset_type_count}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testSLAReportQuery();


