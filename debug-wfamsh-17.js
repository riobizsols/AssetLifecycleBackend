const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/assetlifecycle_dev'
});

async function debugWFAMSH17() {
  try {
    console.log('=== DEBUG WFAMSH_17 ===');
    
    // Check if the workflow header exists and what fields it has
    const headerQuery = `
      SELECT 
        wfamsh_id,
        asset_id,
        vendor_id,
        emp_int_id,
        at_main_freq_id,
        created_on,
        pl_sch_date
      FROM "tblWFAssetMaintSch_H"
      WHERE wfamsh_id = 'WFAMSH_17'
    `;
    
    const headerResult = await pool.query(headerQuery);
    console.log('Header data:', headerResult.rows);
    
    // Check the asset details
    if (headerResult.rows.length > 0) {
      const assetId = headerResult.rows[0].asset_id;
      const assetQuery = `
        SELECT 
          asset_id,
          text as asset_name,
          asset_type_id,
          service_vendor_id
        FROM "tblAssets"
        WHERE asset_id = $1
      `;
      
      const assetResult = await pool.query(assetQuery, [assetId]);
      console.log('Asset data:', assetResult.rows);
    }
    
    // Check what the full query returns
    const fullQuery = `
      SELECT 
        wfd.wfamsd_id,
        wfd.wfamsh_id,
        wfh.emp_int_id as header_emp_int_id,
        wfh.at_main_freq_id,
        wfh.vendor_id,
        a.service_vendor_id,
        CASE 
          WHEN COALESCE(wfh.vendor_id, a.service_vendor_id) IS NOT NULL AND COALESCE(wfh.vendor_id, a.service_vendor_id) != '' THEN 'Vendor'
          ELSE 'Inhouse'
        END as maintained_by
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      LEFT JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      WHERE wfd.wfamsh_id = 'WFAMSH_17'
      AND wfd.org_id = 'ORG001'
    `;
    
    const fullResult = await pool.query(fullQuery);
    console.log('Full query result:', fullResult.rows);
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await pool.end();
  }
}

debugWFAMSH17();