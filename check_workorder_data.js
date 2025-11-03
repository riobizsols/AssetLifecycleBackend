const db = require('./config/db');

async function checkWorkOrderData() {
  try {
    console.log('=== Checking tblAssetMaintSch for BF02 breakdowns ===\n');
    
    // First, check what branch the user typically uses
    const branchCheck = await db.query(`SELECT branch_id, branch_code FROM "tblBranches" WHERE org_id = 'ORG001' LIMIT 5`);
    console.log('Available branches:', JSON.stringify(branchCheck.rows, null, 2));
    console.log('');
    
    // Query all records with MT004 (breakdown) or recent breakdown-related records
    const query = `
      SELECT 
        ams.ams_id,
        ams.wo_id,
        ams.asset_id,
        ams.maint_type_id,
        ams.maintained_by,
        ams.status,
        ams.wfamsh_id,
        ams.vendor_id,
        ams.notes,
        ams.act_maint_st_date,
        ams.created_on,
        ams.org_id,
        a.service_vendor_id,
        a.branch_id as asset_branch_id,
        b.branch_code,
        brd.decision_code,
        brd.abr_id
      FROM "tblAssetMaintSch" ams
      LEFT JOIN "tblAssets" a ON ams.asset_id = a.asset_id
      LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
      LEFT JOIN "tblAssetBRDet" brd ON brd.asset_id = ams.asset_id 
        AND brd.decision_code = 'BF02'
      WHERE ams.org_id = 'ORG001'
        AND (
          ams.maint_type_id = 'MT004'
          OR ams.notes ILIKE '%Breakdown%'
        )
      ORDER BY ams.created_on DESC
      LIMIT 20
    `;
    
    const result = await db.query(query);
    
    console.log(`Found ${result.rows.length} breakdown-related records:\n`);
    if (result.rows.length === 0) {
      console.log('No breakdown records found. Checking all recent records...\n');
      const allRecords = await db.query(`
        SELECT ams_id, wo_id, asset_id, maint_type_id, maintained_by, status, notes, created_on
        FROM "tblAssetMaintSch"
        WHERE org_id = 'ORG001'
        ORDER BY created_on DESC
        LIMIT 10
      `);
      console.log('Recent records:', JSON.stringify(allRecords.rows, null, 2));
    } else {
      result.rows.forEach((row, idx) => {
        console.log(`--- Record ${idx + 1} ---`);
        console.log(`ams_id: ${row.ams_id}`);
        console.log(`wo_id: ${row.wo_id}`);
        console.log(`asset_id: ${row.asset_id}`);
        console.log(`maint_type_id: ${row.maint_type_id}`);
        console.log(`maintained_by: ${row.maintained_by}`);
        console.log(`status: ${row.status}`);
        console.log(`wfamsh_id: ${row.wfamsh_id}`);
        console.log(`vendor_id: ${row.vendor_id}`);
        console.log(`service_vendor_id: ${row.service_vendor_id}`);
        console.log(`asset_branch_id: ${row.asset_branch_id}`);
        console.log(`branch_code: ${row.branch_code}`);
        console.log(`notes: ${row.notes}`);
        console.log(`decision_code: ${row.decision_code || 'N/A'}`);
        console.log(`abr_id: ${row.abr_id || 'N/A'}`);
        console.log('');
      });
      
      // Now test the work order query with a specific branch
      if (result.rows.length > 0 && result.rows[0].asset_branch_id) {
        const testBranchId = result.rows[0].asset_branch_id;
        console.log(`\n=== Testing work order query with branch_id: ${testBranchId} ===\n`);
        
        const workOrderQuery = `
          SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.maintained_by,
            ams.status,
            b.branch_id,
            a.branch_id as asset_branch_id
          FROM "tblAssetMaintSch" ams
          INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
          INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
          LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
          LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
          INNER JOIN "tblBranches" b ON a.branch_id = b.branch_id
          WHERE ams.org_id = 'ORG001' 
            AND a.org_id = 'ORG001' 
            AND b.org_id = 'ORG001' 
            AND b.branch_id = $1
            AND ams.status = 'IN' 
            AND ams.wo_id IS NOT NULL
            AND (
              ams.maintained_by = 'Vendor'
              OR
              ams.maint_type_id = 'MT004'
            )
          ORDER BY ams.created_on DESC
        `;
        
        const woResult = await db.query(workOrderQuery, [testBranchId]);
        console.log(`Work order query returns ${woResult.rows.length} records with branch filter\n`);
        
        // Also test without branch filter
        const woQueryNoBranch = `
          SELECT 
            ams.ams_id,
            ams.wo_id,
            ams.asset_id,
            ams.maint_type_id,
            ams.maintained_by,
            ams.status,
            b.branch_id
          FROM "tblAssetMaintSch" ams
          INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
          INNER JOIN "tblBranches" b ON a.branch_id = b.branch_id
          WHERE ams.org_id = 'ORG001' 
            AND a.org_id = 'ORG001' 
            AND b.org_id = 'ORG001' 
            AND ams.status = 'IN' 
            AND ams.wo_id IS NOT NULL
            AND (
              ams.maintained_by = 'Vendor'
              OR
              ams.maint_type_id = 'MT004'
            )
          ORDER BY ams.created_on DESC
          LIMIT 10
        `;
        
        const woResultNoBranch = await db.query(woQueryNoBranch);
        console.log(`Work order query WITHOUT branch filter returns ${woResultNoBranch.rows.length} records\n`);
      }
    }
    
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkWorkOrderData();
