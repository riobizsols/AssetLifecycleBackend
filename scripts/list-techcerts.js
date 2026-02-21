const pool = require('../config/db');

(async () => {
  try {
    const res = await pool.query('SELECT tc_id, certificate_name, certificate_no FROM "tblTechCert" LIMIT 20');
    console.log(`Found ${res.rows.length} tech certs`);
    console.dir(res.rows, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('Error querying tblTechCert:', err.message || err);
    process.exit(2);
  }
})();
