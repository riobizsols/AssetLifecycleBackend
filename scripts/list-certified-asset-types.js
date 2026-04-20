#!/usr/bin/env node
const { getDbFromContext } = require('../utils/dbContext');

(async function() {
  try {
    const db = getDbFromContext();

    const query = `
      SELECT
        aat.at_id AS asset_type_id,
        at.text AS asset_type_name,
        COUNT(DISTINCT etc.emp_int_id) AS certified_technician_count
      FROM "tblATInspCerts" atic
      INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
      INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
      INNER JOIN "tblAATInspCheckList" aat ON atic.aatic_id = aat.aatic_id
      LEFT JOIN "tblAssetTypes" at ON aat.at_id = at.asset_type_id
      WHERE (etc.status IS NULL OR etc.status IN ('Approved','Confirmed'))
      GROUP BY aat.at_id, at.text
      ORDER BY certified_technician_count DESC, at.text;
    `;

    const res = await db.query(query);
    if (!res || !res.rows) {
      console.log('No data returned');
      process.exit(0);
    }

    console.log('Asset types with certified technicians:');
    for (const row of res.rows) {
      console.log(`- ${row.asset_type_id || '<unknown>'} : ${row.asset_type_name || '<no name>'} -> ${row.certified_technician_count} technicians`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error listing certified asset types:', err.message || err);
    process.exit(2);
  }
})();
