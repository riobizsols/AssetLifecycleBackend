const fs = require('fs');
const path = require('path');
const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('./minioClient');

const LOCAL_PREFIX = 'local-uploads';
const LOCAL_ROOT = path.join(__dirname, '..', 'uploads');
const USE_LOCAL_FALLBACK =
  String(process.env.MINIO_LOCAL_FALLBACK || '').toLowerCase() === 'true' ||
  process.env.NODE_ENV !== 'production';

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message || 'Operation timed out');
      error.code = 'ETIMEDOUT';
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

async function uploadBuffer({
  buffer,
  objectName,
  contentType = 'application/octet-stream',
  bucket = MINIO_BUCKET,
}) {
  if (!buffer) return null;

  try {
    await withTimeout(ensureBucketExists(bucket), 5000, 'MinIO bucket check timed out');
    await withTimeout(
      minioClient.putObject(bucket, objectName, buffer, { 'Content-Type': contentType }),
      15000,
      'MinIO upload timed out'
    );
    return `${bucket}/${objectName}`;
  } catch (error) {
    console.error('MinIO upload failed:', error.message);

    if (!USE_LOCAL_FALLBACK) {
      throw new Error(
        'File storage unavailable. MinIO could not be reached. Check MINIO_END_POINT / firewall, or set MINIO_LOCAL_FALLBACK=true for local development.'
      );
    }

    const fullPath = path.join(LOCAL_ROOT, objectName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    console.log(`Stored file locally at ${fullPath} (MinIO unavailable)`);
    return `${LOCAL_PREFIX}/${objectName}`;
  }
}

async function getPresignedDownloadUrl(filePath, expirySeconds = 600, respHeaders = {}) {
  if (!filePath || filePath.startsWith(`${LOCAL_PREFIX}/`)) {
    return null;
  }

  const [bucket, ...keyParts] = filePath.split('/');
  const objectName = keyParts.join('/');
  if (!bucket || !objectName) {
    throw new Error('Invalid file path');
  }

  const timeoutMs = Number(process.env.MINIO_PRESIGN_TIMEOUT_MS || 8000);
  return withTimeout(
    minioClient.presignedGetObject(bucket, objectName, expirySeconds, respHeaders),
    timeoutMs,
    `MinIO presign timed out after ${timeoutMs}ms (check MINIO_END_POINT / network)`,
  );
}

/**
 * Stream object bytes from MinIO (or local fallback path) with a hard timeout on connect.
 */
async function getObjectStream(filePath) {
  const localPath = resolveLocalPath(filePath);
  if (localPath) {
    if (!fs.existsSync(localPath)) {
      const err = new Error('Local file not found');
      err.code = 'ENOENT';
      throw err;
    }
    return fs.createReadStream(localPath);
  }

  const [bucket, ...keyParts] = (filePath || '').split('/');
  const objectName = keyParts.join('/');
  if (!bucket || !objectName) {
    throw new Error('Invalid file path');
  }

  const timeoutMs = Number(process.env.MINIO_GET_TIMEOUT_MS || 10000);
  return withTimeout(
    minioClient.getObject(bucket, objectName),
    timeoutMs,
    `MinIO getObject timed out after ${timeoutMs}ms (check MINIO_END_POINT / network)`,
  );
}

function resolveLocalPath(filePath) {
  if (!filePath?.startsWith(`${LOCAL_PREFIX}/`)) {
    return null;
  }
  return path.join(LOCAL_ROOT, filePath.slice(LOCAL_PREFIX.length + 1));
}

module.exports = {
  uploadBuffer,
  getPresignedDownloadUrl,
  getObjectStream,
  resolveLocalPath,
  withTimeout,
  LOCAL_PREFIX,
};
