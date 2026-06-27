#!/usr/bin/env node
/**
 * Load test mimicking the web Assets screen API calls.
 *
 * Per "screen load":
 *   1. GET /api/assets
 *   2. GET /api/asset-types
 *   3. GET /api/column-access-config?jobRoleId=&tableName=tblAssets
 *   4. GET /api/navigation/user/navigation?platform=D
 *
 * Optional asset detail (--detail): + GET /api/assets/:assetId
 *
 * Usage:
 *   node scripts/load-test-assets-screen.js --concurrency 50
 *   LOAD_TEST_TOKEN=<jwt> node scripts/load-test-assets-screen.js --concurrency 50
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = parseInt(getArg('--concurrency', process.env.LOAD_TEST_CONCURRENCY || '50'), 10);
const ITERATIONS = parseInt(getArg('--iterations', process.env.LOAD_TEST_ITERATIONS || '1'), 10);
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'LoadTest1!';
const EMAIL = process.env.LOAD_TEST_EMAIL || 'loadtest001@loadtest.local';
const JOB_ROLE_ID = process.env.LOAD_TEST_JOB_ROLE_ID || 'JR001';
const TIMEOUT_MS = parseInt(process.env.LOAD_TEST_TIMEOUT_MS || '60000', 10);
const INCLUDE_DETAIL = args.includes('--detail');
const ASSET_ID = getArg('--asset-id', process.env.LOAD_TEST_ASSET_ID || '');

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function httpRequest({ method, urlPath, token, body }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const url = new URL(urlPath, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const lib = url.protocol === 'https:' ? https : http;

    const headers = { Authorization: `Bearer ${token}` };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            duration: Date.now() - started,
            ok: res.statusCode >= 200 && res.statusCode < 300,
            bytes: data.length,
            path: urlPath.split('?')[0],
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, duration: Date.now() - started, ok: false, bytes: 0, path: urlPath, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ status: 0, duration: Date.now() - started, ok: false, bytes: 0, path: urlPath, error: err.message });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function login() {
  const started = Date.now();
  const url = new URL('/api/auth/login', BASE_URL);
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
  const lib = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (!json.token) return reject(new Error(`Login failed: ${res.statusCode} ${data.slice(0, 200)}`));
            resolve({ token: json.token, duration: Date.now() - started, jobRoleId: json.user?.job_role_id || JOB_ROLE_ID });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function simulateAssetsScreenLoad(token, jobRoleId, assetId) {
  const screenStart = Date.now();
  const endpoints = [
    '/api/assets?page=1&limit=50',
    '/api/asset-types',
    `/api/column-access-config?jobRoleId=${encodeURIComponent(jobRoleId)}&tableName=tblAssets`,
    '/api/navigation/user/navigation?platform=D',
  ];
  if (INCLUDE_DETAIL && assetId) {
    endpoints.push(`/api/assets/${encodeURIComponent(assetId)}`);
  }

  const results = await Promise.all(
    endpoints.map((p) => httpRequest({ method: 'GET', urlPath: p, token }))
  );

  const wallMs = Date.now() - screenStart;
  const ok = results.every((r) => r.ok);
  return { ok, wallMs, results };
}

async function main() {
  console.log('=== ALM Assets Screen Load Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY} | Iterations: ${ITERATIONS} | Detail: ${INCLUDE_DETAIL}`);
  console.log('');

  let token = process.env.LOAD_TEST_TOKEN || '';
  let jobRoleId = JOB_ROLE_ID;
  if (!token) {
    const loginResult = await login();
    token = loginResult.token;
    jobRoleId = loginResult.jobRoleId;
    console.log(`Login OK (${loginResult.duration}ms) as ${EMAIL}\n`);
  }

  let assetId = ASSET_ID;
  if (INCLUDE_DETAIL && !assetId) {
    const probe = await httpRequest({ method: 'GET', urlPath: '/api/assets', token });
    if (probe.ok) {
      try {
        const url = new URL('/api/assets', BASE_URL);
        const lib = url.protocol === 'https:' ? https : http;
        const list = await new Promise((resolve, reject) => {
          const req = lib.request(
            { hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'GET', headers: { Authorization: `Bearer ${token}` } },
            (res) => {
              let d = '';
              res.on('data', (c) => { d += c; });
              res.on('end', () => resolve(JSON.parse(d)));
            }
          );
          req.on('error', reject);
          req.end();
        });
        assetId = Array.isArray(list) && list[0]?.asset_id ? list[0].asset_id : '';
      } catch (_) { /* ignore */ }
    }
    console.log(`Asset detail probe id: ${assetId || '(none)'}\n`);
  }

  const screenRuns = [];
  const endpointStats = {};
  const wallStart = Date.now();

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const batch = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => simulateAssetsScreenLoad(token, jobRoleId, assetId))
    );
    screenRuns.push(...batch);
    for (const run of batch) {
      for (const r of run.results) {
        const key = r.path;
        if (!endpointStats[key]) endpointStats[key] = [];
        endpointStats[key].push(r);
      }
    }
    if (ITERATIONS > 1) console.log(`Iteration ${iter + 1}/${ITERATIONS} done`);
  }

  const totalWallMs = Date.now() - wallStart;
  const screenWallTimes = screenRuns.map((r) => r.wallMs).sort((a, b) => a - b);
  const successes = screenRuns.filter((r) => r.ok);
  const failures = screenRuns.filter((r) => !r.ok);

  const perEndpoint = {};
  for (const [ep, rows] of Object.entries(endpointStats)) {
    const durations = rows.map((r) => r.duration).sort((a, b) => a - b);
    const okCount = rows.filter((r) => r.ok).length;
    const bytes = rows.map((r) => r.bytes);
    perEndpoint[ep] = {
      requests: rows.length,
      successCount: okCount,
      failureCount: rows.length - okCount,
      successRatePct: Number(((okCount / rows.length) * 100).toFixed(2)),
      latencyMs: {
        min: durations[0] ?? 0,
        max: durations[durations.length - 1] ?? 0,
        avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        p50: percentile(durations, 50),
        p95: percentile(durations, 95),
        p99: percentile(durations, 99),
      },
      avgResponseBytes: bytes.length ? Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length) : 0,
    };
  }

  const report = {
    timestamp: new Date().toISOString(),
    scenario: 'assets-screen-load',
    target: BASE_URL,
    concurrency: CONCURRENCY,
    iterations: ITERATIONS,
    includeAssetDetail: INCLUDE_DETAIL,
    totalScreenLoads: screenRuns.length,
    screenSuccessCount: successes.length,
    screenFailureCount: failures.length,
    screenSuccessRatePct: Number(((successes.length / screenRuns.length) * 100).toFixed(2)),
    totalWallTimeMs: totalWallMs,
    screenThroughputRps: Number((screenRuns.length / (totalWallMs / 1000)).toFixed(2)),
    screenWallTimeMs: {
      min: screenWallTimes[0] ?? 0,
      max: screenWallTimes[screenWallTimes.length - 1] ?? 0,
      avg: screenWallTimes.length ? Math.round(screenWallTimes.reduce((a, b) => a + b, 0) / screenWallTimes.length) : 0,
      p50: percentile(screenWallTimes, 50),
      p95: percentile(screenWallTimes, 95),
      p99: percentile(screenWallTimes, 99),
    },
    endpoints: perEndpoint,
  };

  console.log(JSON.stringify(report, null, 2));

  const outPath = path.join(__dirname, '..', 'reports', `assets-screen-load-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${outPath}`);

  process.exit(report.screenFailureCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
