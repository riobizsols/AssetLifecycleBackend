const pool = require('../config/db');

(async () => {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tblATInspCerts'");
    console.log('Columns in tblATInspCerts:');
    console.dir(res.rows.map(r => r.column_name));
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
})();
