#!/usr/bin/env node
/**
 * Reorder Inspection submenu for JR001: Approval → List → config items.
 *
 * Usage:
 *   node scripts/reorder-inspection-nav.js
 *   node scripts/reorder-inspection-nav.js JR001 --reference
 */
require('dotenv').config();
const { Client } = require('pg');

const JOB_ROLE_ID = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'JR001';
const useReference = process.argv.includes('--reference') || process.argv.includes('reference');
const CONNECTION = useReference
  ? process.env.GENERIC_URL
  : process.env.DATABASE_URL || process.env.GENERIC_URL;
if (!CONNECTION) {
  throw new Error('DATABASE_URL or GENERIC_URL required');
}

const INSPECTION_SEQUENCE_BY_APP = {
  INSPECTIONAPPROVAL: 1,
  INSPECTIONVIEW: 2,
  INSPECTION: 2,
  INSPECTIONFREQUENCY: 3,
  INSPECTIONCHECKLISTS: 4,
  ASSETTYPECHECKLISTMAPPING: 5,
};

async function findInspectionGroup(client) {
  const result = await client.query(
    `SELECT job_role_nav_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = 'inspection'
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID],
  );
  return result.rows[0]?.job_role_nav_id || null;
}

(async () => {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  console.log('DB:', CONNECTION.replace(/:[^:@/]+@/, ':****@'));
  console.log(`Reordering ${JOB_ROLE_ID} Inspection nav...`);

  const parentId = await findInspectionGroup(client);
  if (!parentId) {
    console.log('Inspection group not found — skipped');
    await client.end();
    process.exit(0);
  }

  console.log('Inspection group:', parentId);

  for (const [appId, sequence] of Object.entries(INSPECTION_SEQUENCE_BY_APP)) {
    const result = await client.query(
      `UPDATE "tblJobRoleNav"
       SET sequence = $1,
           parent_id = $3
       WHERE job_role_id = $2
         AND UPPER(app_id) = $4
         AND int_status = 1
       RETURNING job_role_nav_id, label`,
      [sequence, JOB_ROLE_ID, parentId, appId.toUpperCase()],
    );

    if (result.rows.length) {
      console.log(`  ${appId} → sequence ${sequence}`);
    }
  }

  await client.end();
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
