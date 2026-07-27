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

/**
 * Same UI route (/technician-certificates). Keep one canonical nav app_id.
 * TECHCERTUPLOAD / TECHNICIANCERTIFICATES are legacy aliases of EMPLOYEE TECH CERTIFICATION.
 */
const DUPLICATE_NAV_APP_ALIASES = {
  "EMPLOYEE TECH CERTIFICATION": ["TECHCERTUPLOAD", "TECHNICIANCERTIFICATES"],
};

function normalizeAppId(appId) {
  return String(appId || "").trim().toUpperCase();
}

function isLegacyGroupMenuAppId(appId) {
  if (!appId) return false;
  return LEGACY_GROUP_MENU_APP_IDS.includes(normalizeAppId(appId));
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

/**
 * Drop alias nav rows when the canonical app_id is already present in the set.
 * Prevents Technician Certificates + Employee Tech Certificate both appearing.
 */
function dedupeNavRowsByAppAlias(rows, appIdField = "app_id") {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const present = new Set(
    rows
      .map((row) => normalizeAppId(row?.[appIdField]))
      .filter(Boolean),
  );

  const aliasToDrop = new Set();
  for (const [canonical, aliases] of Object.entries(DUPLICATE_NAV_APP_ALIASES)) {
    const canonicalNorm = normalizeAppId(canonical);
    const hasCanonical = present.has(canonicalNorm);
    const presentAliases = aliases.filter((a) => present.has(normalizeAppId(a)));

    if (hasCanonical) {
      for (const alias of presentAliases) aliasToDrop.add(normalizeAppId(alias));
    } else if (presentAliases.length > 1) {
      // No canonical: keep first alias, drop the rest
      for (const alias of presentAliases.slice(1)) aliasToDrop.add(normalizeAppId(alias));
    }
  }

  if (aliasToDrop.size === 0) return rows;
  return rows.filter((row) => !aliasToDrop.has(normalizeAppId(row?.[appIdField])));
}

/**
 * Remove duplicate alias screens from tblJobRoleNav for any role.
 */
async function removeDuplicateNavAppAliases(client) {
  let removed = 0;
  for (const [canonical, aliases] of Object.entries(DUPLICATE_NAV_APP_ALIASES)) {
    const result = await client.query(
      `
        DELETE FROM "tblJobRoleNav" alias_row
        WHERE UPPER(TRIM(alias_row.app_id)) = ANY($1::text[])
          AND EXISTS (
            SELECT 1
            FROM "tblJobRoleNav" canonical_row
            WHERE canonical_row.job_role_id = alias_row.job_role_id
              AND UPPER(TRIM(canonical_row.app_id)) = UPPER(TRIM($2))
              AND COALESCE(canonical_row.mob_desk, 'D') = COALESCE(alias_row.mob_desk, 'D')
          )
        RETURNING alias_row.job_role_nav_id
      `,
      [aliases.map((a) => normalizeAppId(a)), canonical],
    );
    removed += result.rowCount || 0;
  }
  return removed;
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
  const duplicateNavRemoved = await removeDuplicateNavAppAliases(client);
  console.log(
    `[${logLabel}] Menu groups: cleared app_id on ${navUpdated} nav row(s); removed ${appsRemoved} group app(s) from tblApps; removed ${duplicateNavRemoved} duplicate cert nav row(s)`,
  );
  return { navUpdated, appsRemoved, duplicateNavRemoved };
}

module.exports = {
  LEGACY_GROUP_MENU_APP_IDS,
  DUPLICATE_NAV_APP_ALIASES,
  isLegacyGroupMenuAppId,
  filterScreenApps,
  resolveNavAppId,
  dedupeNavRowsByAppAlias,
  removeDuplicateNavAppAliases,
  normalizeGroupNavAppIds,
  removeLegacyGroupMenuApps,
  applyNavigationGroupModel,
};
