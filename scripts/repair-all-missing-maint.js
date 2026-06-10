require('dotenv').config();
const { Pool } = require('pg');
const { runWithDb } = require('../utils/dbContext');
const { createMaintenanceRecord } = require('../models/approvalDetailModel');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

runWithDb(pool, async () => {
  const rows = await pool.query(`
    SELECT wfh.wfamsh_id, wfh.org_id
    FROM "tblWFAssetMaintSch_H" wfh
    LEFT JOIN "tblAssetMaintSch" ams ON ams.wfamsh_id = wfh.wfamsh_id
    WHERE wfh.status = 'CO'
      AND wfh.maint_type_id != 'MT005'
      AND ams.ams_id IS NULL
    ORDER BY wfh.changed_on DESC
  `);

  console.log(`Found ${rows.rows.length} completed workflows missing maintenance rows`);
  for (const row of rows.rows) {
    try {
      const amsId = await createMaintenanceRecord(row.wfamsh_id, row.org_id);
      console.log(`OK ${row.wfamsh_id} -> ${amsId}`);
    } catch (e) {
      console.error(`FAIL ${row.wfamsh_id}:`, e.message);
    }
  }
  await pool.end();
}).catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
