const { ensureBrDeptSchema } = require('./ensureBrDeptSchema');
const { ensureDefaultScreenApps } = require('./ensureDefaultScreenApps');
const { seedDefaultJobRoleNav } = require('./seedDefaultJobRoleNav');

/**
 * Guarantee tblBR_DEPT + BRANCHDEPTMAPPING app/nav for tenant provisioning reference DBs.
 */
async function ensureBranchDeptMappingProvisioning(client, orgId, logLabel = 'BranchDeptProvision') {
  if (!client?.query) {
    return { schema: false, apps: 0, nav: 0, legacyNavRemoved: 0 };
  }

  await client.query('SET search_path TO public');

  const schemaResult = await ensureBrDeptSchema(client);

  const legacy = await client.query(`
    DELETE FROM "tblJobRoleNav"
    WHERE app_id = 'BRANCHDEPTMAPPING'
      AND job_role_nav_id LIKE 'JRN_BDM_%'
    RETURNING job_role_nav_id
  `);
  const legacyNavRemoved = legacy.rowCount || 0;
  if (legacyNavRemoved) {
    console.log(`[${logLabel}] Removed ${legacyNavRemoved} legacy JRN_BDM_* nav row(s)`);
  }

  const appsResult = await ensureDefaultScreenApps(client, orgId, logLabel);
  const navCount = await seedDefaultJobRoleNav(client, orgId, logLabel);

  return {
    schema: schemaResult.created,
    backfilled: schemaResult.backfilled,
    apps: appsResult.upserted,
    nav: navCount,
    legacyNavRemoved,
  };
}

module.exports = {
  ensureBranchDeptMappingProvisioning,
};
