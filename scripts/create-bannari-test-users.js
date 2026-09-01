require('dotenv').config();

const bcrypt = require('bcrypt');
const { Client } = require('pg');

const TEST_PASSWORD = process.env.TEST_USERS_PASSWORD;
const CREATED_BY = 'USR001';
const ROLE_ID = 'JR001';

const USER_DEFINITIONS = [
  {
    userId: 'BNU001',
    fullName: 'Bannari Read Only Viewer',
    email: 'bannari.viewer@example.com',
    accessLevel: 'Read',
    scope: { orgId: '*', branchId: '*', deptId: '*' },
    homeOrgId: 'BAN001',
  },
  {
    userId: 'BNU002',
    fullName: 'Education Organization Manager',
    email: 'bannari.education.admin@example.com',
    accessLevel: 'Write',
    scope: { orgId: 'BAN001', branchId: '*', deptId: '*' },
    homeOrgId: 'BAN001',
  },
  {
    userId: 'BNU003',
    fullName: 'Sugar Organization Viewer',
    email: 'bannari.sugar.viewer@example.com',
    accessLevel: 'Read',
    scope: { orgId: 'BAN002', branchId: '*', deptId: '*' },
    homeOrgId: 'BAN002',
  },
  {
    userId: 'BNU004',
    fullName: 'Sugar Quality Editor',
    email: 'bannari.quality.editor@example.com',
    accessLevel: 'Write',
    scope: { orgId: 'BAN002', branchId: 'BNB004', deptId: 'BND0012' },
    homeOrgId: 'BAN002',
  },
  {
    userId: 'BNU005',
    fullName: 'Granite Organization Manager',
    email: 'bannari.granite.manager@example.com',
    accessLevel: 'Write',
    scope: { orgId: 'BAN005', branchId: '*', deptId: '*' },
    homeOrgId: 'BAN005',
  },
];

async function resolveHomeContext(client, orgId) {
  const result = await client.query(
    `
      select b.branch_id, d.dept_id
      from "tblBranches" b
      left join "tblDepartments" d
        on d.org_id = b.org_id
       and d.branch_id = b.branch_id
       and d.int_status = 1
      where b.org_id = $1
        and b.int_status = 1
      order by b.branch_id, d.dept_id
      limit 1
    `,
    [orgId],
  );
  if (!result.rows[0]) {
    throw new Error(`No active home context found for ${orgId}`);
  }
  return result.rows[0];
}

async function upsertUser(client, user, passwordHash, homeContext) {
  const existing = await client.query(
    `select user_id from "tblUsers" where user_id = $1 or lower(email) = lower($2) limit 1`,
    [user.userId, user.email],
  );
  const targetUserId = existing.rows[0]?.user_id || user.userId;
  const values = [
    user.fullName,
    user.email,
    targetUserId,
    passwordHash,
    user.homeOrgId,
    homeContext.branch_id,
    homeContext.dept_id,
  ];

  if (existing.rows[0]) {
    await client.query(
      `
        update "tblUsers"
           set full_name = $1,
               email = $2,
               password = $4,
               org_id = $5,
               branch_id = $6,
               dept_id = $7,
               job_role_id = $8,
               int_status = 1,
               changed_by = $9,
               changed_on = current_date
         where user_id = $3
      `,
      [...values, ROLE_ID, CREATED_BY],
    );
    return existing.rows[0].user_id;
  }

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
      user.userId,
      user.fullName,
      user.email,
      null,
      ROLE_ID,
      passwordHash,
      CREATED_BY,
      homeContext.dept_id,
      homeContext.branch_id,
    ],
  );
  return user.userId;
}

async function main() {
  if (!TEST_PASSWORD) {
    throw new Error('TEST_USERS_PASSWORD must be set; refusing to use an implicit password');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  let inTransaction = false;
  try {
    const database = (await client.query('select current_database() as name')).rows[0].name;
    if (database !== 'bannari_db') {
      throw new Error(`Refusing to modify ${database}; expected bannari_db`);
    }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await client.query('begin');
    inTransaction = true;

    for (const user of USER_DEFINITIONS) {
      const homeContext = await resolveHomeContext(client, user.homeOrgId);
      const userId = await upsertUser(client, user, passwordHash, homeContext);

      await client.query(`delete from "tblACM" where user_id = $1`, [userId]);
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
          `ACM_${user.userId}`,
          userId,
          user.accessLevel,
          user.scope.orgId,
          user.scope.branchId,
          user.scope.deptId,
          CREATED_BY,
        ],
      );

      const roleLink = await client.query(
        `select 1 from "tblUserJobRoles" where user_id = $1 and job_role_id = $2 limit 1`,
        [userId, ROLE_ID],
      );
      if (!roleLink.rows.length) {
        await client.query(
          `
            insert into "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
            values ($1, $2, $3)
          `,
          [`UJR_${user.userId}`, userId, ROLE_ID],
        );
      }
    }

    await client.query('commit');
    inTransaction = false;
    console.log(JSON.stringify({
      database,
      users_created_or_updated: USER_DEFINITIONS.length,
      password: 'password123',
      role: 'System Administrator navigation with ACM data scope',
      users: USER_DEFINITIONS.map(({ email, accessLevel, scope }) => ({
        email,
        access_level: accessLevel,
        scope,
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
  console.error(`Bannari test-user creation failed: ${error.message}`);
  process.exitCode = 1;
});
