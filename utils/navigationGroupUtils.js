/**
 * Menu groups live in tblJobRoleNav only (is_group=true, app_id=null).
 * tblApps holds screen apps for submenus and top-level items — not group headers.
 */

const LEGACY_GROUP_MENU_APP_IDS = [
  "MASTERDATA",
  "REPORTS",
  "ADMINSETTINGS",
  "ASSETASSIGNMENT",
  "INSPECTION",
];

function isLegacyGroupMenuAppId(appId) {
  if (!appId) return false;
  return LEGACY_GROUP_MENU_APP_IDS.includes(String(appId).trim().toUpperCase());
}

function filterScreenApps(rows, idField = "app_id") {
  return rows.filter((row) => !isLegacyGroupMenuAppId(row[idField] || row.id));
}

function resolveNavAppId(item) {
  if (item?.isGroup === true || item?.is_group === true) {
    return null;
  }
  return item?.appId ?? item?.app_id ?? null;
}

async function normalizeGroupNavAppIds(client) {
  const result = await client.query(`
    UPDATE "tblJobRoleNav"
    SET app_id = NULL
    WHERE is_group = true AND app_id IS NOT NULL
    RETURNING job_role_nav_id
  `);
  return result.rowCount;
}

async function removeLegacyGroupMenuApps(client) {
  const upperIds = LEGACY_GROUP_MENU_APP_IDS.map((id) => id.toUpperCase());
  const result = await client.query(
    `DELETE FROM "tblApps" WHERE UPPER(app_id) = ANY($1::text[]) RETURNING app_id`,
    [upperIds],
  );
  return result.rowCount;
}

async function dropJobRoleNavAppIdForeignKeys(client) {
  const { rows } = await client.query(`
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'tblJobRoleNav'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'app_id'
  `);

  for (const { constraint_name } of rows) {
    await client.query(
      `ALTER TABLE "tblJobRoleNav" DROP CONSTRAINT IF EXISTS "${constraint_name}"`,
    );
  }

  return rows.length;
}

/**
 * New tenants / setup wizard: groups use app_id=NULL (no tblApps row required).
 * Schema copied from an older template may still have NOT NULL on app_id.
 */
async function ensureJobRoleNavAppIdNullable(client, logLabel = 'NavSchema') {
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tblJobRoleNav'
    ) AS exists
  `);
  if (!tableCheck.rows[0]?.exists) {
    return { skipped: true, reason: 'tblJobRoleNav missing' };
  }

  const columnCheck = await client.query(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblJobRoleNav'
      AND column_name = 'app_id'
  `);
  if (!columnCheck.rows.length) {
    return { skipped: true, reason: 'app_id column missing' };
  }

  const alreadyNullable = columnCheck.rows[0].is_nullable === 'YES';
  let fksDropped = 0;
  let altered = false;

  if (!alreadyNullable) {
    fksDropped = await dropJobRoleNavAppIdForeignKeys(client);
    await client.query(`
      ALTER TABLE "tblJobRoleNav"
      ALTER COLUMN app_id DROP NOT NULL
    `);
    altered = true;
    console.log(
      `[${logLabel}] tblJobRoleNav.app_id is now nullable (dropped ${fksDropped} FK(s))`,
    );
  }

  return { alreadyNullable, altered, fksDropped };
}

async function applyNavigationGroupModel(client, logLabel = "NavGroup") {
  const navUpdated = await normalizeGroupNavAppIds(client);
  const appsRemoved = await removeLegacyGroupMenuApps(client);
  console.log(
    `[${logLabel}] Menu groups: cleared app_id on ${navUpdated} nav row(s); removed ${appsRemoved} group app(s) from tblApps`,
  );
  return { navUpdated, appsRemoved };
}

module.exports = {
  LEGACY_GROUP_MENU_APP_IDS,
  isLegacyGroupMenuAppId,
  filterScreenApps,
  resolveNavAppId,
  normalizeGroupNavAppIds,
  removeLegacyGroupMenuApps,
  ensureJobRoleNavAppIdNullable,
  dropJobRoleNavAppIdForeignKeys,
  applyNavigationGroupModel,
};
