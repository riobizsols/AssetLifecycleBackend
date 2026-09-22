/**
 * Upload Bus Maintenance Certificate PDF via live NGP API (uses server MinIO).
 * Usage: node scripts/upload-bus-tech-cert-via-api.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');

const API = process.env.NGP_API_BASE || 'https://ngp.rioassetmanagement.net/api';
const EMAIL = process.env.NGP_ADMIN_EMAIL || 'ngp.group.admin@ngp.com';
const PASSWORD = process.env.NGP_ADMIN_PASSWORD || process.env.TEST_USERS_PASSWORD || 'password123';
const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const CERT_NAME = 'Bus Maintenance Certificate';
const CERT_NO = 'BUS-MAINT-001';
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

async function api(pathname, { method = 'GET', token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${pathname}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.message || json.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  let emp;
  let tc;
  let etc;
  try {
    emp = (
      await client.query(
        `
        SELECT emp_int_id, employee_id, full_name, email_id
          FROM "tblEmployees"
         WHERE org_id = $1
           AND (
             LOWER(TRIM(full_name)) = LOWER($2)
             OR LOWER(TRIM(email_id)) LIKE 'ngp.bus.technician@ngp%'
           )
         ORDER BY emp_int_id
         LIMIT 1
        `,
        [ORG, TECH_NAME],
      )
    ).rows[0];
    if (!emp) throw new Error('Bus technician employee not found');

    tc = (
      await client.query(
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
      )
    ).rows[0];
    if (!tc) throw new Error('Bus Maintenance Certificate catalog row not found');

    etc = (
      await client.query(
        `
        SELECT etc_id, file_path, certificate_date, certificate_expiry, status
          FROM "tblEmpTechCert"
         WHERE emp_int_id = $1 AND tc_id = $2
         ORDER BY etc_id
         LIMIT 1
        `,
        [emp.emp_int_id, tc.tc_id],
      )
    ).rows[0];
  } finally {
    client.release();
    await pool.end();
  }

  const issued = etc?.certificate_date || new Date().toISOString().slice(0, 10);
  const expires = etc?.certificate_expiry || '2029-09-22';
  const pdf = await buildCertificatePdf({
    employeeName: emp.full_name || TECH_NAME,
    employeeId: emp.employee_id || emp.emp_int_id,
    certName: tc.certificate_name || CERT_NAME,
    certNo: tc.certificate_no || CERT_NO,
    issued,
    expires,
  });

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.token || login.data?.token || login.accessToken;
  if (!token) throw new Error(`Login succeeded but no token: ${JSON.stringify(login).slice(0, 300)}`);

  if (etc?.etc_id) {
    try {
      await api(`/employee-tech-certificates/${etc.etc_id}`, { method: 'DELETE', token });
      console.log('Deleted existing emp cert', etc.etc_id);
    } catch (err) {
      console.warn('Delete via API failed, continuing:', err.message);
    }
  }

  const form = new FormData();
  form.append('emp_int_id', emp.emp_int_id);
  form.append('tc_id', tc.tc_id);
  form.append('certificate_date', String(issued).slice(0, 10));
  form.append('certificate_expiry', String(expires).slice(0, 10));
  form.append(
    'file',
    new Blob([pdf], { type: 'application/pdf' }),
    `Bus_Maintenance_Certificate_${crypto.randomBytes(4).toString('hex')}.pdf`,
  );

  const created = await api('/employee-tech-certificates', {
    method: 'POST',
    token,
    formData: form,
  });
  const createdId = created.data?.etc_id || created.data?.id || created.etc_id;
  if (!createdId) throw new Error(`Create response missing id: ${JSON.stringify(created).slice(0, 400)}`);

  const approved = await api(`/employee-tech-certificates/${createdId}/status`, {
    method: 'PUT',
    token,
    body: { status: 'Approved' },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        api: API,
        emp_int_id: emp.emp_int_id,
        etc_id: createdId,
        file_path: approved.data?.file_path || created.data?.file_path || null,
        status: approved.data?.status || 'Approved',
      },
      null,
      2,
    ),
  );
})().catch((err) => {
  console.error('FAILED:', err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exitCode = 1;
});
