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
  applyNavigationGroupModel,
};
