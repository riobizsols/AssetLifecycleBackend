#!/usr/bin/env node
/**
 * Concurrent login load test for POST /api/auth/login
 *
 * Usage:
 *   node scripts/load-test-login.js --concurrency 100 --iterations 1
 *   LOAD_TEST_EMAIL=loadtest001@loadtest.local LOAD_TEST_PASSWORD=LoadTest1! node scripts/load-test-login.js
 *
 * Env:
 *   LOAD_TEST_BASE_URL  (default http://localhost:4000)
 *   LOAD_TEST_EMAIL     (single user mode)
 *   LOAD_TEST_PASSWORD
 *   LOAD_TEST_USER_COUNT (multi-user: loadtest001@loadtest.local .. N)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE_URL = process.env.LOAD_TEST_BASE_URL || 'http://localhost:4000';
const CONCURRENCY = parseInt(getArg('--concurrency', process.env.LOAD_TEST_CONCURRENCY || '100'), 10);
const ITERATIONS = parseInt(getArg('--iterations', process.env.LOAD_TEST_ITERATIONS || '1'), 10);
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'LoadTest1!';
const USER_COUNT = parseInt(process.env.LOAD_TEST_USER_COUNT || String(CONCURRENCY), 10);
const SINGLE_EMAIL = process.env.LOAD_TEST_EMAIL || null;
const TIMEOUT_MS = parseInt(process.env.LOAD_TEST_TIMEOUT_MS || '30000', 10);

function emailForIndex(i) {
  if (SINGLE_EMAIL) return SINGLE_EMAIL;
  const n = String(i + 1).padStart(3, '0');
  return `loadtest${n}@loadtest.local`;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function requestLogin(email) {
  return new Promise((resolve) => {
    const started = Date.now();
    const url = new URL('/api/auth/login', BASE_URL);
    const body = JSON.stringify({ email, password: PASSWORD });
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
          Host: url.hostname,
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
            email,
            status: res.statusCode,
            duration,
            ok: res.statusCode === 200 && Boolean(parsed?.token),
            error: parsed?.message || (res.statusCode >= 400 ? data.slice(0, 200) : null),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ email, status: 0, duration: Date.now() - started, ok: false, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ email, status: 0, duration: Date.now() - started, ok: false, error: err.message });
    });
    req.write(body);
    req.end();
  });
}

async function runBatch(batchIndex, size) {
  const tasks = Array.from({ length: size }, (_, i) => {
    const userIndex = (batchIndex * size + i) % USER_COUNT;
    return requestLogin(emailForIndex(userIndex));
  });
  return Promise.all(tasks);
}

async function main() {
  console.log('=== ALM Login Load Test ===');
  console.log(`Target: ${BASE_URL}/api/auth/login`);
  console.log(`Concurrency: ${CONCURRENCY} | Iterations: ${ITERATIONS} | Users: ${SINGLE_EMAIL ? 1 : USER_COUNT}`);
  console.log('');

  // Warm-up
  const warmup = await requestLogin(emailForIndex(0));
  if (!warmup.ok) {
    console.error('Warm-up login failed:', warmup.status, warmup.error);
    console.error('Run: node scripts/seed-load-test-users.js');
    process.exit(1);
  }
  console.log(`Warm-up OK (${warmup.duration}ms)\n`);

  const allResults = [];
  const wallStart = Date.now();

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const batch = await runBatch(iter, CONCURRENCY);
    allResults.push(...batch);
    if (ITERATIONS > 1) {
      console.log(`Iteration ${iter + 1}/${ITERATIONS} complete`);
    }
  }

  const wallMs = Date.now() - wallStart;
  const durations = allResults.map((r) => r.duration).sort((a, b) => a - b);
  const successes = allResults.filter((r) => r.ok);
  const failures = allResults.filter((r) => !r.ok);
  const statusCounts = {};
  for (const r of allResults) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  const report = {
    timestamp: new Date().toISOString(),
    target: `${BASE_URL}/api/auth/login`,
    concurrency: CONCURRENCY,
    iterations: ITERATIONS,
    totalRequests: allResults.length,
    successCount: successes.length,
    failureCount: failures.length,
    successRatePct: Number(((successes.length / allResults.length) * 100).toFixed(2)),
    wallTimeMs: wallMs,
    throughputRps: Number((allResults.length / (wallMs / 1000)).toFixed(2)),
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
    sampleErrors: [...new Set(failures.map((f) => `${f.status}: ${f.error}`))].slice(0, 10),
  };

  console.log(JSON.stringify(report, null, 2));

  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '..', 'reports', `login-load-test-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${outPath}`);

  process.exit(report.failureCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
