const { DEFAULT_JOB_ROLE_NAV } = require('../constants/setupDefaults');
const {
  applyNavigationGroupModel,
  resolveNavAppId,
} = require('./navigationGroupUtils');

/**
 * Insert JR001 System Administrator navigation for a new tenant.
 */
async function seedDefaultJobRoleNav(client, orgId, logLabel = 'NavSeed') {
  for (const item of DEFAULT_JOB_ROLE_NAV) {
    await client.query(
      `
        INSERT INTO "tblJobRoleNav"
          (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, sub_menu, sequence, access_level, is_group, mob_desk)
        VALUES
          ($1, $2, 1, $3, $4, $5, $6, NULL, $7, $8, $9, 'D')
        ON CONFLICT (job_role_nav_id) DO UPDATE
        SET org_id = EXCLUDED.org_id,
            int_status = 1,
            job_role_id = EXCLUDED.job_role_id,
            parent_id = EXCLUDED.parent_id,
            app_id = EXCLUDED.app_id,
            label = EXCLUDED.label,
            sequence = EXCLUDED.sequence,
            access_level = EXCLUDED.access_level,
            is_group = EXCLUDED.is_group
      `,
      [
        item.id,
        orgId,
        item.jobRoleId,
        item.parentId,
        resolveNavAppId(item),
        item.label,
        item.sequence,
        item.accessLevel,
        item.isGroup,
      ],
    );
  }

  await applyNavigationGroupModel(client, logLabel);
  return DEFAULT_JOB_ROLE_NAV.length;
}

module.exports = {
  seedDefaultJobRoleNav,
};
