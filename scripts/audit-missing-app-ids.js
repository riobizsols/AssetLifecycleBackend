require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');

const SIDEBAR_FILE = path.join(
  __dirname,
  '../../AssetLifecycleWebFrontend/src/components/DatabaseSidebar.jsx',
);
const ROUTES_FILE = path.join(
  __dirname,
  '../../AssetLifecycleWebFrontend/src/routes/AppRoutes.jsx',
);

function extractSidebarAppIds() {
  const text = fs.readFileSync(SIDEBAR_FILE, 'utf8');
  const block = text.match(/const appIdToPath = \{([\s\S]*?)\n\s*\};/);
  if (!block) return new Map();
  const map = new Map();
  for (const line of block[1].split('\n')) {
    const quoted = line.match(/^\s*([A-Z0-9_/ ]+):\s*"([^"]*)"/);
    if (quoted) {
      map.set(quoted[1].trim(), quoted[2]);
      continue;
    }
    const nullVal = line.match(/^\s*([A-Z0-9_/ ]+):\s*null/);
    if (nullVal) map.set(nullVal[1].trim(), null);
  }
  return map;
}

function extractProtectedRoutes() {
  const text = fs.readFileSync(ROUTES_FILE, 'utf8');
  const routes = [];
  const routeRe = /path="([^"]+)"[\s\S]*?<ProtectedRoute([^>]*)>/g;
  let m;
  while ((m = routeRe.exec(text))) {
    const routePath = m[1];
    const attrs = m[2] || '';
    const required = attrs.match(/requiredAppId="([^"]+)"/)?.[1] || null;
    const anyOf =
      attrs.match(/requiredAnyOfAppIds=\{\[([^\]]+)\]\}/)?.[1]
        ?.split(',')
        .map((s) => s.replace(/["'\s]/g, ''))
        .filter(Boolean) || [];
    routes.push({ routePath, required, anyOf });
  }
  return routes;
}

(async () => {
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const apps = await pool.query(`
    SELECT app_id, text
    FROM "tblApps"
    ORDER BY app_id
  `);
  const appIdSet = new Set(apps.rows.map((r) => r.app_id));

  const navMissingAppId = await pool.query(`
    SELECT job_role_id, label, sequence, is_group, access_level, job_role_nav_id
    FROM "tblJobRoleNav"
    WHERE int_status = 1
      AND (app_id IS NULL OR TRIM(app_id) = '')
      AND COALESCE(is_group, false) = false
    ORDER BY job_role_id, sequence, label
  `);

  const navGroupsMissingAppId = await pool.query(`
    SELECT job_role_id, label, sequence, job_role_nav_id
    FROM "tblJobRoleNav"
    WHERE int_status = 1
      AND (app_id IS NULL OR TRIM(app_id) = '')
      AND is_group = true
    ORDER BY job_role_id, sequence, label
  `);

  const sidebarMap = extractSidebarAppIds();
  const protectedRoutes = extractProtectedRoutes();

  const routesNoAppId = protectedRoutes.filter((r) => !r.required && !r.anyOf.length);
  const routesUnknownAppId = protectedRoutes.filter((r) => {
    const ids = r.required ? [r.required] : r.anyOf;
    return ids.some((id) => !appIdSet.has(id));
  });

  const sidebarNoRoute = [];
  const sidebarNoTblApp = [];
  for (const [appId, route] of sidebarMap.entries()) {
    if (route === 'null' || route == null) continue;
    if (!route) {
      sidebarNoRoute.push(appId);
      continue;
    }
    if (!appIdSet.has(appId)) sidebarNoTblApp.push({ appId, route });
  }

  const tblAppsNoSidebar = apps.rows
    .filter((a) => !sidebarMap.has(a.app_id))
    .map((a) => ({ app_id: a.app_id, text: a.text }));

  console.log('=== LEAF NAV ITEMS WITH NO app_id (screen rows) ===');
  if (!navMissingAppId.rows.length) {
    console.log('(none)');
  } else {
    for (const r of navMissingAppId.rows) {
      console.log(
        `  ${r.job_role_id}\t${r.label}\tseq=${r.sequence}\taccess=${r.access_level}\t${r.job_role_nav_id}`,
      );
    }
  }

  console.log('\n=== GROUP NAV ITEMS WITH NO app_id (expected for folders) ===');
  const groupsByRole = {};
  for (const r of navGroupsMissingAppId.rows) {
    groupsByRole[r.job_role_id] = groupsByRole[r.job_role_id] || [];
    groupsByRole[r.job_role_id].push(r.label);
  }
  for (const [role, labels] of Object.entries(groupsByRole)) {
    console.log(`  ${role}: ${labels.join(', ')}`);
  }

  console.log('\n=== ROUTES WITH NO requiredAppId (auth only) ===');
  for (const r of routesNoAppId) {
    console.log(`  ${r.routePath}`);
  }

  console.log('\n=== ROUTES REFERENCING app_id NOT IN tblApps ===');
  if (!routesUnknownAppId.length) console.log('(none)');
  for (const r of routesUnknownAppId) {
    const ids = r.required ? [r.required] : r.anyOf;
    const missing = ids.filter((id) => !appIdSet.has(id));
    console.log(`  ${r.routePath}\tmissing: ${missing.join(', ')}`);
  }

  console.log('\n=== SIDEBAR app_id WITH NO ROUTE MAPPING ===');
  console.log(sidebarNoRoute.length ? sidebarNoRoute.join(', ') : '(none)');

  console.log('\n=== SIDEBAR app_id NOT IN tblApps ===');
  if (!sidebarNoTblApp.length) console.log('(none)');
  for (const x of sidebarNoTblApp) {
    console.log(`  ${x.appId}\t${x.route}`);
  }

  console.log('\n=== tblApps WITH NO SIDEBAR PATH MAPPING ===');
  if (!tblAppsNoSidebar.length) console.log('(none)');
  for (const x of tblAppsNoSidebar) {
    console.log(`  ${x.app_id}\t${x.text}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
