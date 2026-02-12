require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function checkScrapHistory() {
  try {
    console.log('Connecting to database...');
    
    // Check if tblScrapAssetHist table exists and has data
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count FROM "tblScrapAssetHist"
    `);
    console.log(`\nTotal records in tblScrapAssetHist: ${tableCheck.rows[0].count}`);
    
    // Show sample records
    const sampleRecords = await pool.query(`
      SELECT * FROM "tblScrapAssetHist" LIMIT 5
    `);
    console.log('\nSample records from tblScrapAssetHist:');
    console.log(JSON.stringify(sampleRecords.rows, null, 2));
    
    // Check workflow headers
    const workflowCheck = await pool.query(`
      SELECT id_d, wfscrapseq_id, created_on, created_by 
      FROM "tblWFScrap_H" 
      ORDER BY created_on DESC 
      LIMIT 5
    `);
    console.log('\nRecent scrap workflows:');
    console.log(JSON.stringify(workflowCheck.rows, null, 2));
    
    // Check if the specific workflow WFSCH013 exists
    const specificWorkflow = await pool.query(`
      SELECT * FROM "tblWFScrap_H" WHERE id_d = $1
    `, ['WFSCH013']);
    console.log('\nWorkflow WFSCH013:');
    console.log(JSON.stringify(specificWorkflow.rows, null, 2));
    
    // Check workflow details for WFSCH013
    const workflowDetails = await pool.query(`
      SELECT * FROM "tblWFScrap_D" WHERE wfscrap_h_id = $1
    `, ['WFSCH013']);
    console.log('\nWorkflow details for WFSCH013:');
    console.log(JSON.stringify(workflowDetails.rows, null, 2));
    
    // Check history for WFSCH013
    const historyForWF = await pool.query(`
      SELECT 
        wh.scraphis_id,
        wh.wfscrap_h_id,
        wh.wfscrap_d_id,
        wh.action_by,
        wh.action_on,
        wh.action,
        wh.notes
      FROM "tblScrapAssetHist" wh
      INNER JOIN "tblWFScrap_D" wfd ON wh.wfscrap_d_id = wfd.id
      WHERE wfd.wfscrap_h_id = $1
      ORDER BY wh.action_on ASC
    `, ['WFSCH013']);
    console.log('\nHistory for workflow WFSCH013:');
    console.log(JSON.stringify(historyForWF.rows, null, 2));
    
    console.log('\n✓ Check complete');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkScrapHistory();
