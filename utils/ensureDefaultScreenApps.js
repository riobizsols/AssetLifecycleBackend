const { DEFAULT_APPS, DEFAULT_JOB_ROLE_NAV } = require('../constants/setupDefaults');
const { isLegacyGroupMenuAppId } = require('./navigationGroupUtils');

/** Spare-parts + org screens required for new tenants (also seeded into tblApps). */
const REQUIRED_SPARE_AND_ORG_APPS = [
  { id: 'ORGANIZATIONS', label: 'Organizations' },
  { id: 'SPAREPARTS', label: 'Spare Part Lot' },
  { id: 'SPAREPARTSCONFIG', label: 'Spare Part Category' },
  { id: 'SPAREPARTMASTER', label: 'Spare Part' },
  { id: 'SPAREPARTLIST', label: 'Spare Part List' },
  { id: 'SPAREPARTISSUE', label: 'Spare Part Issue' },
  { id: 'SPAREPARTAPPROVAL', label: 'Spare Part Approval' },
];

function buildRequiredScreenApps() {
  const byId = new Map();

  for (const app of DEFAULT_APPS) {
    byId.set(String(app.id).toUpperCase(), app.label);
  }
  for (const app of REQUIRED_SPARE_AND_ORG_APPS) {
    byId.set(String(app.id).toUpperCase(), app.label);
  }
  for (const item of DEFAULT_JOB_ROLE_NAV) {
    const id = item.appId;
    if (id && !isLegacyGroupMenuAppId(id)) {
      byId.set(String(id).toUpperCase(), item.label);
    }
  }

  return byId;
}

/**
 * Upsert tblApps rows for every screen referenced by DEFAULT_APPS + DEFAULT_JOB_ROLE_NAV.
 * Reference DB copies (schema_db) often omit spare-parts apps — this fills gaps for new tenants.
 */
async function ensureDefaultScreenApps(client, orgId, logLabel = 'ScreenApps') {
  if (!client || !orgId) {
    return { total: 0, upserted: 0 };
  }

  await client.query('SET search_path TO public');
  const required = buildRequiredScreenApps();
  let upserted = 0;

  for (const [appId, label] of required) {
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = true,
            org_id = EXCLUDED.org_id
      `,
      [appId, label, orgId],
    );
    upserted += 1;
  }

  console.log(`[${logLabel}] Ensured ${upserted} screen app(s) in tblApps`);
  return { total: required.size, upserted };
}

module.exports = {
  REQUIRED_SPARE_AND_ORG_APPS,
  buildRequiredScreenApps,
  ensureDefaultScreenApps,
};
