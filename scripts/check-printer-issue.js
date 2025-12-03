const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkPrinterIssue() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 DIAGNOSTIC: Checking Printer Dropdown Issue\n');
    console.log('='.repeat(60));
    
    // 1. Check user USR002 details
    console.log('\n1️⃣ Checking User USR002 Details:');
    const userQuery = `
      SELECT 
        u.user_id,
        u.user_name,
        u.org_id,
        u.branch_id,
        e.employee_id,
        e.job_role_id
      FROM "tblUsers" u
      LEFT JOIN "tblEmployees" e ON u.user_id = e.user_id
      WHERE u.user_id = 'USR002'
    `;
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User USR002 not found!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:');
    console.log('   - User ID:', user.user_id);
    console.log('   - User Name:', user.user_name);
    console.log('   - Org ID:', user.org_id);
    console.log('   - Branch ID:', user.branch_id || 'NULL ⚠️');
    console.log('   - Employee ID:', user.employee_id || 'NULL');
    console.log('   - Job Role ID:', user.job_role_id || 'NULL');
    
    const orgId = user.org_id;
    const branchId = user.branch_id;
    
    // 2. Check organization setting for printer_asset_type
    console.log('\n2️⃣ Checking Organization Setting (printer_asset_type):');
    const orgSettingQuery = `
      SELECT key, value
      FROM "tblOrgSettings"
      WHERE key = 'printer_asset_type'
      AND org_id = $1
    `;
    const orgSettingResult = await client.query(orgSettingQuery, [orgId]);
    
    if (orgSettingResult.rows.length === 0) {
      console.log('❌ Organization setting "printer_asset_type" NOT FOUND!');
      console.log('   This is required for the printer dropdown to work.');
      console.log('\n   💡 Solution: Add a setting in tblOrgSettings:');
      console.log('      key: "printer_asset_type"');
      console.log('      value: <asset_type_text> (e.g., "Printer", "Label Printer", etc.)');
      console.log('      org_id:', orgId);
    } else {
      const printerAssetType = orgSettingResult.rows[0].value;
      console.log('✅ Organization setting found:');
      console.log('   - Key:', orgSettingResult.rows[0].key);
      console.log('   - Value:', printerAssetType);
      
      // 3. Check if asset type exists
      console.log('\n3️⃣ Checking Asset Type:');
      const assetTypeQuery = `
        SELECT asset_type_id, text, description
        FROM "tblAssetTypes"
        WHERE text = $1
        AND org_id = $2
      `;
      const assetTypeResult = await client.query(assetTypeQuery, [printerAssetType, orgId]);
      
      if (assetTypeResult.rows.length === 0) {
        console.log('❌ Asset type with text "' + printerAssetType + '" NOT FOUND!');
        console.log('   The organization setting points to a non-existent asset type.');
      } else {
        const assetTypeId = assetTypeResult.rows[0].asset_type_id;
        console.log('✅ Asset type found:');
        console.log('   - Asset Type ID:', assetTypeId);
        console.log('   - Text:', assetTypeResult.rows[0].text);
        console.log('   - Description:', assetTypeResult.rows[0].description || 'N/A');
        
        // 4. Check printer assets
        console.log('\n4️⃣ Checking Printer Assets:');
        
        // 4a. All assets of this type (any branch)
        const allPrintersQuery = `
          SELECT 
            asset_id,
            text,
            branch_id,
            current_status,
            org_id
          FROM "tblAssets"
          WHERE asset_type_id = $1
          AND org_id = $2
          AND current_status != 'SCRAPPED'
          ORDER BY created_on DESC
        `;
        const allPrintersResult = await client.query(allPrintersQuery, [assetTypeId, orgId]);
        console.log(`   Total printer assets (all branches): ${allPrintersResult.rows.length}`);
        
        if (allPrintersResult.rows.length > 0) {
          console.log('   Sample printers:');
          allPrintersResult.rows.slice(0, 5).forEach(printer => {
            console.log(`   - ${printer.asset_id}: ${printer.text} (Branch: ${printer.branch_id || 'NULL'}, Status: ${printer.current_status})`);
          });
        }
        
        // 4b. Assets filtered by branch_id
        if (branchId) {
          const branchPrintersQuery = `
            SELECT 
              asset_id,
              text,
              branch_id,
              current_status
            FROM "tblAssets"
            WHERE asset_type_id = $1
            AND org_id = $2
            AND branch_id = $3
            AND current_status != 'SCRAPPED'
            ORDER BY created_on DESC
          `;
          const branchPrintersResult = await client.query(branchPrintersQuery, [assetTypeId, orgId, branchId]);
          console.log(`\n   Printer assets in user's branch (${branchId}): ${branchPrintersResult.rows.length}`);
          
          if (branchPrintersResult.rows.length === 0 && allPrintersResult.rows.length > 0) {
            console.log('   ⚠️ ISSUE FOUND: User has branch_id but no printers in that branch!');
            console.log('   💡 Solution options:');
            console.log('      1. Update printer assets to have branch_id =', branchId);
            console.log('      2. Update user to have branch_id = NULL (to see all printers)');
            console.log('      3. Modify query to show printers from all branches');
          }
        } else {
          console.log('\n   ⚠️ User has NULL branch_id - query requires branch_id!');
          console.log('   The current query filters by branch_id, so NULL will return no results.');
          console.log('   💡 Solution: Modify getPrinterAssets to handle NULL branch_id');
        }
      }
    }
    
    // 5. Check job role permissions
    console.log('\n5️⃣ Checking Job Role Permissions (JR001):');
    const jobRoleQuery = `
      SELECT 
        jr.job_role_id,
        jr.text as job_role_name,
        jrn.nav_id,
        n.text as nav_name,
        n.url
      FROM "tblJobRoles" jr
      LEFT JOIN "tblJobRoleNav" jrn ON jr.job_role_id = jrn.job_role_id
      LEFT JOIN "tblNav" n ON jrn.nav_id = n.nav_id
      WHERE jr.job_role_id = 'JR001'
      AND jr.org_id = $1
    `;
    const jobRoleResult = await client.query(jobRoleQuery, [orgId]);
    
    if (jobRoleResult.rows.length === 0) {
      console.log('❌ Job role JR001 not found!');
    } else {
      console.log('✅ Job role found:', jobRoleResult.rows[0].job_role_name);
      const navItems = jobRoleResult.rows.filter(r => r.nav_id);
      console.log(`   Navigation items: ${navItems.length}`);
      
      const hasSerialPrintAccess = navItems.some(nav => 
        nav.url && nav.url.includes('serial-number-print')
      );
      
      if (hasSerialPrintAccess) {
        console.log('   ✅ Has access to serial-number-print page');
      } else {
        console.log('   ⚠️ No navigation item found for serial-number-print');
        console.log('   Available nav items:');
        navItems.forEach(nav => {
          console.log(`      - ${nav.nav_name} (${nav.url || 'N/A'})`);
        });
      }
    }
    
    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY:');
    
    const issues = [];
    if (orgSettingResult.rows.length === 0) {
      issues.push('Missing organization setting: printer_asset_type');
    }
    if (!branchId && orgSettingResult.rows.length > 0) {
      issues.push('User has NULL branch_id but query requires it');
    }
    if (branchId && orgSettingResult.rows.length > 0) {
      const assetTypeId = assetTypeResult.rows[0]?.asset_type_id;
      if (assetTypeId) {
        const branchPrintersQuery = `
          SELECT COUNT(*) as count
          FROM "tblAssets"
          WHERE asset_type_id = $1
          AND org_id = $2
          AND branch_id = $3
          AND current_status != 'SCRAPPED'
        `;
        const branchCountResult = await client.query(branchPrintersQuery, [assetTypeId, orgId, branchId]);
        if (parseInt(branchCountResult.rows[0].count) === 0) {
          issues.push(`No printer assets in user's branch (${branchId})`);
        }
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ No obvious issues found. Check server logs for API errors.');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, idx) => {
        console.log(`   ${idx + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkPrinterIssue().catch(console.error);
