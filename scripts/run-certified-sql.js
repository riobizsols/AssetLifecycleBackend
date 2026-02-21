const pool = require('../config/db');

(async () => {
  try {
    const assetTypeId = process.argv[2] || 'AT002';
    const orgId = process.argv[3] || 'ORG001';

    const query = `
      SELECT DISTINCT
        e.emp_int_id,
        e.full_name,
        e.email_id,
        e.phone_number,
        tc.tc_id,
        tc.certificate_name as cert_name,
        tc.certificate_no as cert_number
      FROM "tblATInspCerts" atic
      INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
      INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
      INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
      INNER JOIN "tblAATInspCheckList" aatic ON atic.aatic_id = aatic.aatic_id
      WHERE aatic.at_id = $1
        AND e.org_id = $2
        AND e.int_status = 1
        AND (etc.status IS NULL OR etc.status IN ('Approved','Confirmed'))
      ORDER BY e.full_name;
    `;

    const res = await pool.query(query, [assetTypeId, orgId]);
    console.log('Rows:', res.rows.length);
    console.dir(res.rows, { depth: null });
    process.exit(0);
  } catch (err) {
    console.error('SQL error:', err.message || err);
    process.exit(2);
  }
})();
