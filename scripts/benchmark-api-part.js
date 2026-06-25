#!/usr/bin/env node
/**
 * Benchmark cached list APIs — cold vs warm response times.
 * Usage: node scripts/benchmark-api-part.js <partNumber>
 * Env: BENCHMARK_BASE=http://localhost:4000/api
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE = process.env.BENCHMARK_BASE || 'http://localhost:4000/api';
const ORG_ID = process.env.BENCHMARK_ORG_ID || 'ORG001';

const TEST_USER = {
  org_id: ORG_ID,
  user_id: process.env.BENCHMARK_USER_ID || 'USR020',
  email: process.env.BENCHMARK_EMAIL || 'chiefofficer@gmail.com',
  job_role_id: process.env.BENCHMARK_JOB_ROLE || 'JR011',
  emp_int_id: null,
  language_code: 'en',
  hasSuperAccess: true,
  branch_id: null,
};

const PARTS = {
  1: {
    name: 'Master data lists',
    endpoints: [
      { method: 'GET', path: '/departments', label: 'Departments' },
      { method: 'GET', path: '/branches', label: 'Branches' },
      { method: 'GET', path: '/get-vendors', label: 'Vendors' },
      { method: 'GET', path: '/asset-types', label: 'Asset types' },
      { method: 'GET', path: '/users/get-users', label: 'Users' },
      { method: 'GET', path: '/job-roles', label: 'Job roles' },
    ],
  },
  2: {
    name: 'Admin configuration',
    endpoints: [
      { method: 'GET', path: '/properties/with-values', label: 'Properties with values' },
      { method: 'GET', path: '/breakdown-reason-codes', label: 'Breakdown reason codes' },
      { method: 'GET', path: '/maintenance-details/workflow-steps', label: 'Workflow steps' },
      { method: 'GET', path: '/maintenance-frequencies', label: 'Maintenance frequencies' },
      { method: 'GET', path: '/maint-types', label: 'Maintenance types' },
      { method: 'GET', path: '/uom', label: 'UOM' },
      { method: 'GET', path: '/text-messages/default', label: 'Text messages default' },
      { method: 'GET', path: '/job-monitor/jobs', label: 'Job monitor jobs' },
      { method: 'GET', path: '/tech-certificates', label: 'Tech certificates' },
      { method: 'GET', path: '/asset-types/maint-required', label: 'Asset types (maint required)' },
    ],
  },
  3: {
    name: 'Inspection & certifications',
    endpoints: [
      { method: 'GET', path: '/inspection-frequencies', label: 'Inspection frequencies' },
      { method: 'GET', path: '/inspection-checklists', label: 'Inspection checklists' },
      { method: 'GET', path: '/inspection-checklists/response-types', label: 'Checklist response types' },
      { method: 'GET', path: '/asset-types/inspection-certificates', label: 'Inspection certificates' },
      { method: 'GET', path: '/audit-log-configs', label: 'Audit log configs' },
      { method: 'GET', path: '/app-events/apps', label: 'App events apps' },
      { method: 'GET', path: '/app-events/events', label: 'App events events' },
    ],
  },
  4: {
    name: 'Operations & approvals',
    endpoints: [
      { method: 'GET', path: '/work-orders/all', label: 'Work orders' },
      { method: 'GET', path: '/approval-detail/maintenance-approvals', label: 'Maintenance approvals' },
      { method: 'GET', path: '/inspection-approval/pending', label: 'Inspection approvals' },
      { method: 'GET', path: '/asset-groups', label: 'Asset groups' },
      { method: 'GET', path: '/scrap-sales', label: 'Scrap sales' },
      { method: 'GET', path: '/assets?all=true', label: 'Assets list' },
      { method: 'GET', path: '/reportbreakdown/reports', label: 'Report breakdown' },
    ],
  },
  5: {
    name: 'Reports (reportsCache)',
    endpoints: [
      { method: 'GET', path: '/maintenance-history', label: 'Maintenance history report' },
      { method: 'GET', path: '/breakdown-history', label: 'Breakdown history report' },
      { method: 'GET', path: '/asset-register', label: 'Asset register report' },
      { method: 'GET', path: '/asset-lifecycle', label: 'Asset lifecycle report' },
      { method: 'GET', path: '/asset-workflow-history?page=1&limit=50', label: 'Asset workflow history' },
      { method: 'GET', path: '/asset-valuation?page=1&limit=50', label: 'Asset valuation report' },
    ],
  },
};

function token() {
  return jwt.sign(TEST_USER, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function timedFetch(url, headers) {
  const start = performance.now();
  const res = await fetch(url, { headers });
  const body = await res.text();
  const ms = performance.now() - start;
  let size = body.length;
  let count = null;
  try {
    const json = JSON.parse(body);
    if (Array.isArray(json)) count = json.length;
    else if (Array.isArray(json.data)) count = json.data.length;
    else if (json.data && typeof json.data === 'object') count = Object.keys(json.data).length;
  } catch {
    // non-json
  }
  return { ms, status: res.status, size, count, ok: res.ok };
}

async function benchmarkEndpoint(ep, authHeader) {
  const url = `${BASE}${ep.path}`;

  const cold = await timedFetch(url, authHeader);
  const warm1 = await timedFetch(url, authHeader);
  const warm2 = await timedFetch(url, authHeader);

  const warmAvg = (warm1.ms + warm2.ms) / 2;
  const improvement = cold.ms > 0 ? ((cold.ms - warmAvg) / cold.ms) * 100 : 0;

  return {
    label: ep.label,
    path: ep.path,
    status: cold.status,
    coldMs: Math.round(cold.ms),
    warmMs: Math.round(warmAvg),
    improvementPct: Math.round(improvement),
    rows: cold.count,
    sizeKb: Math.round(cold.size / 1024),
    ok: cold.ok,
  };
}

async function main() {
  const partNum = Number(process.argv[2] || '1');
  const part = PARTS[partNum];
  if (!part) {
    console.error(`Unknown part ${partNum}. Use 1-${Object.keys(PARTS).length}`);
    process.exit(1);
  }

  const authHeader = { Authorization: `Bearer ${token()}` };

  // health check
  try {
    const ping = await fetch(`${BASE}/departments`, { headers: authHeader });
    if (ping.status === 401) {
      console.error('Auth failed — check JWT_SECRET and test user');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Backend not reachable at ${BASE}: ${err.message}`);
    process.exit(1);
  }

  const redisEnabled = process.env.CACHE_ENABLED !== 'false';
  console.log(`\n=== Part ${partNum}: ${part.name} ===`);
  console.log(`Base: ${BASE} | Org: ${ORG_ID} | Redis cache env: ${redisEnabled ? 'enabled (if Redis up)' : 'disabled'}`);
  console.log('Cold = 1st request per endpoint | Warm = avg of 2nd & 3rd request (in-process L1 cache)\n');
  console.log(
    ['API', 'Status', 'Cold(ms)', 'Warm(ms)', 'Cache gain', 'Rows', 'Size(KB)'].join('\t'),
  );

  const results = [];
  for (const ep of part.endpoints) {
    const row = await benchmarkEndpoint(ep, authHeader);
    results.push(row);
    const gain = row.improvementPct > 0 ? `${row.improvementPct}%` : '—';
    console.log(
      [row.label, row.status, row.coldMs, row.warmMs, gain, row.rows ?? '—', row.sizeKb].join('\t'),
    );
  }

  const slow = results.filter((r) => r.ok && r.coldMs > 500);
  const noGain = results.filter((r) => r.ok && r.warmMs >= r.coldMs * 0.9);
  const failed = results.filter((r) => !r.ok);

  console.log('\n--- Summary ---');
  if (failed.length) console.log(`Failed: ${failed.map((r) => r.label).join(', ')}`);
  if (slow.length) {
    console.log(`Slow cold (>${500}ms): ${slow.map((r) => `${r.label} (${r.coldMs}ms)`).join(', ')}`);
  }
  if (noGain.length) {
    console.log(`Little/no cache benefit: ${noGain.map((r) => r.label).join(', ')}`);
  }

  const avgCold = results.filter((r) => r.ok).reduce((s, r) => s + r.coldMs, 0) / (results.filter((r) => r.ok).length || 1);
  const avgWarm = results.filter((r) => r.ok).reduce((s, r) => s + r.warmMs, 0) / (results.filter((r) => r.ok).length || 1);
  console.log(`Avg cold: ${Math.round(avgCold)}ms | Avg warm: ${Math.round(avgWarm)}ms | Overall cache gain: ${Math.round(((avgCold - avgWarm) / avgCold) * 100)}%`);

  // JSON for tooling
  console.log('\n__RESULTS_JSON__' + JSON.stringify({ part: partNum, results, avgCold, avgWarm }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
