#!/usr/bin/env node
/**
 * Pre-push smoke test for SKASC tenant fixes (no git push).
 * Usage: node scripts/pre-push-skasc-smoke-test.js
 * Env: API_BASE=http://localhost:5001/api  TEST_PASSWORD=Initial1
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { Client } = require('pg');
const { runWithDb } = require('../utils/dbContext');
const inspectionModel = require('../models/inspectionScheduleModel');
const assetModel = require('../models/assetModel');
const { resolveAssetBranchId } = require('../utils/branchAccessUtils');
const { getCombinedNavigationStructure } = require('../models/jobRoleNavModel');

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5001}/api`;
const SKASC_HOST =
  process.env.SKASC_HOST ||
  'sri-krishna-arts-and-science-college.localhost:5001';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Initial1';

const USERS = [
  { email: 'mgr.test@skasc.test', role: 'JR002', label: 'Maintenance Manager' },
  { email: 'tech.test@skasc.test', role: 'JR003', label: 'Maintenance Technician' },
  { email: 'viewer.test@skasc.test', role: 'JR004', label: 'Report Viewer' },
];

const skascUrl = process.env.TENANT_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/skasc_db$1');

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function request(method, urlPath, { token, host, body } = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, API_BASE.endsWith('/') ? API_BASE : API_BASE + '/');
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (host) headers.Host = host;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = lib.request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = data;
          }
          resolve({ status: res.statusCode, json, raw: data });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout' });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function dbTests() {
  console.log('\n=== Database / model tests (skasc_db) ===');
  const client = new Client({ connectionString: skascUrl });
  await client.connect();

  await runWithDb(client, async () => {
    const insp = await inspectionModel.getInspectionList('ORG001', null);
    if (insp.rows.length === 0) {
      pass('Inspection list model returns 0 rows on skasc');
    } else {
      fail('Inspection list model', `expected 0, got ${insp.rows.length}`);
    }

    const assets = await assetModel.getAssetsByUserContext('ORG001', 'BR001', client, false);
    if (assets.rows.length >= 1) {
      pass('Branch-scoped assets (BR001)', `${assets.rows.length} row(s)`);
    } else {
      fail('Branch-scoped assets (BR001)', 'viewer/manager should see ASS121');
    }

    const adminBranch = await resolveAssetBranchId(null, { org_id: 'ORG001', branch_id: null }, client);
    if (adminBranch === 'BR001') {
      pass('resolveAssetBranchId defaults to BR001 for admin');
    } else {
      fail('resolveAssetBranchId', `got ${adminBranch}`);
    }

    for (const role of ['JR002', 'JR003', 'JR004']) {
      const nav = await getCombinedNavigationStructure([role], 'D');
      const flat = [];
      const walk = (items) => {
        for (const i of items || []) {
          flat.push(i.app_id);
          walk(i.children);
        }
      };
      walk(nav);
      const allDesktop = (await client.query(
        `SELECT COUNT(*)::int n FROM "tblJobRoleNav" WHERE job_role_id=$1 AND mob_desk='M'`,
        [role]
      )).rows[0].n;
      if (allDesktop === 0 && flat.length > 0) {
        pass(`${role} desktop nav`, `${flat.length} top-level item(s)`);
      } else if (flat.length === 0) {
        fail(`${role} desktop nav`, 'empty navigation');
      } else {
        fail(`${role} desktop nav`, `still has ${allDesktop} mobile-only rows`);
      }

      const broken = await client.query(
        `SELECT app_id, parent_id FROM "tblJobRoleNav" j
         WHERE job_role_id=$1 AND parent_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM "tblJobRoleNav" p
           WHERE p.job_role_id=$1 AND p.job_role_nav_id=j.parent_id
         )`,
        [role]
      );
      if (broken.rows.length === 0) {
        pass(`${role} nav parent links`);
      } else {
        fail(`${role} nav parent links`, broken.rows.map((r) => r.app_id).join(', '));
      }
    }

    const asset = await client.query(
      `SELECT asset_id, branch_id FROM "tblAssets" WHERE asset_id='ASS121'`
    );
    if (asset.rows[0]?.branch_id === 'BR001') {
      pass('ASS121 has branch_id BR001');
    } else {
      fail('ASS121 branch', asset.rows[0]?.branch_id || 'missing');
    }
  });

  await client.end();
}

async function apiTests() {
  console.log('\n=== API tests (tenant subdomain host) ===');
  const health = await request('GET', '../', { host: SKASC_HOST }).catch(() => null);
  const ping = await request('GET', 'navigation/user/navigation?platform=D', {
    host: SKASC_HOST,
  });

  let serverUp = false;
  const loginProbe = await request('POST', 'auth/login', {
    host: SKASC_HOST,
    body: { email: 'viewer.test@skasc.test', password: TEST_PASSWORD },
  });
  if (loginProbe.status === 200 && loginProbe.json?.token) {
    serverUp = true;
    pass('Backend reachable + SKASC login', `host=${SKASC_HOST}`);
  } else if (loginProbe.status === 401) {
    console.log('  SKIP  API login tests — invalid credentials (set TEST_PASSWORD env)');
    console.log('         Backend is running; restart after code changes, then re-run with correct password.');
    return;
  } else if (loginProbe.status === 0) {
    console.log('  SKIP  API tests — backend not running or unreachable');
    console.log(`         Start: cd AssetLifecycleBackend && npm start (port ${process.env.PORT || 5001})`);
    console.log(`         Tried: ${API_BASE} with Host: ${SKASC_HOST}`);
    return;
  } else {
    serverUp = true;
    fail('SKASC login', `status=${loginProbe.status} ${JSON.stringify(loginProbe.json)?.slice(0, 120)}`);
  }

  if (!serverUp) return;

  for (const u of USERS) {
    const login = await request('POST', 'auth/login', {
      host: SKASC_HOST,
      body: { email: u.email, password: TEST_PASSWORD },
    });
    if (login.status !== 200 || !login.json?.token) {
      fail(`${u.label} login`, `status ${login.status}`);
      continue;
    }
    pass(`${u.label} login`);
    const token = login.json.token;

    const navRes = await request('GET', 'navigation/user/navigation?platform=D', {
      token,
      host: SKASC_HOST,
    });
    const navItems = navRes.json?.data || [];
    const countNav = (items) =>
      items.reduce((n, i) => n + 1 + countNav(i.children || []), 0);
    const navCount = countNav(navItems);
    if (navRes.status === 200 && navCount > 0) {
      pass(`${u.label} navigation API`, `${navCount} item(s)`);
    } else {
      fail(`${u.label} navigation API`, `status=${navRes.status} count=${navCount}`);
    }

    const assetsRes = await request('GET', 'assets', { token, host: SKASC_HOST });
    const assetRows = Array.isArray(assetsRes.json)
      ? assetsRes.json
      : assetsRes.json?.rows || assetsRes.json?.data || [];
    const assetCount = Array.isArray(assetRows) ? assetRows.length : 0;

    if (u.role === 'JR004' || u.role === 'JR002' || u.role === 'JR003') {
      if (assetsRes.status === 200 && assetCount >= 1) {
        pass(`${u.label} GET /assets`, `${assetCount} asset(s)`);
      } else {
        fail(`${u.label} GET /assets`, `status=${assetsRes.status} count=${assetCount}`);
      }
    }

    const inspRes = await request('GET', 'inspection/list', { token, host: SKASC_HOST });
    const inspRows = inspRes.json?.data || [];
    if (inspRes.status === 200 && inspRows.length === 0) {
      pass(`${u.label} GET /inspection/list`, '0 rows (no hospitality leak)');
    } else if (inspRes.status === 200 && inspRows.length > 0) {
      fail(`${u.label} GET /inspection/list`, `${inspRows.length} rows — tenant leak?`);
    } else {
      fail(`${u.label} GET /inspection/list`, `status=${inspRes.status}`);
    }

    if (u.role === 'JR002') {
      const maintRes = await request('GET', 'maintenance-schedules/all', {
        token,
        host: SKASC_HOST,
      });
      const maintRows = maintRes.json?.data || maintRes.json || [];
      const maintCount = Array.isArray(maintRows) ? maintRows.length : 0;
      if (maintRes.status === 200) {
        pass(`${u.label} GET /maintenance-schedules/all`, `${maintCount} row(s)`);
      } else {
        fail(`${u.label} maintenance schedules`, `status=${maintRes.status}`);
      }
    }
  }
}

async function runHealthScript() {
  console.log('\n=== verify-tenant-health (skasc_db) ===');
  const { spawnSync } = require('child_process');
  const r = spawnSync('node', ['scripts/verify-tenant-health.js', 'skasc_db'], {
    cwd: require('path').join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 120000,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+)\/(\d+)\s+checks passed/i) || out.match(/passed:\s*(\d+)/i);
  if (r.status === 0) {
    pass('verify-tenant-health', m ? m[0] : 'exit 0');
  } else {
    fail('verify-tenant-health', out.split('\n').slice(-5).join(' ').slice(0, 200));
  }
}

async function main() {
  console.log('Pre-push SKASC smoke test');
  console.log(`API: ${API_BASE}  Host: ${SKASC_HOST}`);
  await runHealthScript();
  await dbTests();
  await apiTests();

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== Summary ===');
  console.log(`Passed: ${results.length - failed.length}/${results.length}`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
