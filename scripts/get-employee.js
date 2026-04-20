const pool = require('../config/db');

(async () => {
  try {
    const empId = process.argv[2] || 'EMP_INT_0001';
    const res = await pool.query('SELECT emp_int_id, full_name, org_id, email_id FROM "tblEmployees" WHERE emp_int_id = $1', [empId]);
    console.log(`Employee query returned ${res.rows.length} row(s):`);
    console.dir(res.rows, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('Error querying tblEmployees:', err.message || err);
    process.exit(2);
  }
})();
