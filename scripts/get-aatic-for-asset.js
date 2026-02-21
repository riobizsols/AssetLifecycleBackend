const pool = require('../config/db');

(async () => {
  try {
    const assetTypeId = process.argv[2] || 'AT002';
    const res = await pool.query('SELECT aatic_id, at_id, org_id FROM "tblAATInspCheckList" WHERE at_id = $1 LIMIT 10', [assetTypeId]);
    console.log(`Found ${res.rows.length} mappings for ${assetTypeId}:`);
    console.dir(res.rows, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('Error querying tblAATInspCheckList:', err.message || err);
    process.exit(2);
  }
})();
