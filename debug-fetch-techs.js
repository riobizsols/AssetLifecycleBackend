const pool = require('./config/db');

async function test() {
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
      tc.cert_name,
      tc.cert_number,
      tc.expiry_date
    FROM "tblATInspCerts" atic
    INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
    INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
    INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
    INNER JOIN "tblAATInspCheckList" aatic ON atic.aatic_id = aatic.aatic_id
    WHERE aatic.asset_type_id = $1
      AND e.org_id = $2
      AND e.int_status = 1
      AND (tc.expiry_date IS NULL OR tc.expiry_date > CURRENT_DATE)
    ORDER BY e.full_name;
    `;

    console.log('Executing query for assetTypeId=', assetTypeId, 'orgId=', orgId);
    const res = await pool.query(query, [assetTypeId, orgId]);
    console.log('Rows:', res.rows.length);
    console.dir(res.rows, {depth: 2});
  } catch (e) {
    console.error('Query error:', e.message);
    console.error(e);
  } finally {
    pool.end();
  }
}

test();
