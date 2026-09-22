/**
 * Attach a real PDF document to Bus Field Technician's Bus Maintenance Certificate.
 * Usage: node scripts/attach-bus-tech-cert-file.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const crypto = require('crypto');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');
const { uploadBuffer } = require('../utils/documentStorage');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const CERT_NAME = 'Bus Maintenance Certificate';
const CERT_NO = 'BUS-MAINT-001';
const TECH_EMAILS = ['ngp.bus.technician@ngp.com', 'ngp.bus.technician@ngp'];
const TECH_NAME = 'Bus Field Technician';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function buildCertificatePdf({ employeeName, employeeId, certName, certNo, issued, expires }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 54 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Certificate of Competency', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(certName, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(11).text('This certifies that', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(16).text(employeeName, { align: 'center', underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444444').text(`Employee ID: ${employeeId}`, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#000000').fontSize(11).text(
      'has successfully completed the required training and is authorized to perform bus maintenance work under NGP ALM.',
      { align: 'center' },
    );
    doc.moveDown(1.5);
    doc.fontSize(10);
    doc.text(`Certificate No: ${certNo}`);
    doc.text(`Issued: ${issued}`);
    doc.text(`Expires: ${expires}`);
    doc.text(`Organization: ${ORG}`);
    doc.moveDown(2);
    doc.fontSize(9).fillColor('#666666').text('Generated for ALM demo / test use.', { align: 'center' });
    doc.end();
  });
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();

  try {
    const emp = await client.query(
      `
      SELECT emp_int_id, employee_id, full_name, email_id
        FROM "tblEmployees"
       WHERE org_id = $1
         AND (
           LOWER(TRIM(full_name)) = LOWER($2)
           OR LOWER(TRIM(email_id)) = ANY($3::text[])
         )
       ORDER BY emp_int_id
       LIMIT 1
      `,
      [ORG, TECH_NAME, TECH_EMAILS],
    );
    if (!emp.rows[0]) throw new Error(`Technician not found for ${TECH_NAME}`);

    const tc = await client.query(
      `
      SELECT tc_id, certificate_name, certificate_no
        FROM "tblTechCert"
       WHERE (org_id = $1 OR org_id IS NULL)
         AND (
           LOWER(TRIM(certificate_name)) = LOWER($2)
           OR LOWER(TRIM(COALESCE(certificate_no,''))) = LOWER($3)
         )
       ORDER BY CASE WHEN org_id = $1 THEN 0 ELSE 1 END, tc_id
       LIMIT 1
      `,
      [ORG, CERT_NAME, CERT_NO],
    );
    if (!tc.rows[0]) throw new Error(`Tech cert not found: ${CERT_NAME}`);

    const etc = await client.query(
      `
      SELECT etc_id, file_path, certificate_date, certificate_expiry, status
        FROM "tblEmpTechCert"
       WHERE emp_int_id = $1 AND tc_id = $2
       ORDER BY etc_id
       LIMIT 1
      `,
      [emp.rows[0].emp_int_id, tc.rows[0].tc_id],
    );
    if (!etc.rows[0]) throw new Error(`Emp tech cert row missing for ${emp.rows[0].emp_int_id}`);

    const issued = etc.rows[0].certificate_date || new Date().toISOString().slice(0, 10);
    const expires = etc.rows[0].certificate_expiry || '2029-09-22';

    const pdf = await buildCertificatePdf({
      employeeName: emp.rows[0].full_name || TECH_NAME,
      employeeId: emp.rows[0].employee_id || emp.rows[0].emp_int_id,
      certName: tc.rows[0].certificate_name || CERT_NAME,
      certNo: tc.rows[0].certificate_no || CERT_NO,
      issued,
      expires,
    });

    const hash = crypto.randomBytes(8).toString('hex');
    const objectName = `${ORG}/employee-tech-certificates/${emp.rows[0].emp_int_id}/${Date.now()}_${hash}.pdf`;
    const filePath = await uploadBuffer({
      buffer: pdf,
      objectName,
      contentType: 'application/pdf',
    });
    if (!filePath) throw new Error('uploadBuffer returned null');

    // Ensure column exists (some tenants added it later)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "tblEmpTechCert" ADD COLUMN IF NOT EXISTS file_path character varying;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    await client.query(
      `UPDATE "tblEmpTechCert"
          SET file_path = $1,
              status = 'Approved'
        WHERE etc_id = $2`,
      [filePath, etc.rows[0].etc_id],
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          etc_id: etc.rows[0].etc_id,
          emp_int_id: emp.rows[0].emp_int_id,
          email: emp.rows[0].email_id,
          tc_id: tc.rows[0].tc_id,
          certificate: tc.rows[0].certificate_name,
          file_path: filePath,
          previous_file_path: etc.rows[0].file_path || null,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
});
