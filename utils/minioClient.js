const Minio = require('minio');

const {
  MINIO_END_POINT = process.env.MINIO_END_POINT,
  MINIO_PORT = process.env.MINIO_PORT,
  MINIO_USE_SSL = process.env.MINIO_USE_SSL,
  MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY,
  MINIO_BUCKET = process.env.MINIO_BUCKET || 'asset-docs'
} = process.env;

const minioClient = new Minio.Client({
  endPoint: MINIO_END_POINT || '127.0.0.1',
  port: MINIO_PORT ? Number(MINIO_PORT) : 9000,
  useSSL: String(MINIO_USE_SSL).toLowerCase() === 'true',
  accessKey: MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: MINIO_SECRET_KEY || 'minioadmin',
});

async function ensureBucketExists(bucketName = MINIO_BUCKET) {
  const exists = await minioClient.bucketExists(bucketName).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
  }
}

module.exports = { minioClient, ensureBucketExists, MINIO_BUCKET };


