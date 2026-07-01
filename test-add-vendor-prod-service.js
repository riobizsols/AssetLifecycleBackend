const { Pool } = require('pg');
require('dotenv').config();

async function checkVendorSetup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Checking vendor setup for V039...\n');
    
    // Check if vendor has product/service entries
    const checkVPS = `
      SELECT vps.*, ps.description, ps.asset_type_id, at.text as asset_type_name
      FROM "tblVendorProdService" vps
      LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id
      LEFT JOIN "tblAssetTypes" at ON ps.asset_type_id = at.asset_type_id
      WHERE vps.vendor_id = 'V039'
    `;
    
    const vpsResult = await pool.query(checkVPS);
    console.log(`📊 Product/Service entries for V039: ${vpsResult.rows.length}`);
    
    if (vpsResult.rows.length === 0) {
      console.log('\n⚠️  Vendor V039 has NO product/service entries!');
      console.log('\n💡 To fix this, you need to:');
      console.log('   1. Go to Vendor Management UI');
      console.log('   2. Edit vendor V039 (Acme Supplies Pvt Ltd)');
      console.log('   3. Add Product/Service entries');
      console.log('   4. Link products/services that have asset_type_id set');
      console.log('\n📋 Available Products/Services with Asset Types:');
      
      // Show available products/services with asset types
      const availablePS = `
        SELECT ps.prod_serv_id, ps.description, ps.asset_type_id, at.text as asset_type_name
        FROM "tblProdServs" ps
        LEFT JOIN "tblAssetTypes" at ON ps.asset_type_id = at.asset_type_id
        WHERE ps.org_id = 'ORG001' AND ps.asset_type_id IS NOT NULL
        LIMIT 10
      `;
      
      const psResult = await pool.query(availablePS);
      if (psResult.rows.length > 0) {
        psResult.rows.forEach(ps => {
          console.log(`   - ${ps.prod_serv_id}: ${ps.description} → Asset Type: ${ps.asset_type_name || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️  No products/services with asset types found!');
      }
    } else {
      console.log('\n✅ Vendor has product/service entries:');
      vpsResult.rows.forEach(vps => {
        console.log(`   - ${vps.prod_serv_id}: ${vps.description || 'N/A'} → Asset Type: ${vps.asset_type_name || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkVendorSetup();


