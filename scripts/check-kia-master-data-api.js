require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const { getUserNavigation } = require('../models/jobRoleNavModel');

  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const orgId = t.rows[0]?.org_id;
  if (!orgId) {
    console.log('kia tenant not found');
    process.exit(0);
  }

  const pool = await getTenantPool(orgId);
  const users = await pool.query(
    `SELECT user_id, email FROM "tblUsers" WHERE email ILIKE '%admin@kia%' LIMIT 3`,
  );
  console.log('KIA admin users:', users.rows);

  const userId = users.rows[0]?.user_id || 'USR003';
  const origQuery = pool.query.bind(pool);
  pool.query = origQuery;

  const db = require('../config/db');
  const origDbQuery = db.query;
  db.query = (...args) => pool.query(...args);

  const nav = await getUserNavigation(userId, 'D');
  const master = nav.find((i) => String(i.label || '').toLowerCase() === 'master data');
  console.log('\nKIA API nav - Master Data children:', master?.children?.length);
  for (const c of master?.children || []) {
    console.log(`  id=${c.id} ${c.label} (${c.app_id}) access=${c.access_level}`);
  }

  const masterDataApps = ['ASSETTYPES','DEPARTMENTS','DEPARTMENTSADMIN','DEPARTMENTSASSET','BRANCHES','VENDORS','PRODSERV','ROLES','USERS'];
  const flat = [];
  const walk = (items) => {
    for (const i of items || []) {
      flat.push(i);
      walk(i.children);
    }
  };
  walk(nav);
  console.log('\nTop-level nav labels:');
  for (const i of nav) {
    const childCount = i.children?.length || 0;
    console.log(`  ${i.label} (${i.app_id}) children=${childCount} id=${i.id} combineKey=${i.combineKey}`);
  }
  console.log('\nAll Master Data groups in tree:');
  for (const i of flat.filter((x) => String(x.label || '').toLowerCase() === 'master data')) {
    console.log(`  id=${i.id} app_id=${i.app_id} combineKey=${i.combineKey} children=${i.children?.length}`);
    for (const c of i.children || []) {
      console.log(`    - ${c.label} (${c.app_id})`);
    }
  }
  console.log('\nWhere are standard Master Data apps in API tree?');
  for (const appId of masterDataApps) {
    const found = flat.filter((i) => String(i.app_id).toUpperCase() === appId);
    for (const f of found) {
      console.log(`  ${appId}: ${f.label} (id=${f.id}, parent_id=${f.parent_id})`);
    }
  }

  db.query = origDbQuery;
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
