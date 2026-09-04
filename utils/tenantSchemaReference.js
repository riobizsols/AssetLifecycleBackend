/**
 * Tenant provisioning template database (schema + reference master data).
 * Default: schema_db on the same host as TENANT_DATABASE_URL / DATABASE_URL.
 */

const DEFAULT_SCHEMA_DB_NAME = 'schema_db';

function buildSchemaDbUrl(baseUrl, dbName = DEFAULT_SCHEMA_DB_NAME) {
  if (!baseUrl || typeof baseUrl !== 'string') return null;
  return baseUrl.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function getReferenceUrl() {
  if (process.env.TENANT_SCHEMA_REFERENCE_URL) {
    return process.env.TENANT_SCHEMA_REFERENCE_URL;
  }

  const dbName = process.env.TENANT_SCHEMA_DB_NAME || DEFAULT_SCHEMA_DB_NAME;

  return (
    buildSchemaDbUrl(process.env.TENANT_DATABASE_URL, dbName) ||
    buildSchemaDbUrl(process.env.DATABASE_URL, dbName) ||
    buildSchemaDbUrl(process.env.HOSPITALITY_DATABASE_URL, dbName) ||
    null
  );
}

function getReferenceDatabaseName() {
  const url = getReferenceUrl();
  if (!url) return null;
  const match = url.match(/\/([^/?]+)(?:\?|$)/);
  return match ? match[1] : null;
}

module.exports = {
  DEFAULT_SCHEMA_DB_NAME,
  buildSchemaDbUrl,
  getReferenceUrl,
  getReferenceDatabaseName,
};
