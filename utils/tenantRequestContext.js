const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function runWithTenantContext(ctx, callback) {
  return tenantContext.run(ctx || {}, callback);
}

function getTenantContext() {
  return tenantContext.getStore() || null;
}

function setTenantContext(patch) {
  const current = tenantContext.getStore() || {};
  const next = { ...current, ...patch };
  return tenantContext.run(next, () => next);
}

module.exports = {
  normalizeEmail,
  runWithTenantContext,
  getTenantContext,
  setTenantContext,
};
