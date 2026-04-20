const { Pool } = require('pg');

// Simple debug script to check WFAMSH_17 data
const pool = new Pool({
  user: 'postgres',
  host: '103.73.190.251',
  database: 'assetLifecycle',
  password: 'Kovai1252*',
  port: 5432,
});

async function checkWfamsh17() {
  try {
    console.log('🔍 Checking WFAMSH_17 data...');

    // Check header table directly
    const headerQuery = `
      SELECT wfamsh_id, asset_id, vendor_id, emp_int_id, at_main_freq_id, status, created_by, created_on
      FROM "tblWFAssetMaintSch_H"
      WHERE wfamsh_id = 'WFAMSH_17'
    `;
    
    const headerResult = await pool.query(headerQuery);
    console.log('📊 Header data:', headerResult.rows);

    // Check detail table
    const detailQuery = `
      SELECT wfamsd_id, wfamsh_id, job_role_id, user_id, sequence, status, org_id
      FROM "tblWFAssetMaintSch_D"
      WHERE wfamsh_id = 'WFAMSH_17' AND org_id = 'ORG001'
    `;
    
    const detailResult = await pool.query(detailQuery);
    console.log('📊 Detail data:', detailResult.rows);

    // Check asset data for AST007
    const assetQuery = `
      SELECT asset_id, text as asset_name, service_vendor_id, asset_type_id
      FROM "tblAssets"
      WHERE asset_id = 'AST007' AND org_id = 'ORG001'
    `;
    
    const assetResult = await pool.query(assetQuery);
    console.log('📊 Asset data:', assetResult.rows);

    // Check ATMaintFreq data for ATMF001 
    const freqQuery = `
      SELECT *
      FROM "tblATMaintFreq"
      WHERE at_main_freq_id = 'ATMF001'
    `;
    
    const freqResult = await pool.query(freqQuery);
    console.log('📊 ATMaintFreq data:', freqResult.rows);

    // Try the exact query from getApprovalDetailByWfamshId with ATMaintFreq join
    const exactQuery = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfh.emp_int_id as header_emp_int_id,
        wfh.vendor_id,
        wfh.at_main_freq_id,
        a.service_vendor_id,
        COALESCE(atmf.maintained_by, 'Inhouse') as maintained_by,
        atmf.maintained_by as freq_maintained_by,
        wfd.status as detail_status,
        wfh.status as header_status,
        wfd.job_role_id
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      LEFT JOIN "tblATMaintFreq" atmf ON wfh.at_main_freq_id = atmf.at_main_freq_id
      WHERE wfd.org_id = 'ORG001'
        AND wfd.wfamsh_id = 'WFAMSH_17'
        AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
        AND wfd.job_role_id IS NOT NULL
      ORDER BY wfd.sequence ASC
    `;
    
    const exactResult = await pool.query(exactQuery);
    console.log('📊 Exact query result:', exactResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkWfamsh17();