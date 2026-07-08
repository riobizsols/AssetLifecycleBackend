#!/usr/bin/env node
require('dotenv').config();
const db = require('../config/db');

const REOPENED_APP_ID = 'REOPENEDBREAKDOWNS';
const REPORTS_LABEL = 'Reports';
const JOB_ROLE_ID = process.argv[2] || 'JR001';

(async () => {
  const reportsGroup = await db.query(
    `SELECT job_role_nav_id, sequence
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = LOWER($2)
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID, REPORTS_LABEL]
  );

  if (!reportsGroup.rows.length) {
    console.error(`Reports group not found for ${JOB_ROLE_ID}`);
    process.exit(1);
  }

  const reportsNavId = reportsGroup.rows[0].job_role_nav_id;

  const reopenedRows = await db.query(
    `SELECT job_role_nav_id, parent_id, sequence
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND app_id = $2`,
    [JOB_ROLE_ID, REOPENED_APP_ID]
  );

  if (!reopenedRows.rows.length) {
    console.log(`No ${REOPENED_APP_ID} nav row for ${JOB_ROLE_ID}`);
    process.exit(0);
  }

  const maxSeqResult = await db.query(
    `SELECT COALESCE(MAX(sequence), 0) AS max_seq
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND parent_id = $2
       AND int_status = 1`,
    [JOB_ROLE_ID, reportsNavId]
  );
  const nextSeq = Number(maxSeqResult.rows[0]?.max_seq || 0) + 1;

  for (const row of reopenedRows.rows) {
    if (row.parent_id === reportsNavId) {
      console.log(`${REOPENED_APP_ID} already under Reports for ${JOB_ROLE_ID}`);
      continue;
    }

    await db.query(
      `UPDATE "tblJobRoleNav"
       SET parent_id = $1, sequence = $2
       WHERE job_role_nav_id = $3`,
      [reportsNavId, nextSeq, row.job_role_nav_id]
    );
    console.log(
      `Moved ${REOPENED_APP_ID} (${row.job_role_nav_id}) under Reports (${reportsNavId}) seq=${nextSeq}`
    );
  }

  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
