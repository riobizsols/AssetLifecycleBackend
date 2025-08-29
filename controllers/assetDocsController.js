const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { insertAssetDoc, listAssetDocs, getAssetDocById } = require('../models/assetDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadAssetDoc = [
  upload.single('file'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const asset_id = body.asset_id || req.params.asset_id;
      const { doc_type, doc_type_name, org_id } = body;
      if (!req.file) return res.status(400).json({ message: 'file is required' });
      if (!asset_id || !org_id) return res.status(400).json({ message: 'asset_id and org_id are required' });

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/${asset_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      const a_d_id = `AD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const dbRes = await insertAssetDoc({
        a_d_id,
        asset_id,
        doc_type: doc_type || null,
        doc_type_name: doc_type_name || null,
        doc_path,
        is_archived: false,
        archived_path: null,
        org_id
      });

      return res.status(201).json(dbRes.rows[0]);
    } catch (err) {
      console.error('Upload failed', err);
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

const listDocs = async (req, res) => {
  try {
    const { asset_id } = req.params;
    const result = await listAssetDocs(asset_id);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

const getDownloadUrl = async (req, res) => {
  try {
    const { a_d_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    const result = await getAssetDocById(a_d_id);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const doc = result.rows[0];
    const [bucket, ...keyParts] = doc.doc_path.split('/');
    const objectName = keyParts.join('/');

    const respHeaders = {};
    if (mode === 'download') {
      respHeaders['response-content-disposition'] = `attachment; filename="${path.basename(objectName)}"`;
    } else if (mode === 'view') {
      respHeaders['response-content-disposition'] = 'inline';
    }

    const url = await minioClient.presignedGetObject(bucket, objectName, 60 * 60, respHeaders);
    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

module.exports = { uploadAssetDoc, listDocs, getDownloadUrl };


