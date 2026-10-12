const { generateCustomIdForClient, syncJobRoleNavIdSequence } = require('./idGenerator');

const CONSUMABLES_GROUP_LABEL = 'Consumables';

const CONSUMABLES_NAV_ITEMS = [
  { app_id: 'CONSUMABLESMASTER', label: 'Consumables', sequence: 1 },
  { app_id: 'CONSUMABLESINVENTORY', label: 'Consumables Inventory', sequence: 2 },
  { app_id: 'CONSUMABLESUSAGE', label: 'Consumables Usage', sequence: 3 },
];

const CONSUMABLES_APP_IDS = CONSUMABLES_NAV_ITEMS.map((item) => item.app_id);

async function ensureApps(client, orgId) {
  for (const item of CONSUMABLES_NAV_ITEMS) {
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
 * Roles that should receive the Consumables menu:
 * - JR001 (System Administrator)
 * - any role that already has one consumables app
 * - any role that has Master Data or Admin Settings
 */
async function findTargetRoles(client) {
  const result = await client.query(
    `
      SELECT DISTINCT job_role_id
      FROM "tblJobRoleNav"
      WHERE COALESCE(int_status, 1) = 1
        AND COALESCE(mob_desk, 'D') = 'D'
        AND (
          job_role_id = 'JR001'
          OR app_id = ANY($1::text[])
          OR LOWER(TRIM(label)) IN ('master data', 'admin settings')
          OR app_id IN ('ASSETTYPES', 'USERS', 'AUDITLOGS', 'ORGANIZATIONS')
        )
    `,
    [CONSUMABLES_APP_IDS],
  );
  return result.rows;
}

async function findOrCreateGroup(client, { job_role_id, orgId }) {
  const existing = await client.query(
    `
      SELECT job_role_nav_id
      FROM "tblJobRoleNav"
      WHERE job_role_id = $1
        AND COALESCE(mob_desk, 'D') = 'D'
        AND COALESCE(is_group, false) = true
        AND LOWER(TRIM(label)) = LOWER($2)
      ORDER BY sequence NULLS LAST
      LIMIT 1
    `,
    [job_role_id, CONSUMABLES_GROUP_LABEL],
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
        AND COALESCE(mob_desk, 'D') = 'D'
    `,
    [job_role_id],
  );

  const groupId = await generateCustomIdForClient(client, 'job_role_nav', 3);
  await client.query(
    `
      INSERT INTO "tblJobRoleNav"
        (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
         access_level, is_group, org_id, int_status, mob_desk)
      VALUES ($1, $2, NULL, NULL, $3, $4, 'A', true, $5, 1, 'D')
    `,
    [groupId, job_role_id, CONSUMABLES_GROUP_LABEL, (maxSeq.rows[0]?.s || 0) + 1, orgId],
  );
  return groupId;
}

/**
 * Ensure Consumables group + child screens exist for admin/master-data roles.
 * Safe to call on navigation load for every tenant.
 */
async function ensureConsumablesNav(client, orgId, logLabel = 'ConsumablesNav') {
  if (!client?.query || !orgId) {
    return { inserted: 0, skipped: true };
  }

  await client.query('SET search_path TO public');
  await ensureApps(client, orgId);

  const roles = await findTargetRoles(client);
  let inserted = 0;

  for (const role of roles) {
    let groupId;
    try {
      groupId = await findOrCreateGroup(client, { job_role_id: role.job_role_id, orgId });
    } catch (err) {
      console.warn(
        `[${logLabel}] Could not ensure Consumables group for ${role.job_role_id}: ${err.message}`,
      );
      continue;
    }

    for (const item of CONSUMABLES_NAV_ITEMS) {
      const exists = await client.query(
        `
          SELECT 1
          FROM "tblJobRoleNav"
          WHERE job_role_id = $1
            AND app_id = $2
            AND COALESCE(mob_desk, 'D') = 'D'
          LIMIT 1
        `,
        [role.job_role_id, item.app_id],
      );
      if (exists.rows.length) continue;

      try {
        const jrnId = await generateCustomIdForClient(client, 'job_role_nav', 3);
        await client.query(
          `
            INSERT INTO "tblJobRoleNav"
              (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
               access_level, is_group, org_id, int_status, mob_desk)
            VALUES ($1, $2, $3, $4, $5, $6, 'A', false, $7, 1, 'D')
          `,
          [jrnId, role.job_role_id, groupId, item.app_id, item.label, item.sequence, orgId],
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
    console.log(`[${logLabel}] Inserted ${inserted} consumables nav item(s) for ${orgId}`);
  }

  return { inserted, skipped: false };
}

module.exports = {
  CONSUMABLES_GROUP_LABEL,
  CONSUMABLES_NAV_ITEMS,
  CONSUMABLES_APP_IDS,
  ensureConsumablesNav,
};
