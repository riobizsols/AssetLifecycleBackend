const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const {
  resolveObjectKey,
  formatStoredPath,
  parseAssetMaintenanceActiveKey,
  buildAssetMaintenanceActiveKey,
  buildAssetMaintenanceArchivedKey,
} = require('../utils/minioDocPath');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { generateCustomId } = require('../utils/idGenerator');
const { 
  insertAssetMaintDoc, 
  listAssetMaintDocs, 
  listAssetMaintDocsByWorkOrder,
  getAssetMaintDocById, 
  listAssetMaintDocsByDto,
  listAssetMaintDocsByWorkOrderAndDto,
  checkAssetExists,
  checkWorkOrderExists,
  updateAssetMaintDocArchiveStatus,
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
      const { dto_id, doc_type_name } = body;
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
      const amd_id = await generateCustomId('asset_maint_doc', 3);
      
      const dbRes = await insertAssetMaintDoc({
        amd_id,
        asset_id,
        dto_id: dto_id || null,
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
    const { dto_id } = req.query;

    // Check if asset exists
    const assetExists = await checkAssetExists(asset_id);
    if (assetExists.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    let result;
    if (dto_id) {
      result = await listAssetMaintDocsByDto(asset_id, dto_id);
    } else {
      result = await listAssetMaintDocs(asset_id);
    }

    return res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: result.rows
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
    const { dto_id } = req.query;

    // Check if work order exists
    const workOrderExists = await checkWorkOrderExists(ams_id);
    if (workOrderExists.rows.length === 0) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    let result;
    if (dto_id) {
      result = await listAssetMaintDocsByWorkOrderAndDto(ams_id, dto_id);
    } else {
      result = await listAssetMaintDocsByWorkOrder(ams_id);
    }

    return res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: result.rows
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
    const storedPath = doc.is_archived && doc.archived_path ? doc.archived_path : doc.doc_path;
    const [bucket, ...keyParts] = storedPath.split('/');
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

// Update document archive status
const updateDocArchiveStatus = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const { is_archived } = req.body;

    if (typeof is_archived !== 'boolean') {
      return res.status(400).json({ message: 'is_archived must be a boolean value' });
    }

    const currentDoc = await getAssetMaintDocById(amd_id);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: 'Asset maintenance document not found' });
    }

    const doc = currentDoc.rows[0];
    const activeMeta = parseAssetMaintenanceActiveKey(resolveObjectKey(doc.doc_path, MINIO_BUCKET));
    const orgId = doc.org_id || activeMeta.orgId;
    const assetId = doc.asset_id || activeMeta.assetId;
    const fileName = activeMeta.fileName
      || String(doc.doc_path || '').split('/').filter(Boolean).pop()
      || '';

    if (!orgId || !assetId || !fileName) {
      return res.status(400).json({ message: 'Unable to resolve document path metadata for archive operation' });
    }

    let archivedPath = null;

    if (is_archived) {
      const sourceKey = resolveObjectKey(doc.doc_path, MINIO_BUCKET);
      const archivedObjectKey = buildAssetMaintenanceArchivedKey(orgId, assetId, fileName);

      try {
        await minioClient.copyObject(MINIO_BUCKET, archivedObjectKey, `/${MINIO_BUCKET}/${sourceKey}`);
        await minioClient.removeObject(MINIO_BUCKET, sourceKey);
        archivedPath = formatStoredPath(archivedObjectKey, MINIO_BUCKET);
      } catch (minioErr) {
        console.error('MinIO archive operation failed:', minioErr);
        return res.status(500).json({ message: 'Failed to move file to archived location', error: minioErr.message });
      }
    } else if (doc.archived_path) {
      const archivedObjectKey = resolveObjectKey(doc.archived_path, MINIO_BUCKET);
      const activeObjectKey = buildAssetMaintenanceActiveKey(orgId, assetId, fileName);
      const sourceCandidates = [
        archivedObjectKey,
        buildAssetMaintenanceArchivedKey(orgId, assetId, fileName),
      ].filter((key, index, arr) => key && arr.indexOf(key) === index);

      let restored = false;
      let lastError = null;

      for (const sourceKey of sourceCandidates) {
        try {
          await minioClient.copyObject(MINIO_BUCKET, activeObjectKey, `/${MINIO_BUCKET}/${sourceKey}`);
          await minioClient.removeObject(MINIO_BUCKET, sourceKey);
          restored = true;
          break;
        } catch (minioErr) {
          lastError = minioErr;
          console.warn(`MinIO unarchive attempt failed for key ${sourceKey}:`, minioErr.message);
        }
      }

      if (!restored) {
        console.error('MinIO unarchive operation failed:', lastError);
        return res.status(500).json({
          message: 'Failed to move file back to active location',
          error: lastError?.message || 'Unknown MinIO error',
        });
      }

      archivedPath = null;
    }

    const result = await updateAssetMaintDocArchiveStatus(amd_id, is_archived, archivedPath);

    return res.json({
      message: 'Archive status updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

module.exports = { 
  uploadAssetMaintDoc, 
  listDocsByAsset,
  listDocsByWorkOrder,
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById,
  updateDocArchiveStatus
};
