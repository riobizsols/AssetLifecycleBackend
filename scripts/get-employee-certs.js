const pool = require('../config/db');

(async () => {
  try {
    const empId = process.argv[2] || 'EMP_INT_0001';
    const res = await pool.query(
      `SELECT etc.* , tc.certificate_name, tc.certificate_no FROM "tblEmpTechCert" etc
       LEFT JOIN "tblTechCert" tc ON etc.tc_id = tc.tc_id
       WHERE etc.emp_int_id = $1`,
      [empId]
    );
    console.log(`Employee ${empId} certificates: ${res.rows.length}`);
    console.dir(res.rows, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('Error querying tblEmpTechCert:', err.message || err);
    process.exit(2);
  }
})();
