const { Pool } = require('pg');
require('dotenv').config();

async function testGroupedQuery() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Testing GROUPED SLA Report Query...\n');
    
    // Test the new GROUP BY query
    const query = `
      SELECT
        v.vendor_id,
        v.vendor_name,
        v.company_name,
        vs."SLA-1" as sla_1_value,
        vs."SLA-2" as sla_2_value,
        vs."SLA-3" as sla_3_value,
        vs."SLA-4" as sla_4_value,
        STRING_AGG(DISTINCT at.text, ', ' ORDER BY at.text) FILTER (WHERE at.text IS NOT NULL) as asset_type_names,
        STRING_AGG(DISTINCT at.asset_type_id::text, ', ' ORDER BY at.asset_type_id::text) FILTER (WHERE at.asset_type_id IS NOT NULL) as asset_type_ids
      FROM "tblVendors" v
      INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
      LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
      LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND ps.org_id = v.org_id
      LEFT JOIN "tblAssetTypes" at ON ps.asset_type_id = at.asset_type_id
      WHERE v.org_id = $1 AND v.int_status = 1
      GROUP BY v.vendor_id, v.vendor_name, v.company_name, vs."SLA-1", vs."SLA-2", vs."SLA-3", vs."SLA-4"
      ORDER BY v.vendor_name
    `;
    
    const org_id = 'ORG001';
    const result = await pool.query(query, [org_id]);
    
    console.log(`📊 Total rows from GROUPED query: ${result.rows.length}\n`);
    console.log('Expected: 3 rows (one per vendor)\n');
    
    result.rows.forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`);
      console.log(`  Vendor: ${row.vendor_name} (${row.vendor_id})`);
      console.log(`  Asset Types: ${row.asset_type_names || 'NULL'}`);
      console.log(`  Asset Type IDs: ${row.asset_type_ids || 'NULL'}`);
      
      // Count SLAs with values
      const slaCount = [];
      if (row.sla_1_value && row.sla_1_value.trim() !== '') slaCount.push('SLA-1');
      if (row.sla_2_value && row.sla_2_value.trim() !== '') slaCount.push('SLA-2');
      if (row.sla_3_value && row.sla_3_value.trim() !== '') slaCount.push('SLA-3');
      if (row.sla_4_value && row.sla_4_value.trim() !== '') slaCount.push('SLA-4');
      console.log(`  SLAs with values: ${slaCount.length} (${slaCount.join(', ')})`);
      console.log(`  Expected rows in report: ${slaCount.length} (one per SLA)`);
      console.log('');
    });
    
    const totalExpectedRows = result.rows.reduce((sum, row) => {
      let count = 0;
      if (row.sla_1_value && row.sla_1_value.trim() !== '') count++;
      if (row.sla_2_value && row.sla_2_value.trim() !== '') count++;
      if (row.sla_3_value && row.sla_3_value.trim() !== '') count++;
      if (row.sla_4_value && row.sla_4_value.trim() !== '') count++;
      return sum + count;
    }, 0);
    
    console.log(`\n📈 Summary:`);
    console.log(`  Vendors: ${result.rows.length}`);
    console.log(`  Expected total rows in report: ${totalExpectedRows} (one per SLA value)`);
    console.log(`  Current issue: Seeing 16 rows instead of ${totalExpectedRows}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testGroupedQuery();

