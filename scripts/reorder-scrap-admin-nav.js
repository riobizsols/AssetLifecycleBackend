#!/usr/bin/env node
/**
 * Reorder Scrap and Admin Settings submenu items for JR001 (System Administrator).
 *
 * Scrap: Scrap Assets → Scrap Approval → Scrap Sales
 * Admin Settings: Audit Logs → Audit Log Config
 *
 * Usage:
 *   node scripts/reorder-scrap-admin-nav.js
 *   node scripts/reorder-scrap-admin-nav.js hospitality
 *   DATABASE_URL=... node scripts/reorder-scrap-admin-nav.js
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

const SCRAP_SEQUENCE_BY_APP = {
  SCRAPASSETS: 1,
  SCRAPMAINTENANCEAPPROVAL: 2,
  SCRAPSALES: 3,
};

const ADMIN_SETTINGS_SEQUENCE_BY_APP = {
  AUDITLOGS: 1,
  AUDITLOGCONFIG: 2,
};

async function findGroupParentId(client, groupLabel) {
  const result = await client.query(
    `SELECT job_role_nav_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = $2
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID, groupLabel.toLowerCase()],
  );
  return result.rows[0]?.job_role_nav_id || null;
}

async function reorderGroupChildren(client, parentId, sequenceByApp, groupLabel) {
  if (!parentId) {
    console.log(`Skipped ${groupLabel}: group not found`);
    return;
  }

  for (const [appId, sequence] of Object.entries(sequenceByApp)) {
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
      console.log(`  ${groupLabel}: ${appId} → sequence ${sequence}`);
    }
  }
}

async function ensureScrapGroup(client) {
  return findGroupParentId(client, 'scrap');
}

(async () => {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  console.log('DB:', CONNECTION.replace(/:[^:@/]+@/, ':****@'));
  console.log(`Reordering ${JOB_ROLE_ID} nav...`);

  const scrapParentId = await ensureScrapGroup(client);
  console.log('Scrap group:', scrapParentId || '(not found)');
  await reorderGroupChildren(
    client,
    scrapParentId,
    SCRAP_SEQUENCE_BY_APP,
    'Scrap',
  );

  const adminParentId = await findGroupParentId(client, 'admin settings');
  console.log('Admin Settings group:', adminParentId || '(not found)');
  await reorderGroupChildren(
    client,
    adminParentId,
    ADMIN_SETTINGS_SEQUENCE_BY_APP,
    'Admin Settings',
  );

  await client.end();
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
