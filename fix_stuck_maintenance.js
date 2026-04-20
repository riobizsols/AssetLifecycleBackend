const pool = require('./config/db');

async function fixStuckStatus() {
  try {
    console.log('--- Searching for stuck maintenance records ---');
    // Find all confirmed breakdowns
    const confirmedBR = await pool.query(`
      SELECT abr_id, asset_id, org_id FROM "tblAssetBRDet" WHERE status = 'CF'
    `);
    
    console.log(`Found ${confirmedBR.rows.length} confirmed breakdowns.`);
    
    for (const br of confirmedBR.rows) {
      const { abr_id, asset_id, org_id } = br;
      
      // Look for linked wfamsh_id
      const wfRef = await pool.query(`
        SELECT wfamsh_id FROM "tblWFAssetMaintSch_D" 
        WHERE org_id = $1 AND (notes ILIKE $2 OR notes ILIKE $3)
        LIMIT 1
      `, [org_id, `%${abr_id}%`, `%Breakdown-${abr_id}%`]);
      
      const wfamsh_id = wfRef.rows[0]?.wfamsh_id;
      
      if (wfamsh_id) {
        const updateHeader = await pool.query(`
          UPDATE "tblWFAssetMaintSch_H" SET status = 'CO' WHERE wfamsh_id = $1 AND status != 'CO'
        `, [wfamsh_id]);
        
        if (updateHeader.rowCount > 0) {
           console.log(`Fixed stuck workflow header ${wfamsh_id} for breakdown ${abr_id}`);
        }
      }
      
      const updateSchedules = await pool.query(`
        UPDATE "tblAssetMaintSch" SET status = 'CO' 
        WHERE org_id = $1 AND status IN ('IP', 'IN', 'AP') 
        AND (asset_id = $2 AND (notes ILIKE $3 OR wo_id ILIKE $3))
      `, [org_id, asset_id, `%${abr_id}%`]);
      
      if (updateSchedules.rowCount > 0) {
        console.log(`Fixed stuck maintenance schedule for breakdown ${abr_id}`);
      }
    }
    
    console.log('--- Done ---');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

fixStuckStatus();
