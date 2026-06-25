/**
 * Backfill tblAssetMaintSch for a completed workflow (CO) that has no maintenance row.
 * Usage: node scripts/repair-maint-record.js WFAMSH_133
 */
require('dotenv').config();
const { runWithDb } = require('../utils/dbContext');
const { Pool } = require('pg');
const { createMaintenanceRecord } = require('../models/approvalDetailModel');

const wfamshId = process.argv[2];
if (!wfamshId) {
  console.error('Usage: node scripts/repair-maint-record.js <WFAMSH_ID>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

runWithDb(pool, async () => {
  const header = await pool.query(
    'SELECT status, org_id FROM "tblWFAssetMaintSch_H" WHERE wfamsh_id = $1',
    [wfamshId]
  );
  if (!header.rows.length) {
    throw new Error(`Workflow not found: ${wfamshId}`);
  }
  const { status, org_id: orgId } = header.rows[0];
  if (status !== 'CO') {
    throw new Error(`Workflow ${wfamshId} is not completed (status=${status})`);
  }

  const existing = await pool.query(
    'SELECT ams_id FROM "tblAssetMaintSch" WHERE wfamsh_id = $1',
    [wfamshId]
  );
  if (existing.rows.length) {
    console.log(`Maintenance record already exists: ${existing.rows[0].ams_id}`);
    await pool.end();
    return;
  }

  const amsId = await createMaintenanceRecord(wfamshId, orgId);
  console.log(`Created maintenance record: ${amsId}`);
  await pool.end();
}).catch(async (err) => {
  console.error(err.message || err);
  await pool.end();
  process.exit(1);
});
