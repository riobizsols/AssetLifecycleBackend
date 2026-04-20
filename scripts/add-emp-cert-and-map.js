const pool = require('../config/db');
const EmployeeTechCertModel = require('../models/employeeTechCertModel');
const { generateCustomId } = require('../utils/idGenerator');

(async () => {
  try {
    const empId = process.argv[2] || 'EMP_INT_0001';
    const assetType = process.argv[3] || 'AT002';
    const aaticToUse = process.argv[4] || null; // optional: specific aatic_id
    const tcIdToUse = process.argv[5] || 'TCERT006';
    const createdBy = process.argv[6] || 'USR001';

    // 1. Create employee tech cert (will generate etc_id)
    console.log(`Creating employee tech cert for ${empId} with tc_id ${tcIdToUse}...`);
    const cert = await EmployeeTechCertModel.createEmployeeCertificate({
      empIntId: empId,
      tcId: tcIdToUse,
      certificateDate: new Date().toISOString().split('T')[0],
      certificateExpiry: null,
      filePath: null,
      status: 'Approved',
      createdBy: createdBy,
      orgId: 'ORG001'
    });

    console.log('Created etc:', cert);

    // 2. Determine aatic_id for assetType
    let aaticId = aaticToUse;
    if (!aaticId) {
      const res = await pool.query('SELECT aatic_id FROM "tblAATInspCheckList" WHERE at_id = $1 LIMIT 1', [assetType]);
      if (res.rows.length === 0) {
        throw new Error(`No aatic_id mapping found for asset type ${assetType}`);
      }
      aaticId = res.rows[0].aatic_id;
    }

    console.log(`Using aatic_id ${aaticId} for asset type ${assetType}`);

    // 3. Generate ATIC_id for tblATInspCerts
    const aticId = await generateCustomId('atic', 3);

    // 4. Insert mapping into tblATInspCerts
    const insertQuery = `INSERT INTO "tblATInspCerts" (atic_id,aatic_id,tc_id,created_by,created_on) VALUES ($1,$2,$3,$4,NOW()) RETURNING atic_id`;
    const insertRes = await pool.query(insertQuery, [aticId, aaticId, tcIdToUse, createdBy]);

    console.log('Inserted tblATInspCerts row:', insertRes.rows[0]);

    // 5. Verify by running the certified SQL for the assetType
    console.log('Verifying certified technicians for', assetType);
    const verifyQuery = `
      SELECT DISTINCT e.emp_int_id, e.full_name, e.email_id, tc.tc_id, tc.certificate_name
      FROM "tblATInspCerts" atic
      INNER JOIN "tblTechCert" tc ON atic.tc_id = tc.tc_id
      INNER JOIN "tblEmpTechCert" etc ON tc.tc_id = etc.tc_id
      INNER JOIN "tblEmployees" e ON etc.emp_int_id = e.emp_int_id
      INNER JOIN "tblAATInspCheckList" aatic ON atic.aatic_id = aatic.aatic_id
      WHERE aatic.at_id = $1 AND e.org_id = $2 AND (etc.status IS NULL OR etc.status IN ('Approved','Confirmed'))
    `;

    const verifyRes = await pool.query(verifyQuery, [assetType, 'ORG001']);
    console.log('Verification rows:', verifyRes.rows.length);
    console.dir(verifyRes.rows, { depth: null });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    console.error(err.stack);
    process.exit(2);
  }
})();
