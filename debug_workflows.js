const pool = require('./config/db');

async function debugWorkflows() {
  try {
    console.log('=== Debugging Workflows for ASS023 ===');
    
    // Check what workflows exist for ASS023
    const workflowsQuery = `
      SELECT 
        wfh.wfamsh_id,
        wfh.asset_id,
        wfh.status as header_status,
        wfh.created_on,
        wfh.changed_on,
        wfh.pl_sch_date,
        wfh.act_sch_date,
        a.asset_type_id,
        at.text as asset_type_name,
        mt.text as maint_type_name
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON at.maint_type_id = mt.maint_type_id
      WHERE wfh.asset_id = 'ASS023' 
        AND wfh.org_id = 'ORG001'
      ORDER BY wfh.created_on ASC
    `;
    
    const result = await pool.query(workflowsQuery);
    console.log(`Found ${result.rows.length} workflows for ASS023:`);
    
    result.rows.forEach((workflow, index) => {
      console.log(`\n--- Workflow ${index + 1} ---`);
      console.log(`WFAMSH ID: ${workflow.wfamsh_id}`);
      console.log(`Asset ID: ${workflow.asset_id}`);
      console.log(`Status: ${workflow.header_status}`);
      console.log(`Created: ${workflow.created_on}`);
      console.log(`Planned Date: ${workflow.pl_sch_date}`);
      console.log(`Asset Type: ${workflow.asset_type_name}`);
      console.log(`Maintenance Type: ${workflow.maint_type_name}`);
    });
    
    // Check workflow details for each
    for (const workflow of result.rows) {
      console.log(`\n=== Details for ${workflow.wfamsh_id} ===`);
      
      const detailsQuery = `
        SELECT 
          wfd.wfamsd_id,
          wfd.user_id,
          wfd.sequence,
          wfd.status as detail_status,
          wfd.created_on,
          wfd.changed_on,
          CASE 
            WHEN u.full_name IS NOT NULL THEN u.full_name
            WHEN wfd.user_id LIKE 'EMP_INT_%' THEN u_emp.full_name
            ELSE 'Unknown User'
          END as user_name
        FROM "tblWFAssetMaintSch_D" wfd
        LEFT JOIN "tblUsers" u ON wfd.user_id = u.user_id
        LEFT JOIN "tblUsers" u_emp ON wfd.user_id = u_emp.emp_int_id
        WHERE wfd.wfamsh_id = $1 AND wfd.org_id = 'ORG001'
        ORDER BY wfd.sequence ASC
      `;
      
      const detailsResult = await pool.query(detailsQuery, [workflow.wfamsh_id]);
      console.log(`Found ${detailsResult.rows.length} detail records:`);
      
      detailsResult.rows.forEach((detail, index) => {
        console.log(`  Detail ${index + 1}: ${detail.user_name} (${detail.user_id}) - Sequence ${detail.sequence} - Status: ${detail.detail_status}`);
      });
    }
    
  } catch (error) {
    console.error('Error debugging workflows:', error);
  } finally {
    await pool.end();
  }
}

debugWorkflows();
