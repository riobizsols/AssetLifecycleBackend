require('dotenv').config();

const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const TEST_PASSWORD = process.env.TEST_USERS_PASSWORD || 'password123';
const CREATED_BY = 'USR001';
const ROLE_ID = 'JR001';

const EMAIL_DOMAIN = '@bannari';

const ORG_EMAIL_BY_ID = {
  BAN001: 'bannari.edu.admin@bannari',
  BAN002: 'bannari.sugar.admin@bannari',
  BAN003: 'bannari.distillery.admin@bannari',
  BAN004: 'bannari.exports.admin@bannari',
  BAN005: 'bannari.granite.admin@bannari',
};

const BRANCH_EMAIL_BY_ID = {
  BNB001: 'bannari.edu.bit.admin@bannari',
  BNB002: 'bannari.edu.vidya.admin@bannari',
  BNB003: 'bannari.edu.publicschool.admin@bannari',
  BNB004: 'bannari.sugar.unit1.admin@bannari',
  BNB005: 'bannari.sugar.unit2.admin@bannari',
  BNB006: 'bannari.sugar.unit3.admin@bannari',
  BNB007: 'bannari.distillery.bhavani.admin@bannari',
  BNB008: 'bannari.distillery.nanjangud.admin@bannari',
  BNB009: 'bannari.distillery.kolundampattu.admin@bannari',
  BNB010: 'bannari.exports.chennai.admin@bannari',
  BNB011: 'bannari.exports.coimbatore.admin@bannari',
  BNB012: 'bannari.exports.logistics.admin@bannari',
  BNB013: 'bannari.granite.processing.admin@bannari',
  BNB014: 'bannari.granite.quarry.admin@bannari',
  BNB015: 'bannari.granite.dispatch.admin@bannari',
};

const DEPT_EMAIL_BY_ID = {
  BND0001: 'bannari.edu.bit.cse@bannari',
  BND0002: 'bannari.edu.bit.ece@bannari',
  BND0003: 'bannari.edu.bit.mechanical@bannari',
  BND0004: 'bannari.edu.bit.aids@bannari',
  BND0005: 'bannari.edu.vidya.primary@bannari',
  BND0006: 'bannari.edu.vidya.secondary@bannari',
  BND0007: 'bannari.edu.vidya.studentservices@bannari',
  BND0008: 'bannari.edu.public.primary@bannari',
  BND0009: 'bannari.edu.public.middleschool@bannari',
  BND0010: 'bannari.edu.public.admin@bannari',
  BND0011: 'bannari.sugar.unit1.production@bannari',
  BND0012: 'bannari.sugar.unit1.qc@bannari',
  BND0013: 'bannari.sugar.unit1.maintenance@bannari',
  BND0014: 'bannari.sugar.unit2.production@bannari',
  BND0015: 'bannari.sugar.unit2.qc@bannari',
  BND0016: 'bannari.sugar.unit2.maintenance@bannari',
  BND0017: 'bannari.sugar.unit3.production@bannari',
  BND0018: 'bannari.sugar.unit3.qc@bannari',
  BND0019: 'bannari.sugar.unit3.maintenance@bannari',
  BND0020: 'bannari.distillery.bhavani.production@bannari',
  BND0021: 'bannari.distillery.bhavani.qc@bannari',
  BND0022: 'bannari.distillery.bhavani.maintenance@bannari',
  BND0023: 'bannari.distillery.nanjangud.production@bannari',
  BND0024: 'bannari.distillery.nanjangud.qc@bannari',
  BND0025: 'bannari.distillery.nanjangud.power@bannari',
  BND0026: 'bannari.distillery.kolundampattu.prod@bannari',
  BND0027: 'bannari.distillery.kolundampattu.qc@bannari',
  BND0028: 'bannari.distillery.kolundampattu.maint@bannari',
  BND0029: 'bannari.exports.chennai.sales@bannari',
  BND0030: 'bannari.exports.chennai.customs@bannari',
  BND0031: 'bannari.exports.chennai.finance@bannari',
  BND0032: 'bannari.exports.coimbatore.sourcing@bannari',
  BND0033: 'bannari.exports.coimbatore.quality@bannari',
  BND0034: 'bannari.exports.coimbatore.finance@bannari',
  BND0035: 'bannari.exports.logistics.freight@bannari',
  BND0036: 'bannari.exports.logistics.warehouse@bannari',
  BND0037: 'bannari.exports.logistics.compliance@bannari',
  BND0038: 'bannari.granite.processing.production@bannari',
  BND0039: 'bannari.granite.processing.qc@bannari',
  BND0040: 'bannari.granite.processing.maintenance@bannari',
  BND0041: 'bannari.granite.quarry.production@bannari',
  BND0042: 'bannari.granite.quarry.maintenance@bannari',
  BND0043: 'bannari.granite.quarry.safety@bannari',
  BND0044: 'bannari.granite.dispatch.sales@bannari',
  BND0045: 'bannari.granite.dispatch.warehouse@bannari',
  BND0046: 'bannari.granite.dispatch.quality@bannari',
};

function assertEmailLength(email) {
  if (email.length > 50) {
    throw new Error(`Email exceeds 50 characters: ${email}`);
  }
  return email;
}

function trimText(value, maxLength = 50) {
  return String(value || '').trim().slice(0, maxLength);
}

function slugify(value, maxLength = 48) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, maxLength);
}

function orgShortName(orgText) {
  const text = String(orgText || '').toLowerCase();
  if (text.includes('educational') || text.includes('institutions')) return 'education';
  if (text.includes('sugars')) return 'sugar';
  if (text.includes('distillery')) return 'distillery';
  if (text.includes('exports')) return 'exports';
  if (text.includes('granite')) return 'granite';
  return slugify(orgText, 20);
}

function branchShortName(branchText) {
  const text = String(branchText || '');
  if (/unit i/i.test(text)) return 'unit1';
  if (/unit ii/i.test(text)) return 'unit2';
  if (/unit iii/i.test(text)) return 'unit3';
  if (/unit iv/i.test(text)) return 'unit4';
  return slugify(text, 24);
}

function accessDescription(scope, orgName, branchName, deptName) {
  if (scope.orgId === '*' && scope.branchId === '*' && scope.deptId === '*') {
    return 'All organizations, branches, and departments';
  }
  if (scope.branchId === '*' && scope.deptId === '*') {
    return `All branches and departments in ${orgName}`;
  }
  if (scope.deptId === '*') {
    return `All departments in ${branchName} (${orgName})`;
  }
  return `${deptName} in ${branchName} (${orgName})`;
}

function buildUserDefinitions(structure) {
  const users = [];

  users.push({
    userId: 'BNU100',
    fullName: trimText('Bannari Amman Admin'),
    email: assertEmailLength('bannari.amman.admin@bannari'),
    accessLevel: 'Write',
    scope: { orgId: '*', branchId: '*', deptId: '*' },
    homeOrgId: structure.orgs[0].org_id,
    homeBranchId: structure.branches[0].branch_id,
    homeDeptId: structure.depts[0].dept_id,
    roleLabel: 'Global Admin',
    orgName: 'All Organizations',
    branchName: 'All Branches',
    deptName: 'All Departments',
  });

  structure.orgs.forEach((org, index) => {
    const firstBranch = structure.branches.find((branch) => branch.org_id === org.org_id);
    const firstDept = structure.depts.find(
      (dept) => dept.org_id === org.org_id && dept.branch_id === firstBranch?.branch_id,
    );
    users.push({
      userId: `BNU1${String(index + 1).padStart(2, '0')}`,
      fullName: trimText(`${org.text} Admin`),
      email: assertEmailLength(ORG_EMAIL_BY_ID[org.org_id]),
      accessLevel: 'Write',
      scope: { orgId: org.org_id, branchId: '*', deptId: '*' },
      homeOrgId: org.org_id,
      homeBranchId: firstBranch.branch_id,
      homeDeptId: firstDept.dept_id,
      roleLabel: 'Organization Admin',
      orgName: org.text,
      branchName: 'All Branches',
      deptName: 'All Departments',
    });
  });

  structure.branches.forEach((branch, index) => {
    const org = structure.orgs.find((item) => item.org_id === branch.org_id);
    const firstDept = structure.depts.find(
      (dept) => dept.org_id === branch.org_id && dept.branch_id === branch.branch_id,
    );
    users.push({
      userId: `BNU2${String(index + 1).padStart(2, '0')}`,
      fullName: trimText(`${branch.text} Admin`),
      email: assertEmailLength(BRANCH_EMAIL_BY_ID[branch.branch_id]),
      accessLevel: 'Write',
      scope: { orgId: branch.org_id, branchId: branch.branch_id, deptId: '*' },
      homeOrgId: branch.org_id,
      homeBranchId: branch.branch_id,
      homeDeptId: firstDept.dept_id,
      roleLabel: 'Branch Admin',
      orgName: org.text,
      branchName: branch.text,
      deptName: 'All Departments',
    });
  });

  structure.depts.forEach((dept, index) => {
    const org = structure.orgs.find((item) => item.org_id === dept.org_id);
    const branch = structure.branches.find((item) => item.branch_id === dept.branch_id);
    users.push({
      userId: `BNU3${String(index + 1).padStart(2, '0')}`,
      fullName: trimText(`${dept.text} Admin`),
      email: assertEmailLength(DEPT_EMAIL_BY_ID[dept.dept_id]),
      accessLevel: 'Write',
      scope: { orgId: dept.org_id, branchId: dept.branch_id, deptId: dept.dept_id },
      homeOrgId: dept.org_id,
      homeBranchId: dept.branch_id,
      homeDeptId: dept.dept_id,
      roleLabel: 'Department Admin',
      orgName: org.text,
      branchName: branch.text,
      deptName: dept.text,
    });
  });

  return users;
}

async function loadStructure(client) {
  const [orgs, branches, depts] = await Promise.all([
    client.query(`
      select org_id, text
      from "tblOrgs"
      where org_id like 'BAN%'
      order by org_id
    `),
    client.query(`
      select org_id, branch_id, text
      from "tblBranches"
      where org_id like 'BAN%' and int_status = 1
      order by org_id, branch_id
    `),
    client.query(`
      select org_id, branch_id, dept_id, text
      from "tblDepartments"
      where org_id like 'BAN%' and int_status = 1
      order by org_id, branch_id, dept_id
    `),
  ]);

  return {
    orgs: orgs.rows,
    branches: branches.rows,
    depts: depts.rows,
  };
}

async function upsertUser(client, user, passwordHash) {
  const existing = await client.query(
    `select user_id, email from "tblUsers" where user_id = $1 limit 1`,
    [user.userId],
  );
  const targetUserId = existing.rows[0]?.user_id || user.userId;

  const emailConflict = await client.query(
    `select user_id from "tblUsers" where lower(email) = lower($1) and user_id <> $2 limit 1`,
    [user.email, targetUserId],
  );
  if (emailConflict.rows[0]) {
    throw new Error(`Email ${user.email} is already used by ${emailConflict.rows[0].user_id}`);
  }

  if (existing.rows[0]) {
    await client.query(
      `
        update "tblUsers"
           set full_name = $1,
               email = $2,
               password = $3,
               org_id = $4,
               branch_id = $5,
               dept_id = $6,
               job_role_id = $7,
               int_status = 1,
               changed_by = $8,
               changed_on = current_date
         where user_id = $9
      `,
      [
        user.fullName,
        user.email,
        passwordHash,
        user.homeOrgId,
        user.homeBranchId,
        user.homeDeptId,
        ROLE_ID,
        CREATED_BY,
        targetUserId,
      ],
    );
  } else {
    await client.query(
      `
        insert into "tblUsers" (
          org_id, user_id, full_name, email, phone, job_role_id, password,
          created_by, created_on, changed_by, changed_on, time_zone,
          date_format, language_code, int_status, dept_id, branch_id
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, current_date, $8, current_date, 'IST',
          'YYYY-MM-DD', 'EN', 1, $9, $10
        )
      `,
      [
        user.homeOrgId,
        targetUserId,
        user.fullName,
        user.email,
        null,
        ROLE_ID,
        passwordHash,
        CREATED_BY,
        user.homeDeptId,
        user.homeBranchId,
      ],
    );
  }

  await client.query(`delete from "tblACM" where user_id = $1`, [targetUserId]);
  await client.query(
    `
      insert into "tblACM" (
        acm_id, user_id, access_level, org_id, branch_id, dept_id,
        int_status, created_by, created_on, changed_by, changed_on
      ) values (
        $1, $2, $3, $4, $5, $6,
        1, $7, current_timestamp, $7, current_timestamp
      )
    `,
    [
      `ACM_${targetUserId}`,
      targetUserId,
      user.accessLevel,
      user.scope.orgId,
      user.scope.branchId,
      user.scope.deptId,
      CREATED_BY,
    ],
  );

  const roleLink = await client.query(
    `select 1 from "tblUserJobRoles" where user_id = $1 and job_role_id = $2 limit 1`,
    [targetUserId, ROLE_ID],
  );
  if (!roleLink.rows.length) {
    await client.query(
      `
        insert into "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
        values ($1, $2, $3)
      `,
      [`UJR_${targetUserId}`, targetUserId, ROLE_ID],
    );
  }

  return {
    ...user,
    userId: targetUserId,
    accessDescription: accessDescription(
      user.scope,
      user.orgName,
      user.branchName,
      user.deptName,
    ),
  };
}

function writeCredentialsPdf(users, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);
    doc.fontSize(18).text('Bannari ALM Test User Credentials', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#444444').text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Password for all accounts: ${TEST_PASSWORD}`);
    doc.moveDown();

    const sections = [
      { title: 'Global Admin', filter: (user) => user.roleLabel === 'Global Admin' },
      { title: 'Organization Admins', filter: (user) => user.roleLabel === 'Organization Admin' },
      { title: 'Branch Admins', filter: (user) => user.roleLabel === 'Branch Admin' },
      { title: 'Department Admins', filter: (user) => user.roleLabel === 'Department Admin' },
    ];

    sections.forEach((section, sectionIndex) => {
      const sectionUsers = users.filter(section.filter);
      if (!sectionUsers.length) return;

      if (sectionIndex > 0) doc.addPage();
      doc.fillColor('#000000').fontSize(14).text(section.title, { underline: true });
      doc.moveDown(0.5);

      sectionUsers.forEach((user, index) => {
        if (doc.y > 720) doc.addPage();
        doc.fontSize(11).fillColor('#000000').text(`${index + 1}. ${user.fullName}`);
        doc.fontSize(9).fillColor('#333333');
        doc.text(`Email: ${user.email}`);
        doc.text(`Password: ${TEST_PASSWORD}`);
        doc.text(`Access: ${user.accessLevel} - ${user.accessDescription}`);
        doc.moveDown(0.4);
      });
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  let inTransaction = false;
  try {
    const database = (await client.query('select current_database() as name')).rows[0].name;
    if (database !== TARGET_DATABASE) {
      throw new Error(`Refusing to modify ${database}; expected ${TARGET_DATABASE}`);
    }

    const structure = await loadStructure(client);
    const userDefinitions = buildUserDefinitions(structure);
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const createdUsers = [];

    await client.query('begin');
    inTransaction = true;

    for (const user of userDefinitions) {
      createdUsers.push(await upsertUser(client, user, passwordHash));
    }

    await client.query('commit');
    inTransaction = false;

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const pdfPath = path.join(downloadsDir, 'Bannari-Users-Access.pdf');
    await writeCredentialsPdf(createdUsers, pdfPath);

    console.log(JSON.stringify({
      database,
      users_created_or_updated: createdUsers.length,
      breakdown: {
        global_admin: createdUsers.filter((user) => user.roleLabel === 'Global Admin').length,
        organization_admins: createdUsers.filter((user) => user.roleLabel === 'Organization Admin').length,
        branch_admins: createdUsers.filter((user) => user.roleLabel === 'Branch Admin').length,
        department_admins: createdUsers.filter((user) => user.roleLabel === 'Department Admin').length,
      },
      password: TEST_PASSWORD,
      pdf_path: pdfPath,
      sample_users: createdUsers.slice(0, 5).map((user) => ({
        full_name: user.fullName,
        email: user.email,
        access: user.accessDescription,
      })),
    }, null, 2));
  } catch (error) {
    if (inTransaction) {
      await client.query('rollback').catch(() => {});
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Bannari hierarchy user creation failed: ${error.message}`);
  process.exitCode = 1;
});
