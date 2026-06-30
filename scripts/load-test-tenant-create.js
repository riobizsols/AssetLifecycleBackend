#!/usr/bin/env node
/**
 * Concurrent tenant creation load test for POST /api/tenant-setup/create
 *
 * Usage:
 *   node scripts/load-test-tenant-create.js --concurrency 100
 *   LOAD_TEST_BASE_URL=http://localhost:5001 node scripts/load-test-tenant-create.js --concurrency 10
 *
 * Env:
 *   LOAD_TEST_BASE_URL       (default http://localhost:5001)
 *   LOAD_TEST_TIMEOUT_MS     (default 900000 = 15 min per request)
 *   LOAD_TEST_RUN_ID         optional batch id (default timestamp base36)
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

const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'http://localhost:5001';
const CONCURRENCY = parseInt(getArg('--concurrency', process.env.LOAD_TEST_CONCURRENCY || '100'), 10);
const TIMEOUT_MS = parseInt(process.env.LOAD_TEST_TIMEOUT_MS || '900000', 10);
const RUN_ID = (process.env.LOAD_TEST_RUN_ID || Date.now().toString(36).slice(-5)).toLowerCase().replace(/[^a-z0-9]/g, 'x');

function tenantPayload(index) {
  const n = String(index + 1).padStart(3, '0');
  const orgId = `T${RUN_ID}${n}`.toUpperCase().slice(0, 10);
  const subdomain = `t${RUN_ID}${n}`.toLowerCase().slice(0, 20);
  return {
    orgId,
    orgName: `Load Test Org ${n}`,
    orgCode: orgId,
    orgCity: 'Test City',
    subdomain,
    adminUser: {
      fullName: `Load Test Admin ${n}`,
      email: `loadtest.${RUN_ID}.${n}@alm-loadtest.local`,
      password: 'LoadTest1!',
      username: 'USR001',
      phone: '9876543210',
    },
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function requestCreate(payload) {
  return new Promise((resolve) => {
    const started = Date.now();
    const url = new URL('/api/tenant-setup/create', BASE_URL);
    const body = JSON.stringify(payload);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const duration = Date.now() - started;
          let parsed = null;
          try { parsed = JSON.parse(data); } catch (_) { /* ignore */ }
          resolve({
            orgId: payload.orgId,
            subdomain: payload.subdomain,
            status: res.statusCode,
            duration,
            ok: res.statusCode === 200 && parsed?.success === true,
            message: parsed?.message || null,
            database: parsed?.data?.database || null,
            error: !parsed?.success ? (parsed?.message || data.slice(0, 300)) : null,
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        orgId: payload.orgId,
        subdomain: payload.subdomain,
        status: 0,
        duration: Date.now() - started,
        ok: false,
        error: `timeout after ${TIMEOUT_MS}ms`,
      });
    });
    req.on('error', (err) => {
      resolve({
        orgId: payload.orgId,
        subdomain: payload.subdomain,
        status: 0,
        duration: Date.now() - started,
        ok: false,
        error: err.message,
      });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== ALM Tenant Creation Load Test ===');
  console.log(`Target: ${BASE_URL}/api/tenant-setup/create`);
  console.log(`Concurrency: ${CONCURRENCY} | Timeout per request: ${TIMEOUT_MS}ms`);
  console.log(`Run batch id: ${RUN_ID}`);
  console.log('');

  const payloads = Array.from({ length: CONCURRENCY }, (_, i) => tenantPayload(i));

  // Optional single warm-up (sequential, not counted in concurrency batch)
  if (args.includes('--skip-warmup')) {
    console.log('Skipping warm-up\n');
  } else {
    console.log('Warm-up: creating 1 tenant sequentially...');
    const warmup = await requestCreate(tenantPayload(999));
    if (!warmup.ok) {
      console.error('Warm-up failed:', warmup.status, warmup.error || warmup.message);
      process.exit(1);
    }
    console.log(`Warm-up OK (${warmup.duration}ms) org=${warmup.orgId} db=${warmup.database}\n`);
  }

  console.log(`Firing ${CONCURRENCY} concurrent tenant creation requests...`);
  const wallStart = Date.now();
  const results = await Promise.all(payloads.map((p) => requestCreate(p)));
  const wallMs = Date.now() - wallStart;

  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const statusCounts = {};
  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  const errorGroups = {};
  for (const f of failures) {
    const key = `${f.status}: ${f.error || f.message || 'unknown'}`;
    errorGroups[key] = (errorGroups[key] || 0) + 1;
  }

  const report = {
    timestamp: new Date().toISOString(),
    target: `${BASE_URL}/api/tenant-setup/create`,
    runId: RUN_ID,
    concurrency: CONCURRENCY,
    totalRequests: results.length,
    successCount: successes.length,
    failureCount: failures.length,
    successRatePct: Number(((successes.length / results.length) * 100).toFixed(2)),
    wallTimeMs: wallMs,
    wallTimeMin: Number((wallMs / 60000).toFixed(2)),
    throughputPerMin: Number(((successes.length / (wallMs / 60000)) || 0).toFixed(2)),
    latencyMs: {
      min: durations[0] ?? 0,
      max: durations[durations.length - 1] ?? 0,
      avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p50: percentile(durations, 50),
      p90: percentile(durations, 90),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
    },
    statusCounts,
    errorSummary: errorGroups,
    sampleFailures: failures.slice(0, 15).map((f) => ({
      orgId: f.orgId,
      subdomain: f.subdomain,
      status: f.status,
      error: f.error || f.message,
      duration: f.duration,
    })),
    createdDatabases: successes.map((s) => s.database).filter(Boolean),
    createdOrgIds: successes.map((s) => s.orgId),
  };

  console.log(JSON.stringify(report, null, 2));

  const outPath = path.join(__dirname, '..', 'reports', `tenant-create-load-test-${RUN_ID}-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${outPath}`);

  console.log('\n========== SUMMARY ==========');
  console.log(`Success: ${successes.length}/${CONCURRENCY} (${report.successRatePct}%)`);
  console.log(`Wall time: ${report.wallTimeMin} min`);
  console.log(`Latency p50/p95: ${report.latencyMs.p50}ms / ${report.latencyMs.p95}ms`);
  if (Object.keys(errorGroups).length) {
    console.log('Errors:');
    Object.entries(errorGroups).forEach(([k, v]) => console.log(`  ${v}x ${k}`));
  }

  process.exit(report.failureCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
