#!/usr/bin/env node
/**
 * Align schema_db with Branch–Department Mapping provisioning template.
 * Usage: node scripts/sync-schema-db-branch-dept-mapping.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { ensureBranchDeptMappingProvisioning } = require('../utils/ensureBranchDeptMappingProvisioning');

(async () => {
  const url = process.env.TENANT_SCHEMA_REFERENCE_URL;
  if (!url) throw new Error('TENANT_SCHEMA_REFERENCE_URL is required');

  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();
  try {
    await client.query('SET search_path TO public');
    const orgRow = await client.query(
      'SELECT org_id FROM "tblApps" WHERE org_id IS NOT NULL LIMIT 1',
    );
    const orgId = orgRow.rows[0]?.org_id || 'ORG001';
    console.log(`Updating schema_db (${url.split('/').pop()?.split('?')[0]}) org=${orgId}...`);
    const result = await ensureBranchDeptMappingProvisioning(client, orgId, 'SchemaDbBranchDept');
    console.log('Result:', result);

    const nav = await client.query(`
      SELECT job_role_nav_id, job_role_id, parent_id, sequence, label
      FROM "tblJobRoleNav"
      WHERE app_id = 'BRANCHDEPTMAPPING' AND job_role_id = 'JR001'
      ORDER BY sequence
    `);
    console.log('\nJR001 BRANCHDEPTMAPPING nav:');
    for (const row of nav.rows) console.log(`  ${row.job_role_nav_id} seq=${row.sequence} parent=${row.parent_id} — ${row.label}`);
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
