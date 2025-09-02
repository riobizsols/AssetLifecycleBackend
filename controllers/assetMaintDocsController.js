const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { 
  insertAssetMaintDoc, 
  listAssetMaintDocs, 
  listAssetMaintDocsByWorkOrder,
  getAssetMaintDocById, 
  listAssetMaintDocsByType,
  listAssetMaintDocsByWorkOrderAndType,
  checkAssetExists,
  checkWorkOrderExists,
  archiveAssetMaintDoc,
  deleteAssetMaintDoc
} = require('../models/assetMaintDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document for asset maintenance
const uploadAssetMaintDoc = [
  upload.single('file'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const asset_id = body.asset_id || req.params.asset_id;
      const { doc_type, doc_type_name } = body;
      const org_id = req.user.org_id;

      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }

      if (!asset_id || !org_id) {
        return res.status(400).json({ message: 'asset_id and org_id are required' });
      }

      // Check if asset exists
      const assetExists = await checkAssetExists(asset_id);
      if (assetExists.rows.length === 0) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/asset-maintenance/${asset_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      // Generate unique document ID
      const amd_id = `AMD${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const dbRes = await insertAssetMaintDoc({
        amd_id,
        asset_id,
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

// List documents for an asset
const listDocsByAsset = async (req, res) => {
  try {
    const { asset_id } = req.params;
    const { doc_type } = req.query;

    // Check if asset exists
    const assetExists = await checkAssetExists(asset_id);
    if (assetExists.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    let result;
    if (doc_type) {
      result = await listAssetMaintDocsByType(asset_id, doc_type);
    } else {
      result = await listAssetMaintDocs(asset_id);
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

// List documents for a work order
const listDocsByWorkOrder = async (req, res) => {
  try {
    const { ams_id } = req.params;
    const { doc_type } = req.query;

    // Check if work order exists
    const workOrderExists = await checkWorkOrderExists(ams_id);
    if (workOrderExists.rows.length === 0) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    let result;
    if (doc_type) {
      result = await listAssetMaintDocsByWorkOrderAndType(ams_id, doc_type);
    } else {
      result = await listAssetMaintDocsByWorkOrder(ams_id);
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

// Get download/view URL for asset maintenance document
const getDownloadUrl = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    const result = await getAssetMaintDocById(amd_id);
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

// Archive asset maintenance document
const archiveDoc = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const { archived_path } = req.body;

    const result = await archiveAssetMaintDoc(amd_id, archived_path);
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

// Delete asset maintenance document
const deleteDoc = async (req, res) => {
  try {
    const { amd_id } = req.params;

    const result = await deleteAssetMaintDoc(amd_id);
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
    const { amd_id } = req.params;
    
    const result = await getAssetMaintDocById(amd_id);
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
  uploadAssetMaintDoc, 
  listDocsByAsset,
  listDocsByWorkOrder,
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById 
};
