/**
 * Export NGP (ORG003) + KMCH (ORG004) test-user credentials PDF from ngp_db.
 * Usage: node scripts/export-ngp-kmch-users-pdf.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const TEST_PASSWORD = process.env.TEST_USERS_PASSWORD || 'password123';
const ORGS = ['ORG003', 'ORG004'];

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function roleLabel(user) {
  const email = String(user.email || '').toLowerCase();
  const id = String(user.user_id || '');
  if (email.includes('group.admin')) return 'Global Admin';
  if (email.includes('org.admin')) return 'Organization Admins';
  // Branch admins: *.<branch>.admin@... (NGU2xx) or email ends with .admin before domain
  if (/^NGU2\d+/i.test(id) || /\.admin@/.test(email)) return 'Branch Admins';
  if (/^NGU3\d+/i.test(id)) return 'Department Admins';
  if (/^NGU1\d+/i.test(id)) return 'Organization Admins';
  return 'Other Users';
}

function accessDescription(user) {
  const label = user.roleLabel;
  if (label === 'Global Admin') return 'Write — All organizations, branches, and departments';
  if (label === 'Organization Admins') {
    return `Write — Organization ${user.org_id}${user.org_name ? ` (${user.org_name})` : ''}, all branches/departments`;
  }
  if (label === 'Branch Admins') {
    return `Write — Branch ${user.branch_id}${user.branch_name ? ` (${user.branch_name})` : ''} and its departments`;
  }
  if (label === 'Department Admins') {
    return `Write — Department ${user.dept_id}${user.dept_name ? ` (${user.dept_name})` : ''}`;
  }
  return `Write — ${user.org_id} / ${user.branch_id || '-'} / ${user.dept_id || '-'}`;
}

function displayName(user) {
  if (user.full_name && String(user.full_name).trim()) return String(user.full_name).trim();
  const local = String(user.email || '').split('@')[0] || user.user_id;
  return local
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function loadUsers(client) {
  const res = await client.query(
    `
    SELECT
      u.user_id,
      u.email,
      u.full_name,
      u.org_id,
      u.branch_id,
      u.dept_id,
      o.text AS org_name,
      b.text AS branch_name,
      d.text AS dept_name
    FROM "tblUsers" u
    LEFT JOIN "tblOrgs" o ON o.org_id = u.org_id
    LEFT JOIN "tblBranches" b ON b.branch_id = u.branch_id AND b.org_id = u.org_id
    LEFT JOIN "tblDepartments" d ON d.dept_id = u.dept_id AND d.org_id = u.org_id
    WHERE u.org_id = ANY($1::text[])
      AND u.user_id LIKE 'NGU%'
      AND u.email IS NOT NULL
      AND TRIM(u.email) <> ''
      AND COALESCE(u.int_status, 1) = 1
    ORDER BY u.user_id
    `,
    [ORGS],
  );
  return res.rows.map((row) => {
    const labeled = { ...row, roleLabel: roleLabel(row) };
    return labeled;
  });
}

function writeCredentialsPdf(users, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18).fillColor('#000000').text('NGP / KMCH ALM Test User Credentials', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444444');
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Database: ${TENANT_DB}`);
    doc.text(`Password for all accounts: ${TEST_PASSWORD}`);
    doc.moveDown();

    const sections = [
      { title: 'Global Admin', key: 'Global Admin' },
      { title: 'Organization Admins', key: 'Organization Admins' },
      { title: 'Branch Admins', key: 'Branch Admins' },
      { title: 'Department Admins', key: 'Department Admins' },
      { title: 'Other Users', key: 'Other Users' },
    ];

    let firstSection = true;
    for (const section of sections) {
      const sectionUsers = users.filter((u) => u.roleLabel === section.key);
      if (!sectionUsers.length) continue;

      if (!firstSection) doc.addPage();
      firstSection = false;

      doc.fillColor('#000000').fontSize(14).text(section.title, { underline: true });
      doc.moveDown(0.5);

      sectionUsers.forEach((user, index) => {
        if (doc.y > 700) doc.addPage();
        doc.fontSize(11).fillColor('#000000').text(`${index + 1}. ${displayName(user)}`);
        doc.fontSize(9).fillColor('#333333');
        doc.text(`User ID: ${user.user_id}`);
        doc.text(`Email: ${user.email}`);
        doc.text(`Password: ${TEST_PASSWORD}`);
        doc.text(`Home: ${user.org_id} / ${user.branch_id || '-'} / ${user.dept_id || '-'}`);
        doc.text(`Access: ${accessDescription(user)}`);
        doc.moveDown(0.45);
      });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  try {
    const users = (await loadUsers(client)).sort((a, b) => {
      const order = {
        'Global Admin': 0,
        'Organization Admins': 1,
        'Branch Admins': 2,
        'Department Admins': 3,
        'Other Users': 4,
      };
      return (
        order[a.roleLabel] - order[b.roleLabel] ||
        a.org_id.localeCompare(b.org_id) ||
        a.user_id.localeCompare(b.user_id)
      );
    });

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const pdfPath = path.join(downloadsDir, 'NGP-Users-Access.pdf');
    await writeCredentialsPdf(users, pdfPath);

    console.log(
      JSON.stringify(
        {
          ok: true,
          pdf_path: pdfPath,
          user_count: users.length,
          by_role: users.reduce((acc, u) => {
            acc[u.roleLabel] = (acc[u.roleLabel] || 0) + 1;
            return acc;
          }, {}),
          by_org: users.reduce((acc, u) => {
            acc[u.org_id] = (acc[u.org_id] || 0) + 1;
            return acc;
          }, {}),
          sample: users.slice(0, 8).map((u) => ({
            user_id: u.user_id,
            email: u.email,
            role: u.roleLabel,
          })),
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
