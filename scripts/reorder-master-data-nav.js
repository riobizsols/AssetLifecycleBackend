#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

const JOB_ROLE_ID = process.argv[2] || 'JR001';
const SEQUENCE_BY_APP = {
  ASSETTYPES: 24,
  BRANCHES: 25,
  DEPARTMENTS: 26,
  DEPARTMENTSADMIN: 27,
  DEPARTMENTSASSET: 28,
  ROLES: 29,
  USERS: 30,
  USERROLES: 31,
  PRODSERV: 32,
  VENDORS: 33,
};

(async () => {
  const masterGroup = await db.query(
    `SELECT job_role_nav_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = 'master data'
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID]
  );

  if (!masterGroup.rows.length) {
    console.error(`Master Data group not found for ${JOB_ROLE_ID}`);
    process.exit(1);
  }

  const parentId = masterGroup.rows[0].job_role_nav_id;

  for (const [appId, sequence] of Object.entries(SEQUENCE_BY_APP)) {
    const result = await db.query(
      `UPDATE "tblJobRoleNav"
       SET sequence = $1,
           label = CASE
             WHEN app_id = 'USERS' THEN 'Users'
             WHEN app_id = 'USERROLES' THEN 'Job Roles'
             ELSE label
           END
       WHERE job_role_id = $2
         AND parent_id = $3
         AND app_id = $4
         AND int_status = 1
       RETURNING job_role_nav_id`,
      [sequence, JOB_ROLE_ID, parentId, appId]
    );

    if (result.rows.length) {
      console.log(`Updated ${appId} sequence=${sequence}`);
    }
  }

  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
