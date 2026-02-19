const db = require('./config/db');

async function run() {
  try {
    const vendorId = process.argv[2] || 'V002';
    console.log('Checking vendor:', vendorId);
    const res = await db.query('SELECT * FROM "tblVendors" WHERE vendor_id = $1', [vendorId]);
    console.log('Rows:', res.rows.length);
    console.dir(res.rows[0], {depth: null});
  } catch (e) {
    console.error('Error querying vendor:', e.message);
    console.error(e);
  } finally {
    try { await db.end(); } catch (e) {}
    process.exit(0);
  }
}

run();
