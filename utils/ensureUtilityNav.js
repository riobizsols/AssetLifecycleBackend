const { generateCustomIdForClient, syncJobRoleNavIdSequence } = require('./idGenerator');

const UTILITY_GROUP_LABEL = 'Utilities';

const UTILITY_NAV_ITEMS = [
  { app_id: 'UTILITYMASTER', label: 'Utility Master', sequence: 1 },
  { app_id: 'UTILITYATMAPPING', label: 'Utility – Asset Type Mapping', sequence: 2 },
  { app_id: 'UTILITYCONSUMPTION', label: 'Record Consumption', sequence: 3 },
];

const UTILITY_APP_IDS = UTILITY_NAV_ITEMS.map((item) => item.app_id);

async function ensureApps(client, orgId) {
  for (const item of UTILITY_NAV_ITEMS) {
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = true
      `,
      [item.app_id, item.label, orgId],
    );
  }
}

/**
 * Roles that should receive the Utilities menu:
 * - JR001 (System Administrator)
 * - any role that already has one utility app
 * - any role that has Master Data or Admin Settings (group or known apps)
 */
async function findTargetRoles(client) {
  const result = await client.query(
    `
      SELECT DISTINCT job_role_id, COALESCE(mob_desk, 'D') AS mob_desk
      FROM "tblJobRoleNav"
      WHERE COALESCE(int_status, 1) = 1
        AND (
          job_role_id = 'JR001'
          OR app_id = ANY($1::text[])
          OR LOWER(TRIM(label)) IN ('master data', 'admin settings')
          OR app_id IN ('ASSETTYPES', 'ASSETTYPE', 'USERS', 'AUDITLOGS', 'ORGANIZATIONS')
        )
    `,
    [UTILITY_APP_IDS],
  );
  return result.rows;
}

async function findOrCreateUtilityGroup(client, { job_role_id, mob_desk, orgId }) {
  const existing = await client.query(
    `
      SELECT job_role_nav_id
      FROM "tblJobRoleNav"
      WHERE job_role_id = $1
        AND COALESCE(mob_desk, 'D') = $2
        AND COALESCE(int_status, 1) = 1
        AND COALESCE(is_group, false) = true
        AND LOWER(TRIM(label)) = LOWER($3)
      ORDER BY sequence NULLS LAST
      LIMIT 1
    `,
    [job_role_id, mob_desk, UTILITY_GROUP_LABEL],
  );

  if (existing.rows[0]?.job_role_nav_id) {
    return existing.rows[0].job_role_nav_id;
  }

  const maxSeq = await client.query(
    `
      SELECT COALESCE(MAX(sequence), 0)::int AS s
      FROM "tblJobRoleNav"
      WHERE job_role_id = $1
        AND parent_id IS NULL
        AND COALESCE(mob_desk, 'D') = $2
    `,
    [job_role_id, mob_desk],
  );

  const groupId = await generateCustomIdForClient(client, 'job_role_nav', 3);
  await client.query(
    `
      INSERT INTO "tblJobRoleNav"
        (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
         access_level, is_group, org_id, int_status, mob_desk)
      VALUES ($1, $2, NULL, NULL, $3, $4, 'A', true, $5, 1, $6)
    `,
    [
      groupId,
      job_role_id,
      UTILITY_GROUP_LABEL,
      (maxSeq.rows[0]?.s || 0) + 1,
      orgId,
      mob_desk,
    ],
  );
  return groupId;
}

/**
 * Ensure Utilities group + child screens exist for admin/master-data roles.
 * Safe to call on navigation load for every tenant (including ngp).
 */
async function ensureUtilityNav(client, orgId, logLabel = 'UtilityNav') {
  if (!client?.query || !orgId) {
    return { inserted: 0, skipped: true };
  }

  await client.query('SET search_path TO public');
  await ensureApps(client, orgId);

  const roles = await findTargetRoles(client);
  if (!roles.length) {
    return { inserted: 0, skipped: false };
  }

  let inserted = 0;

  for (const role of roles) {
    let groupId;
    try {
      groupId = await findOrCreateUtilityGroup(client, {
        job_role_id: role.job_role_id,
        mob_desk: role.mob_desk || 'D',
        orgId,
      });
    } catch (err) {
      console.warn(
        `[${logLabel}] Could not ensure Utilities group for ${role.job_role_id}: ${err.message}`,
      );
      continue;
    }

    for (const item of UTILITY_NAV_ITEMS) {
      const exists = await client.query(
        `
          SELECT 1
          FROM "tblJobRoleNav"
          WHERE job_role_id = $1
            AND app_id = $2
            AND COALESCE(mob_desk, 'D') = $3
            AND COALESCE(int_status, 1) = 1
          LIMIT 1
        `,
        [role.job_role_id, item.app_id, role.mob_desk || 'D'],
      );
      if (exists.rows.length) continue;

      try {
        const jrnId = await generateCustomIdForClient(client, 'job_role_nav', 3);
        await client.query(
          `
            INSERT INTO "tblJobRoleNav"
              (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
               access_level, is_group, org_id, int_status, mob_desk)
            VALUES ($1, $2, $3, $4, $5, $6, 'A', false, $7, 1, $8)
          `,
          [
            jrnId,
            role.job_role_id,
            groupId,
            item.app_id,
            item.label,
            item.sequence,
            orgId,
            role.mob_desk || 'D',
          ],
        );
        inserted += 1;
      } catch (err) {
        console.warn(
          `[${logLabel}] Could not insert ${item.app_id} for ${role.job_role_id}: ${err.message}`,
        );
      }
    }
  }

  if (inserted > 0) {
    try {
      await syncJobRoleNavIdSequence(client);
    } catch (_) {
      /* sequence table may be missing on some tenants */
    }
    console.log(`[${logLabel}] Inserted ${inserted} utility nav item(s) for ${orgId}`);
  }

  return { inserted, skipped: false };
}

module.exports = {
  UTILITY_GROUP_LABEL,
  UTILITY_NAV_ITEMS,
  UTILITY_APP_IDS,
  ensureUtilityNav,
};
