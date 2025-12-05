const { Client } = require('pg');
require('dotenv').config();

async function checkMaintenanceRecords() {
  // Use a direct client connection instead of pool to avoid pool exhaustion
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    await client.connect();
  } catch (error) {
    if (error.code === '53300') {
      console.error('❌ Database connection limit reached!');
      console.error('   Please close unused DBeaver connections and try again.');
      console.error('   Or wait a few moments for connections to timeout.');
      process.exit(1);
    }
    throw error;
  }
  
  try {
    console.log('🔍 Checking Maintenance Records in Database\n');
    console.log('='.repeat(70));
    
    // Check recent header records
    console.log('\n📋 RECENT MAINTENANCE HEADER RECORDS (tblWFAssetMaintSch_H):');
    console.log('-'.repeat(70));
    
    const headerQuery = `
      SELECT 
        wfamsh_id,
        at_main_freq_id,
        maint_type_id,
        asset_id,
        group_id,
        vendor_id,
        pl_sch_date,
        act_sch_date,
        status,
        org_id,
        created_by,
        created_on,
        changed_by,
        changed_on
      FROM "tblWFAssetMaintSch_H"
      ORDER BY created_on DESC
      LIMIT 20
    `;
    
    const headerResult = await client.query(headerQuery);
    
    if (headerResult.rows.length === 0) {
      console.log('❌ NO HEADER RECORDS FOUND!');
      console.log('   The maintenance cron may not have created any records.');
    } else {
      console.log(`✅ Found ${headerResult.rows.length} recent header records:\n`);
      
      headerResult.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. Header ID: ${row.wfamsh_id}`);
        console.log(`   - Asset ID: ${row.asset_id || 'NULL'}`);
        console.log(`   - Group ID: ${row.group_id || 'NULL'}`);
        console.log(`   - Maintenance Type: ${row.maint_type_id || 'NULL'}`);
        console.log(`   - Vendor ID: ${row.vendor_id || 'NULL'}`);
        console.log(`   - Planned Date: ${row.pl_sch_date || 'NULL'}`);
        console.log(`   - Actual Date: ${row.act_sch_date || 'NULL'}`);
        console.log(`   - Status: ${row.status || 'NULL'}`);
        console.log(`   - Org ID: ${row.org_id || 'NULL'}`);
        console.log(`   - Created By: ${row.created_by || 'NULL'}`);
        console.log(`   - Created On: ${row.created_on || 'NULL'}`);
        console.log('');
      });
      
      // Check details for each header
      console.log('\n📝 DETAIL RECORDS (tblWFAssetMaintSch_D):');
      console.log('-'.repeat(70));
      
      const headerIds = headerResult.rows.map(r => r.wfamsh_id);
      const placeholders = headerIds.map((_, i) => `$${i + 1}`).join(', ');
      
      const detailQuery = `
        SELECT 
          wfamsd_id,
          wfamsh_id,
          job_role_id,
          user_id,
          dept_id,
          sequence,
          status,
          notes,
          org_id,
          created_by,
          created_on,
          changed_by,
          changed_on
        FROM "tblWFAssetMaintSch_D"
        WHERE wfamsh_id IN (${placeholders})
        ORDER BY created_on DESC
      `;
      
      const detailResult = await client.query(detailQuery, headerIds);
      
      if (detailResult.rows.length === 0) {
        console.log('❌ NO DETAIL RECORDS FOUND!');
        console.log('   Headers exist but no details were created.');
        console.log('   This could mean:');
        console.log('   1. No job roles configured for workflow steps');
        console.log('   2. Workflow sequences not found');
        console.log('   3. Error during detail creation');
      } else {
        console.log(`✅ Found ${detailResult.rows.length} detail records:\n`);
        
        // Group details by header
        const detailsByHeader = {};
        detailResult.rows.forEach(row => {
          if (!detailsByHeader[row.wfamsh_id]) {
            detailsByHeader[row.wfamsh_id] = [];
          }
          detailsByHeader[row.wfamsh_id].push(row);
        });
        
        Object.keys(detailsByHeader).forEach(wfamshId => {
          const details = detailsByHeader[wfamshId];
          console.log(`Header: ${wfamshId} - ${details.length} detail(s):`);
          details.forEach((detail, idx) => {
            console.log(`  ${idx + 1}. Detail ID: ${detail.wfamsd_id}`);
            console.log(`     - Job Role: ${detail.job_role_id || 'NULL'}`);
            console.log(`     - User ID: ${detail.user_id || 'NULL'}`);
            console.log(`     - Dept ID: ${detail.dept_id || 'NULL'}`);
            console.log(`     - Sequence: ${detail.sequence || 'NULL'}`);
            console.log(`     - Status: ${detail.status || 'NULL'}`);
            console.log(`     - Created On: ${detail.created_on || 'NULL'}`);
          });
          console.log('');
        });
      }
      
      // Summary statistics
      console.log('\n📊 SUMMARY STATISTICS:');
      console.log('-'.repeat(70));
      
      const statsQuery = `
        SELECT 
          COUNT(*) as total_headers,
          COUNT(DISTINCT org_id) as orgs,
          COUNT(DISTINCT status) as statuses,
          MIN(created_on) as oldest,
          MAX(created_on) as newest
        FROM "tblWFAssetMaintSch_H"
      `;
      
      const statsResult = await client.query(statsQuery);
      const stats = statsResult.rows[0];
      
      console.log(`Total Headers: ${stats.total_headers}`);
      console.log(`Organizations: ${stats.orgs}`);
      console.log(`Unique Statuses: ${stats.statuses}`);
      console.log(`Oldest Record: ${stats.oldest || 'N/A'}`);
      console.log(`Newest Record: ${stats.newest || 'N/A'}`);
      
      const detailStatsQuery = `
        SELECT 
          COUNT(*) as total_details,
          COUNT(DISTINCT wfamsh_id) as headers_with_details,
          COUNT(DISTINCT status) as statuses
        FROM "tblWFAssetMaintSch_D"
      `;
      
      const detailStatsResult = await client.query(detailStatsQuery);
      const detailStats = detailStatsResult.rows[0];
      
      console.log(`\nTotal Details: ${detailStats.total_details}`);
      console.log(`Headers with Details: ${detailStats.headers_with_details}`);
      console.log(`Detail Statuses: ${detailStats.statuses}`);
      
      // Check for headers without details
      const orphanQuery = `
        SELECT COUNT(*) as count
        FROM "tblWFAssetMaintSch_H" h
        LEFT JOIN "tblWFAssetMaintSch_D" d ON h.wfamsh_id = d.wfamsh_id
        WHERE d.wfamsh_id IS NULL
      `;
      
      const orphanResult = await client.query(orphanQuery);
      const orphanCount = parseInt(orphanResult.rows[0].count);
      
      if (orphanCount > 0) {
        console.log(`\n⚠️  WARNING: ${orphanCount} header(s) without any details!`);
        console.log('   These headers may have failed detail creation.');
      } else {
        console.log(`\n✅ All headers have at least one detail record.`);
      }
    }
    
    // Check records created today
    console.log('\n📅 RECORDS CREATED TODAY:');
    console.log('-'.repeat(70));
    
    const todayQuery = `
      SELECT 
        COUNT(*) as count,
        'Header' as type
      FROM "tblWFAssetMaintSch_H"
      WHERE DATE(created_on) = CURRENT_DATE
      UNION ALL
      SELECT 
        COUNT(*) as count,
        'Detail' as type
      FROM "tblWFAssetMaintSch_D"
      WHERE DATE(created_on) = CURRENT_DATE
    `;
    
    const todayResult = await client.query(todayQuery);
    
    todayResult.rows.forEach(row => {
      console.log(`${row.type}: ${row.count} record(s)`);
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Error checking maintenance records:', error);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

checkMaintenanceRecords().catch(console.error);

