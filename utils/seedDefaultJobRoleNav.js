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

  await client.query(
    `
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      SELECT
        'jobrolenav',
        'JRN',
        COALESCE(MAX(
          CASE
            WHEN job_role_nav_id ~ '^JRN[0-9]+$'
            THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
            ELSE 0
          END
        ), 0)
      FROM "tblJobRoleNav"
      ON CONFLICT (table_key) DO UPDATE
      SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
    `,
  );

  return DEFAULT_JOB_ROLE_NAV.length;
}

module.exports = {
  seedDefaultJobRoleNav,
};
