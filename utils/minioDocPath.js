const { MINIO_BUCKET } = require('./minioClient');

/**
 * Stored doc_path / archived_path may be:
 *   - bucket/org_id/.../file.ext
 *   - org_id/.../file.ext
 * Returns the MinIO object key (no bucket prefix).
 */
function resolveObjectKey(storedPath, bucketName = MINIO_BUCKET) {
  const parts = String(storedPath || '')
    .split('/')
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts[0] === bucketName) {
    return parts.slice(1).join('/');
  }
  return parts.join('/');
}

function formatStoredPath(objectKey, bucketName = MINIO_BUCKET) {
  const key = String(objectKey || '').replace(/^\/+/, '');
  if (!key) return '';
  return `${bucketName}/${key}`;
}

function parseAssetMaintenanceActiveKey(objectKey) {
  const parts = String(objectKey || '').split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] || '';
  const assetId = parts[parts.length - 2] || '';
  // ORG001/asset-maintenance/ASS148/file.pdf
  const orgId = parts[0] || '';
  return { orgId, assetId, fileName };
}

function buildAssetMaintenanceActiveKey(orgId, assetId, fileName) {
  return `${orgId}/asset-maintenance/${assetId}/${fileName}`;
}

function buildAssetMaintenanceArchivedKey(orgId, assetId, fileName) {
  return `${orgId}/asset-maintenance/Archived Asset Maintenance Document/${assetId}/${fileName}`;
}

module.exports = {
  resolveObjectKey,
  formatStoredPath,
  parseAssetMaintenanceActiveKey,
  buildAssetMaintenanceActiveKey,
  buildAssetMaintenanceArchivedKey,
};
