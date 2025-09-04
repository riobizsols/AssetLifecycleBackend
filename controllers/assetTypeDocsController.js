const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { 
  insertAssetTypeDoc, 
  listAssetTypeDocs, 
  getAssetTypeDocById, 
  listAssetTypeDocsByType,
  checkAssetTypeExists,
  archiveAssetTypeDoc,
  deleteAssetTypeDoc
} = require('../models/assetTypeDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document for asset type
const uploadAssetTypeDoc = [
  upload.single('file'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const asset_type_id = body.asset_type_id || req.params.asset_type_id;
      const { doc_type, doc_type_name } = body;
      const org_id = req.user.org_id;

      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }

      if (!asset_type_id || !org_id) {
        return res.status(400).json({ message: 'asset_type_id and org_id are required' });
      }

      // Check if asset type exists
      const typeExists = await checkAssetTypeExists(asset_type_id);
      if (typeExists.rows.length === 0) {
        return res.status(404).json({ message: 'Asset type not found' });
      }

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/asset-types/${asset_type_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      // Generate unique document ID
      const atd_id = `ATD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const dbRes = await insertAssetTypeDoc({
        atd_id,
        asset_type_id,
        doc_type: doc_type || null,
        doc_type_name: doc_type_name || null,
        doc_path,
        is_archived: false,
        archived_path: null,
        org_id
      });

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document: dbRes.rows[0]
      });
    } catch (err) {
      console.error('Upload failed', err);
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

// List documents for an asset type
const listDocs = async (req, res) => {
  try {
    const { asset_type_id } = req.params;
    const { doc_type } = req.query;

    // Check if asset type exists
    const typeExists = await checkAssetTypeExists(asset_type_id);
    if (typeExists.rows.length === 0) {
      return res.status(404).json({ message: 'Asset type not found' });
    }

    let result;
    if (doc_type) {
      result = await listAssetTypeDocsByType(asset_type_id, doc_type);
    } else {
      result = await listAssetTypeDocs(asset_type_id);
    }

    return res.json({
      message: 'Documents retrieved successfully',
      documents: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

// Get download/view URL for asset type document
const getDownloadUrl = async (req, res) => {
  try {
    const { atd_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    const result = await getAssetTypeDocById(atd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

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
    return res.json({ 
      message: 'URL generated successfully',
      url,
      document: doc
    });
  } catch (err) {
    console.error('Failed to get download url', err);
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

// Archive asset type document
const archiveDoc = async (req, res) => {
  try {
    const { atd_id } = req.params;
    const { archived_path } = req.body;

    const result = await archiveAssetTypeDoc(atd_id, archived_path);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document archived successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to archive document', err);
    return res.status(500).json({ message: 'Failed to archive document', error: err.message });
  }
};

// Delete asset type document
const deleteDoc = async (req, res) => {
  try {
    const { atd_id } = req.params;

    const result = await deleteAssetTypeDoc(atd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document deleted successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to delete document', err);
    return res.status(500).json({ message: 'Failed to delete document', error: err.message });
  }
};

// Get document details by ID
const getDocById = async (req, res) => {
  try {
    const { atd_id } = req.params;
    
    const result = await getAssetTypeDocById(atd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document retrieved successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to get document', err);
    return res.status(500).json({ message: 'Failed to get document', error: err.message });
  }
};

module.exports = { 
  uploadAssetTypeDoc, 
  listDocs, 
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById 
};
